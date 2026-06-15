/**
 * Derives the DeliveryUniverse particle array from a campaign's live per-status
 * counts (the exact numbers the insights poll already returns) — no new API and
 * no per-row fetch. Every message becomes one particle; the WHICH-dot-is-which
 * mapping is a fixed seeded permutation so:
 *   - a particle's spatial position is stable across polls (only its status
 *     changes), and
 *   - status assignment is scattered across the field (not a central blob), so
 *     CLICKED bursts ripple everywhere, and
 *   - transitions are forward-only: as advanced counts grow, a given index can
 *     only move toward CLICKED (or into FAILED), never backward — matching the
 *     CommunicationLog state machine.
 */

export type DeliveryStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "CLICKED" | "FAILED";

export type ParticleDatum = { id: string; status: DeliveryStatus };

/**
 * Single source of truth for status colours, shared by the DeliveryUniverse
 * (particle dots + HUD), the funnel bars, and the stat values — so "Clicked"
 * is the same amber everywhere it appears.
 */
export const STATUS_HEX: Record<DeliveryStatus, string> = {
  QUEUED: "#5b627e",
  SENT: "#3b4fd4",
  DELIVERED: "#22c55e",
  READ: "#a78bfa",
  CLICKED: "#f59e0b",
  FAILED: "#ef6a6a",
};

// Fill order along the permutation: most-advanced first. As CLICKED/READ/…
// grow, their (scattered) permutation prefixes grow, pulling indices forward.
const FILL_ORDER: DeliveryStatus[] = [
  "CLICKED",
  "READ",
  "DELIVERED",
  "SENT",
  "QUEUED",
  "FAILED",
];

/** Small deterministic PRNG (mulberry32) so the scatter is identical every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const permCache = new Map<number, Uint32Array>();

/** A fixed shuffled order of [0..n) — cached, since a campaign's size is stable. */
function permutation(n: number): Uint32Array {
  const cached = permCache.get(n);
  if (cached) return cached;
  const arr = new Uint32Array(n);
  for (let i = 0; i < n; i += 1) arr[i] = i;
  const rnd = mulberry32(0x9e3779b9 ^ n);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  permCache.set(n, arr);
  return arr;
}

/**
 * Build the particle array from live status counts. Particle count = the sum of
 * counts (the real number of CommunicationLog rows). Returns [] when nothing has
 * been snapshotted yet (renders the "waiting" state).
 */
export function buildParticles(counts: Record<DeliveryStatus, number>): ParticleDatum[] {
  const total =
    counts.QUEUED + counts.SENT + counts.DELIVERED + counts.READ + counts.CLICKED + counts.FAILED;
  if (total <= 0) return [];

  const perm = permutation(total);
  const statuses = new Array<DeliveryStatus>(total);
  let pos = 0;
  for (const status of FILL_ORDER) {
    const c = counts[status];
    for (let k = 0; k < c; k += 1) {
      statuses[perm[pos]!] = status;
      pos += 1;
    }
  }

  const out = new Array<ParticleDatum>(total);
  for (let i = 0; i < total; i += 1) {
    out[i] = { id: `p${i}`, status: statuses[i] ?? "QUEUED" };
  }
  return out;
}

/** Cheap signature so callers can memoize particle rebuilds across identical polls. */
export function countsSignature(counts: Record<DeliveryStatus, number>): string {
  return `${counts.QUEUED}.${counts.SENT}.${counts.DELIVERED}.${counts.READ}.${counts.CLICKED}.${counts.FAILED}`;
}
