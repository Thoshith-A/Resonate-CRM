"use client";

import type { Channel, RoutePreviewResponse } from "@resonate/shared";
import { CHANNEL_CTR } from "@resonate/shared";
import { cn } from "@/lib/utils";

/** Channel brand colours for the routing bar / badges (per the feature spec). */
export const CHANNEL_HEX: Record<Channel, string> = {
  WHATSAPP: "#22c55e",
  EMAIL: "#3b4fd4",
  SMS: "#94a3b8",
  RCS: "#a78bfa",
};
const CHANNEL_LABEL: Record<Channel, string> = {
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  EMAIL: "Email",
  RCS: "RCS",
};
const CHANNELS: Channel[] = ["WHATSAPP", "SMS", "EMAIL", "RCS"];
const AI_PURPLE = "#a78bfa";

export type ChannelStrategy = "SINGLE" | "AI_ROUTED";

export type RoutePreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; data: RoutePreviewResponse };

function Sparkle({ className }: { className?: string }) {
  // Inline 4-point sparkle — no icon-library dependency.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </svg>
  );
}

export function ChannelSelector({
  channel,
  strategy,
  onChannelChange,
  onStrategyChange,
}: {
  channel: Channel;
  strategy: ChannelStrategy;
  onChannelChange: (channel: Channel) => void;
  onStrategyChange: (strategy: ChannelStrategy) => void;
}) {
  const aiSelected = strategy === "AI_ROUTED";

  return (
    <div className="flex flex-col gap-3">
      {/* CSS-only shimmer keyframe (scoped; no JS, no globals edit). */}
      <style>{"@keyframes ai-router-shimmer{0%{background-position:0% 50%}100%{background-position:200% 50%}}"}</style>

      {/* Option 1 — Let Resonate decide */}
      <button
        type="button"
        onClick={() => onStrategyChange("AI_ROUTED")}
        aria-pressed={aiSelected}
        className={cn(
          "relative overflow-hidden rounded-xl border px-4 py-3 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          aiSelected ? "border-transparent" : "border-border/60 opacity-90 hover:opacity-100",
        )}
        style={{
          backgroundImage:
            "linear-gradient(110deg, #14121d 28%, #2a2342 50%, #14121d 72%)",
          backgroundSize: "200% 100%",
          animation: "ai-router-shimmer 7s linear infinite",
          ...(aiSelected
            ? { boxShadow: `0 0 0 2px ${AI_PURPLE}, 0 0 24px -6px ${AI_PURPLE}` }
            : {}),
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${AI_PURPLE}22`, color: AI_PURPLE }}
          >
            <Sparkle className="size-4" />
          </span>
          <div className="flex flex-col">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              Let Resonate decide
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: AI_PURPLE }}
              >
                Recommended
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              Picks the best channel per customer for highest click-through
            </span>
          </div>
        </div>
      </button>

      {/* Options 2–5 — the four channels */}
      <div
        className={cn(
          "grid grid-cols-2 gap-2 transition-opacity",
          aiSelected && "opacity-40",
        )}
      >
        {CHANNELS.map((c) => {
          const selected = !aiSelected && c === channel;
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                onStrategyChange("SINGLE");
                onChannelChange(c);
              }}
              aria-pressed={selected}
              title={aiSelected ? "Overridden by AI router" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "border-primary ring-2 ring-primary"
                  : "border-border/60 hover:border-foreground/30",
              )}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: CHANNEL_HEX[c] }}
              />
              {CHANNEL_LABEL[c]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Compute integer percentages (whatsapp/rcs/email/sms) that sum to ~100. */
function toPercents(d: RoutePreviewResponse["distribution"]): Record<Channel, number> {
  const total = d.whatsapp + d.sms + d.email + d.rcs || 1;
  return {
    WHATSAPP: Math.round((d.whatsapp / total) * 100),
    RCS: Math.round((d.rcs / total) * 100),
    EMAIL: Math.round((d.email / total) * 100),
    SMS: Math.round((d.sms / total) * 100),
  };
}

/** One-line "✦ AI-routed · WhatsApp 52% · Email 23% · …" summary for review/badges. */
export function routedSummaryText(d: RoutePreviewResponse["distribution"]): string {
  const pct = toPercents(d);
  const parts = CHANNELS.filter((c) => pct[c] > 0)
    .sort((a, b) => pct[b] - pct[a])
    .map((c) => `${CHANNEL_LABEL[c]} ${pct[c]}%`);
  return `✦ AI-routed · ${parts.join(" · ")}`;
}

export function RoutePreviewCard({
  state,
  onRecompute,
}: {
  state: RoutePreviewState;
  onRecompute?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: AI_PURPLE }}>
          <Sparkle className="size-3.5" /> Routing preview
        </div>
        {onRecompute && state.status === "loaded" ? (
          <button
            type="button"
            onClick={onRecompute}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Recompute
          </button>
        ) : null}
      </div>

      {state.status === "loading" || state.status === "idle" ? (
        <div className="flex flex-col gap-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ) : state.status === "error" ? (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      ) : (
        <RoutePreviewBody data={state.data} />
      )}
    </div>
  );
}

function RoutePreviewBody({ data }: { data: RoutePreviewResponse }) {
  const { distribution, sampleReasons, estimatedBlendedCtr } = data;
  const total = distribution.whatsapp + distribution.sms + distribution.email + distribution.rcs;
  const pct = toPercents(distribution);

  return (
    <div className="flex flex-col gap-3">
      {/* Stacked distribution bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {CHANNELS.map((c) =>
          pct[c] > 0 ? (
            <div
              key={c}
              style={{ width: `${pct[c]}%`, backgroundColor: CHANNEL_HEX[c] }}
              title={`${c}: ${pct[c]}%`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {CHANNELS.filter((c) => pct[c] > 0).map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: CHANNEL_HEX[c] }} />
            {CHANNEL_LABEL[c]} {pct[c]}%
          </span>
        ))}
      </div>

      <div className="text-sm">
        <span className="text-muted-foreground">Est. blended CTR: </span>
        <span className="font-medium tabular-nums" style={{ color: AI_PURPLE }}>
          {estimatedBlendedCtr.toFixed(1)}%
        </span>
        <span className="text-xs text-muted-foreground">
          {" "}
          · vs {CHANNEL_CTR.WHATSAPP}% all-WhatsApp · sampled {total}
        </span>
      </div>

      {sampleReasons.length > 0 && (
        <ul className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
          {sampleReasons.slice(0, 3).map((r) => (
            <li key={r.customerId} className="truncate">
              {r.customerId.slice(0, 8)} → {CHANNEL_LABEL[r.channel]} · {r.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
