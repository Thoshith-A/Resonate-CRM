"use client";

import { useEffect, useMemo, useRef } from "react";
import { STATUS_HEX, type DeliveryStatus } from "@/lib/delivery-particles";

type CampaignStatus = "DRAFT" | "SENDING" | "COMPLETED" | "FAILED";

interface DeliveryUniverseProps {
  particles: Array<{ id: string; status: DeliveryStatus }>;
  campaignName: string;
  campaignStatus: CampaignStatus;
}

// ── Status → visual encoding (the soul of the component) ──────────────────────
const ORDER: DeliveryStatus[] = ["QUEUED", "SENT", "DELIVERED", "READ", "CLICKED", "FAILED"];
const CODE: Record<DeliveryStatus, number> = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  CLICKED: 4,
  FAILED: 5,
};
// Fill colours as RGB triples (indexed by code), so they can be lerped.
const FILL: ReadonlyArray<readonly [number, number, number]> = [
  [30, 34, 53], // QUEUED   #1e2235
  [59, 79, 212], // SENT    #3b4fd4
  [34, 197, 94], // DELIVERED #22c55e
  [167, 139, 250], // READ   #a78bfa
  [245, 158, 11], // CLICKED #f59e0b
  [63, 29, 29], // FAILED   #3f1d1d
];
const GLOW_CSS = ["", "rgb(59,79,212)", "rgb(34,197,94)", "rgb(196,181,253)", "rgb(251,191,36)", ""];
const GLOW_RADIUS = [0, 6, 10, 14, 20, 0];
const LABEL: Record<DeliveryStatus, string> = {
  QUEUED: "Queued",
  SENT: "Sent",
  DELIVERED: "Delivered, not read",
  READ: "Read / Opened",
  CLICKED: "Clicked",
  FAILED: "Failed",
};

const BASE_R = 2.5;
const CLICKED_R = 4.5;
const FAILED_R = 1.5;
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // golden angle ≈ 137.508°
const TRANSITION_MS = 600;
const RING_MS = 900;
const RING_MAX = 40;
const BG = "#08090d";
const MAX_RINGS = 600;

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

type Ring = { x: number; y: number; start: number };

type Engine = {
  n: number;
  x: Float32Array; // base layout positions (CSS px)
  y: Float32Array;
  phase: Float32Array; // per-particle phase offset (drift/shimmer)
  disp: Uint8Array; // status code transitioning FROM
  tgt: Uint8Array; // status code transitioning TO (current)
  transStart: Float32Array; // ms timestamp the transition began (0 = settled)
  rings: Ring[];
};

function codesFrom(particles: Array<{ status: DeliveryStatus }>): Uint8Array {
  const out = new Uint8Array(particles.length);
  for (let i = 0; i < particles.length; i += 1) out[i] = CODE[particles[i]!.status];
  return out;
}

function layout(engine: Engine, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = 0.8 * (Math.min(w, h) / 2);
  const n = engine.n;
  for (let i = 0; i < n; i += 1) {
    const r = Math.sqrt((i + 0.5) / n) * maxR;
    const a = i * GOLDEN;
    engine.x[i] = cx + r * Math.cos(a);
    engine.y[i] = cy + r * Math.sin(a);
  }
}

export function DeliveryUniverse({ particles, campaignName, campaignStatus }: DeliveryUniverseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const dims = useRef({ w: 0, h: 0, dpr: 1 });
  // Latest props for the rAF loop / sync without re-subscribing.
  const particlesRef = useRef(particles);
  particlesRef.current = particles;

  // ── HUD data (React-driven; never touches the canvas) ──
  const counts = useMemo(() => {
    const c: Record<DeliveryStatus, number> = {
      QUEUED: 0,
      SENT: 0,
      DELIVERED: 0,
      READ: 0,
      CLICKED: 0,
      FAILED: 0,
    };
    for (const p of particles) c[p.status] += 1;
    return c;
  }, [particles]);
  const total = particles.length;

  // ── Sync incoming statuses into the engine + start transitions ──
  useEffect(() => {
    const next = codesFrom(particles);
    const n = next.length;
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    let engine = engineRef.current;

    if (!engine || engine.n !== n) {
      // (Re)initialise — no transitions/rings on first paint or a size change.
      engine = {
        n,
        x: new Float32Array(n),
        y: new Float32Array(n),
        phase: new Float32Array(n),
        disp: next.slice(),
        tgt: next.slice(),
        transStart: new Float32Array(n),
        rings: [],
      };
      for (let i = 0; i < n; i += 1) engine.phase[i] = (i * GOLDEN) % (Math.PI * 2);
      if (dims.current.w > 0) layout(engine, dims.current.w, dims.current.h);
      engineRef.current = engine;
      return;
    }

    // Diff against the current target; begin eased transitions for changes.
    for (let i = 0; i < n; i += 1) {
      const to = next[i]!;
      if (to !== engine.tgt[i]) {
        engine.disp[i] = engine.tgt[i]!; // settle the previous target as the "from"
        engine.tgt[i] = to;
        engine.transStart[i] = now;
        if (to === 4 && engine.rings.length < MAX_RINGS) {
          engine.rings.push({ x: engine.x[i]!, y: engine.y[i]!, start: now });
        }
      }
    }
  }, [particles]);

  // ── Canvas setup, resize, and the rAF draw loop (reads refs only) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dims.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const engine = engineRef.current;
      if (engine && w > 0) layout(engine, w, h);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (document.visibilityState !== "visible") return;

      const { w, h } = dims.current;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      const engine = engineRef.current;
      const now = performance.now();

      if (!engine || engine.n === 0) {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "14px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Waiting for campaign data…", w / 2, h / 2);
        return;
      }

      const big = engine.n > 5000;
      const glowScale = big ? 0.5 : 1;
      const driftAmp = big ? 0.6 : 1;
      const { x, y, phase, disp, tgt, transStart, rings } = engine;

      for (let i = 0; i < engine.n; i += 1) {
        const to = tgt[i]!;
        const from = disp[i]!;
        const ts = transStart[i]!;
        const t = ts > 0 ? Math.min((now - ts) / TRANSITION_MS, 1) : 1;
        const e = easeOutCubic(t);

        // Colour (lerp from→to) and glow radius (lerp too) over the transition.
        const f0 = FILL[from]!;
        const f1 = FILL[to]!;
        const r = Math.round(f0[0] + (f1[0] - f0[0]) * e);
        const g = Math.round(f0[1] + (f1[1] - f0[1]) * e);
        const b = Math.round(f0[2] + (f1[2] - f0[2]) * e);
        const glow = (GLOW_RADIUS[from]! + (GLOW_RADIUS[to]! - GLOW_RADIUS[from]!) * e) * glowScale;

        let px = x[i]!;
        let py = y[i]!;
        let radius = BASE_R;
        let alpha = 1;
        const ph = phase[i]!;

        switch (to) {
          case 1: // SENT — slow sine drift (±1px, ~4s), each particle out of phase
            px += Math.sin(now * 0.0016 + ph) * driftAmp;
            py += Math.cos(now * 0.0016 + ph) * driftAmp;
            break;
          case 2: // DELIVERED — gentle 1.2s radius pulse
            radius = BASE_R * (1 + 0.18 * Math.sin(now * (Math.PI * 2 / 1200) + ph));
            break;
          case 3: // READ — soft shimmer (opacity oscillation)
            if (!big) alpha = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.0025 + ph));
            break;
          case 4: // CLICKED — pulse toward 4.5px (the burst ring is separate)
            radius = CLICKED_R * (1 + 0.14 * Math.sin(now * 0.004 + ph));
            break;
          case 5: // FAILED — shrink, static
            radius = FAILED_R;
            break;
          default: // QUEUED — static
            break;
        }

        if (glow > 0.5) {
          ctx.shadowBlur = glow;
          ctx.shadowColor = GLOW_CSS[to] || GLOW_CSS[from] || "transparent";
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // One-shot CLICKED rings: expand 0→40px, fade 1→0 over 900ms.
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.5;
      let w0 = 0;
      for (let i = 0; i < rings.length; i += 1) {
        const ring = rings[i]!;
        const rt = (now - ring.start) / RING_MS;
        if (rt >= 1) continue;
        ctx.globalAlpha = 1 - rt;
        ctx.strokeStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, rt * RING_MAX, 0, Math.PI * 2);
        ctx.stroke();
        rings[w0] = ring; // compact live rings in place (no per-frame alloc)
        w0 += 1;
      }
      rings.length = w0;
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const live = campaignStatus === "SENDING";
  const final = campaignStatus === "COMPLETED";

  return (
    <div
      ref={containerRef}
      className="relative h-[500px] w-full"
      style={{ backgroundColor: BG }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" />

      {/* Top-left: live status badges + caption */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1.5 font-mono text-xs tabular-nums">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {ORDER.filter((s) => counts[s] > 0).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-white/80">
              <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_HEX[s] }} />
              {counts[s].toLocaleString("en-IN")}
            </span>
          ))}
        </div>
        <div className="text-white/35">
          {total.toLocaleString("en-IN")} messages · {campaignName}
        </div>
      </div>

      {/* Top-right: legend (hover) */}
      <div className="group pointer-events-auto absolute right-4 top-4">
        <span className="flex size-6 cursor-default items-center justify-center rounded-md border border-white/10 bg-white/5 font-mono text-xs text-white/50">
          ?
        </span>
        <div className="invisible absolute right-0 top-7 z-10 w-44 rounded-lg border border-white/10 bg-[#0c0e14] p-2.5 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-white/40">
            Legend
          </p>
          <ul className="flex flex-col gap-1">
            {ORDER.map((s) => (
              <li key={s} className="flex items-center gap-2 text-xs text-white/70">
                <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_HEX[s] }} />
                {LABEL[s]}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom-right: live / final indicator */}
      <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-xs uppercase tracking-widest">
        {live ? (
          <span className="flex items-center gap-2 text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        ) : final ? (
          <span className="text-white/30">Final</span>
        ) : null}
      </div>
    </div>
  );
}
