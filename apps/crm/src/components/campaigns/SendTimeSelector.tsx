"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type SendStrategy = "INSTANT" | "SMART_WINDOWS";

const AI_PURPLE = "#a78bfa";

// Placeholder window mix until we have per-segment data (SPEC §6).
const PREVIEW_WINDOWS: Array<{ label: string; emoji: string; pct: number; color: string }> = [
  { label: "Morning", emoji: "🌅", pct: 35, color: "#fbbf24" },
  { label: "Afternoon", emoji: "☀️", pct: 25, color: "#f97316" },
  { label: "Evening", emoji: "🌆", pct: 30, color: "#a78bfa" },
  { label: "Night", emoji: "🌙", pct: 10, color: "#3b4fd4" },
];

function Bolt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function ClockSparkle({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={className} style={style}>
      <circle cx="11" cy="13" r="8" />
      <path d="M11 9v4l2.5 1.5" strokeLinecap="round" />
      <path d="M19 2l.7 2.3L22 5l-2.3.7L19 8l-.7-2.3L16 5l2.3-.7L19 2z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SendTimeSelector({
  strategy,
  onStrategyChange,
}: {
  strategy: SendStrategy;
  onStrategyChange: (strategy: SendStrategy) => void;
}) {
  const smart = strategy === "SMART_WINDOWS";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {/* Card 1 — Smart Windows (recommended, first) */}
        <button
          type="button"
          onClick={() => onStrategyChange("SMART_WINDOWS")}
          aria-pressed={smart}
          className={cn(
            "relative flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            smart ? "border-transparent bg-[#a78bfa]/5" : "border-border/60 opacity-90 hover:opacity-100",
          )}
          style={smart ? { boxShadow: `0 0 0 2px ${AI_PURPLE}, 0 0 24px -8px ${AI_PURPLE}` } : undefined}
        >
          <span
            className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: AI_PURPLE }}
          >
            Recommended
          </span>
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ClockSparkle className="size-4" style={{ color: AI_PURPLE }} /> Smart Windows
          </span>
          <span className="text-xs text-muted-foreground">
            Let Resonate decide the best time per customer for the highest click-through
          </span>
        </button>

        {/* Card 2 — Send Now */}
        <button
          type="button"
          onClick={() => onStrategyChange("INSTANT")}
          aria-pressed={!smart}
          className={cn(
            "flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            !smart ? "border-white/20 bg-white/5" : "border-border/60 opacity-70 hover:opacity-100",
          )}
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Bolt className="size-4 text-amber-300" /> Send Now
          </span>
          <span className="text-xs text-muted-foreground">All messages dispatch immediately</span>
        </button>
      </div>

      {smart && (
        <div className="flex flex-col gap-2 transition-all">
          <div className="flex gap-1.5">
            {PREVIEW_WINDOWS.map((w) => (
              <div
                key={w.label}
                className="flex min-w-[88px] flex-col rounded-lg px-2.5 py-1.5 text-xs"
                style={{ flexBasis: `${w.pct}%`, backgroundColor: `${w.color}22` }}
              >
                <span className="font-medium" style={{ color: w.color }}>
                  {w.emoji} {w.label}
                </span>
                <span className="tabular-nums text-muted-foreground">{w.pct}%</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Messages stagger across ~3 hours · No customer receives a late-night message unless they
            shop at night.
          </p>
        </div>
      )}
    </div>
  );
}
