import type { Channel } from "./channel";

/**
 * Channel click-through benchmarks as PERCENTAGE POINTS (28 = 28% CTR).
 *
 * Shared by the AI Channel Router (server, `routeChannels`) and the routing
 * preview UI so both cite the EXACT same numbers — and so the model is told the
 * benchmarks rather than left to invent them. Treat as product constants.
 */
export const CHANNEL_CTR: Record<Channel, number> = {
  WHATSAPP: 28,
  RCS: 26,
  EMAIL: 9,
  SMS: 6,
};
