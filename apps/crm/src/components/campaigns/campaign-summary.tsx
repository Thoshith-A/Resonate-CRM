"use client";

import { useCallback, useEffect, useState } from "react";
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
 * AI performance summary (SPEC §9.3). Generated once on mount from the
 * campaign's real computed stats, with a manual regenerate button — it does
 * NOT ride the 3s insights poll (the model call is expensive and the prose
 * needn't change every tick).
 */
export function CampaignSummary({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [runKey, setRunKey] = useState(0);

  const regenerate = useCallback(() => setRunKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState({ status: "loading" });

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
          setState({ status: "loaded", data });
        }
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to generate summary.",
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [campaignId, runKey]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-copper" />
            AI summary
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={regenerate}
            disabled={state.status === "loading"}
            className="text-muted-foreground"
          >
            <RefreshCw className={state.status === "loading" ? "size-4 animate-spin" : "size-4"} />
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
