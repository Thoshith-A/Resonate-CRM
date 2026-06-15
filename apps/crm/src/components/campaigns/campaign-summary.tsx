"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type CampaignSummaryData = {
  headline: string;
  narrative: string;
  recommendations: string[];
  degraded: boolean;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; data: CampaignSummaryData };

/**
 * Auto-refresh cadence while the campaign is still settling. The funnel keeps
 * moving (delivered → read → clicked) for a while after the send completes, so
 * we re-summarise on this interval until the numbers stop changing AND the
 * campaign is terminal — at which point "100% complete" the refresh halts.
 */
const REFRESH_MS = 5000;

/**
 * AI performance summary (SPEC §9.3). Generated from the campaign's real
 * computed stats. It auto-refreshes every {@link REFRESH_MS} while the funnel
 * is still moving, re-summarising ONLY when the numbers actually changed (the
 * `funnelKey`) so we never spend an AI call on identical stats. Once the
 * campaign is terminal and the funnel has settled, auto-refresh stops; a manual
 * regenerate button is always available.
 */
export function CampaignSummary({
  campaignId,
  funnelKey,
  isTerminal,
}: {
  campaignId: string;
  /** Signature of the stats the summary depends on; changes when numbers move. */
  funnelKey: string;
  /** True once the campaign status is COMPLETED or FAILED. */
  isTerminal: boolean;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [runKey, setRunKey] = useState(0);
  const [busy, setBusy] = useState(false);
  // The funnelKey reflected by the most recent successful generation.
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // Always-current mirrors so the fetch/interval closures read fresh values
  // without re-subscribing on every stats tick.
  const funnelKeyRef = useRef(funnelKey);
  funnelKeyRef.current = funnelKey;
  const busyRef = useRef(false);

  const regenerate = useCallback(() => setRunKey((key) => key + 1), []);

  // Fetch effect: mount, manual regenerate, and each auto-refresh bump runKey.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const keyAtStart = funnelKeyRef.current;
    busyRef.current = true;
    setBusy(true);
    // Keep the existing summary on screen during a refresh; only show the
    // skeleton on the very first load (no content yet).
    setState((prev) => (prev.status === "loaded" ? prev : { status: "loading" }));

    fetch("/api/ai/campaign-summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        return (await res.json()) as CampaignSummaryData;
      })
      .then((data) => {
        if (!cancelled) {
          setGeneratedKey(keyAtStart);
          setState({ status: "loaded", data });
        }
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setState((prev) =>
          // Don't replace a good summary with an error on a failed refresh —
          // keep the last good one and let the next tick retry.
          prev.status === "loaded"
            ? prev
            : {
                status: "error",
                message:
                  error instanceof Error ? error.message : "Failed to generate summary.",
              },
        );
      })
      .finally(() => {
        if (!cancelled) {
          busyRef.current = false;
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
      busyRef.current = false;
    };
  }, [campaignId, runKey]);

  // "Complete": the campaign is terminal and we've already summarised its
  // current (final) numbers — nothing left to refresh.
  const settled = isTerminal && generatedKey === funnelKey;
  const autoRefreshing = !settled;

  // Auto-refresh effect: tick while not settled; regenerate only when the
  // numbers moved since the last summary and no request is already in flight.
  useEffect(() => {
    if (settled) {
      return;
    }
    const interval = window.setInterval(() => {
      if (!busyRef.current && generatedKey !== funnelKeyRef.current) {
        setRunKey((key) => key + 1);
      }
    }, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [settled, generatedKey]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-copper" />
            AI summary
            {autoRefreshing ? (
              <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-copper opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-copper" />
                </span>
                Live
              </span>
            ) : null}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={regenerate}
            disabled={busy}
            className="text-muted-foreground"
          >
            <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {state.status === "loading" ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : state.status === "error" ? (
          <div className="py-4">
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={regenerate}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-base font-medium leading-snug">{state.data.headline}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{state.data.narrative}</p>
            {state.data.recommendations.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {state.data.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-copper" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {state.data.degraded ? (
              <p className="text-xs text-muted-foreground">
                Generated from stats — AI provider unavailable.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
