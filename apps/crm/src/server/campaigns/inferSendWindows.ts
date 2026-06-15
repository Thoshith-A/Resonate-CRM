import {
  IST_OFFSET_MINUTES,
  SEND_WINDOWS,
  windowForIstHour,
  type SendWindowName,
} from "@resonate/shared";

/**
 * Send-Time Intelligence — deterministic peak-window inference (NO AI call).
 * Buckets a customer's past order hours (in IST) into windows; if one window
 * dominates with enough volume it's a HIGH-confidence pick, else we default to
 * MORNING (the safe baseline) at LOW confidence.
 */

export type SendWindow = {
  window: SendWindowName;
  confidence: "HIGH" | "LOW";
  /** Minutes after campaign send to dispatch this customer (the real schedule). */
  delayMinutes: number;
};

const MIN_ORDERS_FOR_HIGH = 3;
const TOP_WINDOW_SHARE = 0.4;

/** Hour-of-day (0–23) in IST for a timestamp. */
function istHour(date: Date): number {
  return new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000).getUTCHours();
}

export function inferSendWindow(orders: { placedAt: Date }[]): SendWindow {
  const counts: Record<SendWindowName, number> = {
    MORNING: 0,
    AFTERNOON: 0,
    EVENING: 0,
    NIGHT: 0,
  };
  for (const order of orders) {
    counts[windowForIstHour(istHour(order.placedAt))] += 1;
  }

  const total = orders.length;
  let topWindow: SendWindowName = "MORNING";
  let topCount = -1;
  for (const w of ["MORNING", "AFTERNOON", "EVENING", "NIGHT"] as SendWindowName[]) {
    if (counts[w] > topCount) {
      topCount = counts[w];
      topWindow = w;
    }
  }

  const high = total >= MIN_ORDERS_FOR_HIGH && topCount >= total * TOP_WINDOW_SHARE;
  const window: SendWindowName = high ? topWindow : "MORNING";
  return {
    window,
    confidence: high ? "HIGH" : "LOW",
    delayMinutes: SEND_WINDOWS[window].delayMinutes,
  };
}
