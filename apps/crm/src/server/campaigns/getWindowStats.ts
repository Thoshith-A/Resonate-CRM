import { WINDOW_ORDER, type WindowStatRow, type WindowStatsResponse } from "@resonate/shared";
import { prisma } from "../db";

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Per-window delivery analytics for a SMART_WINDOWS campaign (SPEC §5). Pure DB
 * aggregation: GROUP BY (sendWindow, status), then derive each window's read
 * rate (read / delivered) and the send-weighted lift vs the MORNING baseline
 * (MORNING = the no-optimization default).
 */
export async function getWindowStats(campaignId: string): Promise<WindowStatsResponse> {
  const groups = await prisma.communicationLog.groupBy({
    by: ["sendWindow", "status"],
    where: { campaignId, sendWindow: { not: null } },
    _count: { _all: true },
  });

  const tally = new Map<string, { sent: number; delivered: number; read: number }>();
  for (const g of groups) {
    if (!g.sendWindow) continue;
    const t = tally.get(g.sendWindow) ?? { sent: 0, delivered: 0, read: 0 };
    const n = g._count._all;
    // Forward-only: a READ row was also delivered & sent, etc.
    if (g.status === "SENT" || g.status === "DELIVERED" || g.status === "READ" || g.status === "CLICKED") {
      t.sent += n;
    }
    if (g.status === "DELIVERED" || g.status === "READ" || g.status === "CLICKED") {
      t.delivered += n;
    }
    if (g.status === "READ" || g.status === "CLICKED") {
      t.read += n;
    }
    tally.set(g.sendWindow, t);
  }

  const windows: WindowStatRow[] = WINDOW_ORDER.filter((w) => (tally.get(w)?.sent ?? 0) > 0).map(
    (w) => {
      const t = tally.get(w)!;
      return {
        window: w,
        sent: t.sent,
        delivered: t.delivered,
        read: t.read,
        readRate: t.delivered > 0 ? round1((t.read / t.delivered) * 100) : 0,
      };
    },
  );

  const baseline = windows.find((w) => w.window === "MORNING")?.readRate ?? 0;
  const optimized = windows.filter((w) => w.window !== "MORNING");
  const optSent = optimized.reduce((s, w) => s + w.sent, 0);
  const liftPp =
    optSent > 0
      ? round1(optimized.reduce((s, w) => s + w.sent * (w.readRate - baseline), 0) / optSent)
      : 0;

  return { windows, baselineReadRate: baseline, liftPp };
}
