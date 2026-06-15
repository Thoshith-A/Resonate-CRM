import { PEAK_WINDOW_READ_BOOST, type ReceiptEventType } from "@resonate/shared";
import { config } from "./config";
import { recordConversion } from "./conversions";
import { getFunnel, type DelayRange } from "./funnels";
import { enqueueReceipt } from "./receipts";
import type { MessageRecord } from "./store";

/**
 * Rolls a message through its channel funnel and schedules the resulting
 * receipt events on jittered timers (SPEC §7). Every delay is divided by
 * config.simSpeed, so SIM_SPEED=4 plays the whole funnel out ~4x faster.
 */

/** Conversion lands 10–60s after the click (SPEC §7), scaled by sim speed. */
const CONVERSION_MIN_MS = 10_000;
const CONVERSION_MAX_MS = 60_000;

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
 * Schedules a single receipt event to fire `delayMs` from now, stamping
 * occurredAt with the actual fire time.
 */
function scheduleEvent(
  vendorMessageId: string,
  eventType: ReceiptEventType,
  delayMs: number,
  reason?: string,
): void {
  setTimeout(() => {
    enqueueReceipt({
      vendorMessageId,
      eventType,
      occurredAt: new Date().toISOString(),
      ...(reason !== undefined ? { reason } : {}),
    });
  }, delayMs);
}

export function scheduleLifecycle(vendorMessageId: string, record: MessageRecord): void {
  const funnel = getFunnel(record.channel);
  const deliveryDelay = jitter(funnel.deliveryDelay);

  // 1. Delivered vs failed.
  if (Math.random() >= funnel.deliveredRate) {
    const reason = pick(funnel.failureReasons, "failed");
    scheduleEvent(vendorMessageId, "failed", deliveryDelay, reason);
    return;
  }

  scheduleEvent(vendorMessageId, "delivered", deliveryDelay);

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
      scheduleEvent(vendorMessageId, "read", readDelay);
      clickBaseDelay = readDelay;
    } else {
      // Not read → no click follows a read that never happened.
      return;
    }
  }

  // 3. Clicked, off whichever base step applies.
  if (Math.random() < funnel.clickedRate) {
    const clickDelay = clickBaseDelay + jitter(funnel.clickDelay);
    scheduleEvent(vendorMessageId, "clicked", clickDelay);

    // 4. Conversion loop: a fraction of clickers place an attributed order
    //    10–60s later (SPEC §7), powering the campaign's attributed revenue.
    if (Math.random() < config.conversionRate) {
      const convDelay =
        clickDelay +
        (CONVERSION_MIN_MS + Math.random() * (CONVERSION_MAX_MS - CONVERSION_MIN_MS)) /
          config.simSpeed;
      setTimeout(() => {
        void recordConversion(record);
      }, convDelay);
    }
  }
}
