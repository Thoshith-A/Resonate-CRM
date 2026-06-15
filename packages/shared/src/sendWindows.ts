import { z } from "zod";

/**
 * Send-Time Intelligence constants — single source of truth shared by the
 * inference function (server), the channel sim, and the builder UI.
 */

export type SendWindowName = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";

export const WINDOW_ORDER: SendWindowName[] = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"];

/** IST hour ranges (inclusive) + dispatch delay (real minutes after send). */
export const SEND_WINDOWS: Record<
  SendWindowName,
  { label: string; delayMinutes: number }
> = {
  MORNING: { label: "Morning", delayMinutes: 0 }, //   06:00–11:59
  AFTERNOON: { label: "Afternoon", delayMinutes: 60 }, // 12:00–16:59
  EVENING: { label: "Evening", delayMinutes: 120 }, //  17:00–21:59
  NIGHT: { label: "Night", delayMinutes: 180 }, //      22:00–05:59
};

/** UTC+5:30. */
export const IST_OFFSET_MINUTES = 330;

/**
 * Demo compression: real delayMinutes are dispatched delayMinutes SECONDS apart
 * (1 real minute → this many ms) so all four waves play out in ~3 minutes on
 * screen. At production scale the staggered dispatch is a durable queue, not a
 * compressed setTimeout — see docs/decisions.md.
 */
export const WINDOW_DEMO_MS_PER_MINUTE = 40;

/**
 * Read-rate multiplier the sim applies to a message delivered in the customer's
 * inferred peak window (windowConfidence = HIGH) — this is what produces the
 * measurable open-rate lift the analytics section reports.
 */
export const PEAK_WINDOW_READ_BOOST = 1.3;

/** Map an IST hour (0–23) to its window. */
export function windowForIstHour(istHour: number): SendWindowName {
  if (istHour >= 6 && istHour <= 11) return "MORNING";
  if (istHour >= 12 && istHour <= 16) return "AFTERNOON";
  if (istHour >= 17 && istHour <= 21) return "EVENING";
  return "NIGHT";
}

/** Compressed dispatch delay (ms) for a window, for the demo setTimeout schedule. */
export function demoDispatchDelayMs(window: SendWindowName): number {
  return SEND_WINDOWS[window].delayMinutes * WINDOW_DEMO_MS_PER_MINUTE;
}

// ── window-stats API contract ────────────────────────────────────────────
export const WindowStatRowSchema = z.object({
  window: z.string(),
  sent: z.number().int(),
  delivered: z.number().int(),
  read: z.number().int(),
  readRate: z.number(),
});
export type WindowStatRow = z.infer<typeof WindowStatRowSchema>;

export const WindowStatsResponseSchema = z.object({
  windows: z.array(WindowStatRowSchema),
  baselineReadRate: z.number(),
  liftPp: z.number(),
});
export type WindowStatsResponse = z.infer<typeof WindowStatsResponseSchema>;
