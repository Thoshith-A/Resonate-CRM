import { PEAK_WINDOW_READ_BOOST, type ReceiptEventType } from "@resonate/shared";
import { config } from "./config";
import { recordConversion } from "./conversions";
import { getFunnel, type DelayRange } from "./funnels";
import { enqueueReceipt } from "./receipts";
import type { MessageRecord } from "./store";

/**
 * Rolls a message through its channel funnel (SPEC §7). The pure planner
 * (`rollLifecycle`) decides every outcome + delay up front; the standalone
 * server schedules those on real timers (`scheduleLifecycle`), while the
 * serverless path replays the same plan inside a single `waitUntil` window
 * (see simulate.ts). Both share one source of truth so the funnels can't drift.
 *
 * Every delay is divided by config.simSpeed, so SIM_SPEED=4 plays the whole
 * funnel out ~4x faster.
 */

/** Conversion lands 10–60s after the click (SPEC §7), scaled by sim speed. */
const CONVERSION_MIN_MS = 10_000;
const CONVERSION_MAX_MS = 60_000;

/** A single receipt event, with its delay measured from the lifecycle start. */
export interface PlannedEvent {
  readonly eventType: ReceiptEventType;
  readonly delayMs: number;
  readonly reason?: string;
}

/** The full rolled-out plan for one message: its events + optional conversion. */
export interface LifecyclePlan {
  readonly events: PlannedEvent[];
  /** Delay (from lifecycle start) at which an attributed order lands, or null. */
  readonly conversionDelayMs: number | null;
}

function jitter(range: DelayRange): number {
  const raw = range.minMs + Math.random() * (range.maxMs - range.minMs);
  return raw / config.simSpeed;
}

function pick<T>(items: readonly T[], fallback: T): T {
  if (items.length === 0) {
    return fallback;
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? fallback;
}

/**
 * Rolls one message's funnel and returns its events with delays relative to the
 * lifecycle start. Pure except for Math.random — no timers, no I/O — so it can
 * be replayed on real timers or compressed into a single request.
 */
export function rollLifecycle(record: MessageRecord): LifecyclePlan {
  const funnel = getFunnel(record.channel);
  const deliveryDelay = jitter(funnel.deliveryDelay);

  // 1. Delivered vs failed.
  if (Math.random() >= funnel.deliveredRate) {
    const reason = pick(funnel.failureReasons, "failed");
    return { events: [{ eventType: "failed", delayMs: deliveryDelay, reason }], conversionDelayMs: null };
  }

  const events: PlannedEvent[] = [{ eventType: "delivered", delayMs: deliveryDelay }];

  // 2. Read (channels without a read signal — e.g. SMS — roll clicks off
  //    delivery instead).
  let clickBaseDelay = deliveryDelay;
  if (funnel.readRate !== null && funnel.readDelay !== null) {
    // Send-Time Intelligence: a message landing in the customer's peak window
    // reads at a boosted rate — this is the open-rate lift the analytics report.
    const readRate = record.peakWindow
      ? Math.min(0.96, funnel.readRate * PEAK_WINDOW_READ_BOOST)
      : funnel.readRate;
    if (Math.random() < readRate) {
      const readDelay = deliveryDelay + jitter(funnel.readDelay);
      events.push({ eventType: "read", delayMs: readDelay });
      clickBaseDelay = readDelay;
    } else {
      // Not read → no click follows a read that never happened.
      return { events, conversionDelayMs: null };
    }
  }

  // 3. Clicked, off whichever base step applies.
  if (Math.random() < funnel.clickedRate) {
    const clickDelay = clickBaseDelay + jitter(funnel.clickDelay);
    events.push({ eventType: "clicked", delayMs: clickDelay });

    // 4. Conversion loop: a fraction of clickers place an attributed order
    //    10–60s later (SPEC §7), powering the campaign's attributed revenue.
    if (Math.random() < config.conversionRate) {
      const conversionDelayMs =
        clickDelay +
        (CONVERSION_MIN_MS + Math.random() * (CONVERSION_MAX_MS - CONVERSION_MIN_MS)) /
          config.simSpeed;
      return { events, conversionDelayMs };
    }
  }

  return { events, conversionDelayMs: null };
}

/**
 * Standalone-server scheduling: rolls the funnel and fires each receipt event
 * on its own jittered timer, stamping occurredAt with the actual fire time.
 * (The serverless path uses rollLifecycle directly — see simulate.ts.)
 */
export function scheduleLifecycle(vendorMessageId: string, record: MessageRecord): void {
  const plan = rollLifecycle(record);

  for (const event of plan.events) {
    setTimeout(() => {
      enqueueReceipt({
        vendorMessageId,
        eventType: event.eventType,
        occurredAt: new Date().toISOString(),
        ...(event.reason !== undefined ? { reason: event.reason } : {}),
      });
    }, event.delayMs);
  }

  if (plan.conversionDelayMs !== null) {
    setTimeout(() => {
      void recordConversion(record);
    }, plan.conversionDelayMs);
  }
}
