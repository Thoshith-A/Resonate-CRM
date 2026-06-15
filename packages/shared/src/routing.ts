import { z } from "zod";
import { ChannelSchema } from "./channel";

/**
 * Contracts for the AI Channel Router. One decision per customer; the router
 * batches these and the preview endpoint summarises them into a distribution.
 */

export const ChannelRoutingDecisionSchema = z.object({
  customerId: z.string().min(1),
  channel: ChannelSchema,
  /** One short sentence on why this channel won. */
  reason: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1),
});
export type ChannelRoutingDecision = z.infer<typeof ChannelRoutingDecisionSchema>;

/** Per-channel counts (lowercased keys for the UI bar). */
export const RoutingDistributionSchema = z.object({
  whatsapp: z.number().int().nonnegative(),
  sms: z.number().int().nonnegative(),
  email: z.number().int().nonnegative(),
  rcs: z.number().int().nonnegative(),
});
export type RoutingDistribution = z.infer<typeof RoutingDistributionSchema>;

export const RoutePreviewResponseSchema = z.object({
  distribution: RoutingDistributionSchema,
  sampleReasons: z.array(
    z.object({
      customerId: z.string(),
      channel: ChannelSchema,
      reason: z.string(),
    }),
  ),
  /** Audience-weighted CTR using the shared CHANNEL_CTR benchmarks (percentage points). */
  estimatedBlendedCtr: z.number(),
});
export type RoutePreviewResponse = z.infer<typeof RoutePreviewResponseSchema>;
