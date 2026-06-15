import type { ReceiptEventPayload } from "@resonate/shared";
import type { AcceptedMessage } from "./app";
import { recordConversion } from "./conversions";
import { rollLifecycle } from "./lifecycle";
import { logger } from "./logger";
import { deliverReceipts } from "./receipts";

/**
 * Serverless lifecycle driver.
 *
 * On a long-running server the funnel plays out on background timers and a
 * periodic flusher (see lifecycle.ts / receipts.ts). A serverless function
 * can't do that — it's frozen the moment the HTTP response is sent. So here we
 * collapse one accepted batch's whole lifecycle into a single awaitable that a
 * `waitUntil` keeps alive after the 202: we roll every message up front, lay
 * its events on a timeline, replay that timeline (posting receipts back to the
 * CRM in flush waves as events fire), and post any attributed conversions.
 *
 * Two safety rails matter on serverless:
 *  - HEAD_START_MS: hold the first receipt briefly so the CRM has recorded the
 *    vendorMessageIds from the 202 before delivery events arrive — otherwise
 *    processReceipts drops them as unapplicable and the funnel never advances.
 *  - BUDGET_MS: the entire timeline is compressed to fit well inside the
 *    function's maxDuration, regardless of SIM_SPEED, so no events are stranded
 *    by a freeze.
 */

/** Hold the first receipt this long so the CRM can persist vendorMessageIds. */
const HEAD_START_MS = 1_500;
/** Compress the whole batch into at most this window (must be < maxDuration). */
const BUDGET_MS = 40_000;
/** Flush buffered receipts at least this often while the timeline plays. */
const FLUSH_INTERVAL_MS = 800;
/** Cap a single signed receipt POST at this many events. */
const MAX_BATCH_SIZE = 500;

type TimelineEntry =
  | { at: number; kind: "event"; event: ReceiptEventPayload }
  | { at: number; kind: "conversion"; record: AcceptedMessage["record"] };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the full lifecycle for one accepted batch to completion. Resolves once
 * every receipt has been flushed and every conversion attempt has settled.
 * Best-effort throughout: a failed flush/conversion is logged, never thrown, so
 * one bad message can't strand the rest of the batch.
 */
export async function simulateBatch(messages: AcceptedMessage[]): Promise<void> {
  if (messages.length === 0) {
    return;
  }

  // 1. Roll every message and lay its events on a timeline. `at` is the
  //    lifecycle offset only (the fixed head-start is added at replay time, so
  //    compression below can never erode the head-start safety margin).
  const entries: TimelineEntry[] = [];
  for (const message of messages) {
    const plan = rollLifecycle(message.record);
    const base = Math.max(0, message.startDelayMs);
    for (const event of plan.events) {
      entries.push({
        at: base + event.delayMs,
        kind: "event",
        event: {
          vendorMessageId: message.vendorMessageId,
          eventType: event.eventType,
          occurredAt: "", // stamped at fire time below
          ...(event.reason !== undefined ? { reason: event.reason } : {}),
        },
      });
    }
    if (plan.conversionDelayMs !== null) {
      entries.push({ at: base + plan.conversionDelayMs, kind: "conversion", record: message.record });
    }
  }
  if (entries.length === 0) {
    return;
  }

  // 2. Compress only the lifecycle into the budget left after the head-start,
  //    so the slowest event still lands inside maxDuration at any SIM_SPEED.
  const maxAt = entries.reduce((max, entry) => Math.max(max, entry.at), 0);
  const lifecycleBudget = BUDGET_MS - HEAD_START_MS;
  const scale = maxAt > lifecycleBudget ? lifecycleBudget / maxAt : 1;
  entries.sort((a, b) => a.at - b.at);

  // 3. Replay it: post receipts in flush waves, fire conversions as they land.
  const buffer: ReceiptEventPayload[] = [];
  const inflight: Promise<void>[] = [];
  const startedAt = Date.now();
  let lastFlush = startedAt;

  const flush = (): void => {
    if (buffer.length === 0) {
      return;
    }
    const batch = buffer.splice(0, MAX_BATCH_SIZE);
    lastFlush = Date.now();
    inflight.push(
      deliverReceipts(batch).catch((err) => {
        logger.error("serverless receipt flush failed", {
          message: err instanceof Error ? err.message : String(err),
        });
      }),
    );
  };

  for (const entry of entries) {
    const waitMs = startedAt + HEAD_START_MS + entry.at * scale - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    if (entry.kind === "event") {
      buffer.push({ ...entry.event, occurredAt: new Date().toISOString() });
      if (buffer.length >= MAX_BATCH_SIZE || Date.now() - lastFlush >= FLUSH_INTERVAL_MS) {
        flush();
      }
    } else {
      inflight.push(recordConversion(entry.record));
    }
  }

  flush();
  await Promise.allSettled(inflight);
  logger.info("serverless batch simulated", { messages: messages.length, events: entries.length });
}
