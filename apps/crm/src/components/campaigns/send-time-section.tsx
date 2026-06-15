"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { WindowStatsResponse } from "@resonate/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const POLL_MS = 3000;

const WINDOW_LABEL: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  NIGHT: "Night",
};
const WINDOW_COLOR: Record<string, string> = {
  MORNING: "#fbbf24",
  AFTERNOON: "#f97316",
  EVENING: "#a78bfa",
  NIGHT: "#3b4fd4",
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; data: WindowStatsResponse };

/**
 * Send-Time Intelligence analytics (SMART_WINDOWS only): per-window read rates +
 * the read-rate lift vs the MORNING baseline. Polls window-stats while the
 * campaign's waves are still landing.
 */
export function SendTimeSection({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const load = () => {
      fetch(`/api/campaigns/${campaignId}/window-stats`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          return (await res.json()) as WindowStatsResponse;
        })
        .then((data) => {
          if (!cancelled) setState({ status: "loaded", data });
        })
        .catch((error: unknown) => {
          if (cancelled || controller.signal.aborted) return;
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Failed to load window stats.",
          });
        });
    };
    load();
    const interval = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [campaignId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-4 text-[#a78bfa]" /> Send-Time Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.status === "loading" ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : state.status === "error" ? (
          <p className="text-sm text-muted-foreground">{state.message}</p>
        ) : (
          <Loaded data={state.data} />
        )}
      </CardContent>
    </Card>
  );
}

function Loaded({ data }: { data: WindowStatsResponse }) {
  const { windows, baselineReadRate, liftPp } = data;
  const hasLift = liftPp > 0;

  return (
    <>
      <div
        className="rounded-lg border px-4 py-3"
        style={
          hasLift
            ? { borderColor: "#a78bfa66", backgroundColor: "#a78bfa14" }
            : { borderColor: "var(--border)" }
        }
      >
        {hasLift ? (
          <p className="text-sm font-medium text-[#a78bfa]">
            ✦ Smart Windows lifted read rate by +{liftPp.toFixed(1)}pp on average across optimized
            windows
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No measurable lift this campaign</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">Window</th>
              <th className="py-2 text-right font-medium">Sent</th>
              <th className="py-2 text-right font-medium">Delivered</th>
              <th className="py-2 text-right font-medium">Read</th>
              <th className="py-2 text-right font-medium">Read rate</th>
              <th className="py-2 text-right font-medium">vs. baseline</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => {
              const diff = Math.round((w.readRate - baselineReadRate) * 10) / 10;
              const isBaseline = w.window === "MORNING";
              return (
                <tr key={w.window} className="border-b border-border/40 last:border-b-0">
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: WINDOW_COLOR[w.window] ?? "#94a3b8" }}
                      />
                      {WINDOW_LABEL[w.window] ?? w.window}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{w.sent.toLocaleString("en-IN")}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {w.delivered.toLocaleString("en-IN")}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{w.read.toLocaleString("en-IN")}</td>
                  <td className="py-2.5 text-right tabular-nums">{w.readRate.toFixed(1)}%</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {isBaseline ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <span
                        className={
                          diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-slate-500"
                        }
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)}pp {diff > 0 ? "↑" : diff < 0 ? "↓" : ""}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
