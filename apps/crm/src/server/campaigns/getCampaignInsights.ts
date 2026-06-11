import type { MessageStatus } from "@prisma/client";
import { prisma } from "../db";
import { notFound } from "../api";

export type CampaignStatusCounts = Record<MessageStatus, number>;

/** Cumulative, forward-only funnel: each stage ⊇ the next. */
export type CampaignFunnel = {
  audience: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
};

export type FailureBucket = { reason: string; count: number };

export type CampaignInsights = {
  id: string;
  name: string;
  objective: string | null;
  segmentId: string;
  segmentName: string;
  channel: string;
  messageTemplate: string;
  status: string;
  audienceSize: number;
  createdAt: string;
  sentAt: string | null;
  statusCounts: CampaignStatusCounts;
  funnel: CampaignFunnel;
  failures: FailureBucket[];
  deliveredPct: number;
  readPct: number;
  clickedPct: number;
  attributedRevenue: number;
  attributedOrders: number;
};

const ZERO_COUNTS: CampaignStatusCounts = {
  QUEUED: 0,
  SENT: 0,
  FAILED: 0,
  DELIVERED: 0,
  READ: 0,
  CLICKED: 0,
};

const pct = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;

/**
 * Full insights for one campaign: cumulative funnel, failure breakdown,
 * headline rates, and attributed revenue (orders placed after a click —
 * populated once the Phase 6 conversion loop runs). Every number is a live
 * DB aggregate, so the page reconciles exactly with the raw tables.
 */
export async function getCampaignInsights(id: string): Promise<CampaignInsights> {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { segment: { select: { name: true } } },
  });
  if (!campaign) {
    throw notFound(`No campaign with id ${id}`);
  }

  const [statusGroups, failureGroups, revenue] = await Promise.all([
    prisma.communicationLog.groupBy({
      by: ["status"],
      where: { campaignId: id },
      _count: { _all: true },
    }),
    prisma.communicationLog.groupBy({
      by: ["failureReason"],
      where: { campaignId: id, status: "FAILED" },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { attributedCampaignId: id },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const statusCounts: CampaignStatusCounts = { ...ZERO_COUNTS };
  for (const row of statusGroups) {
    statusCounts[row.status] = row._count._all;
  }

  // Forward-only: a READ row was also delivered & sent, etc.
  const clicked = statusCounts.CLICKED;
  const read = statusCounts.READ + clicked;
  const delivered = statusCounts.DELIVERED + read;
  const sent = statusCounts.SENT + delivered;
  const failed = statusCounts.FAILED;
  const audience = campaign.audienceSize;

  const failures: FailureBucket[] = failureGroups
    .map((row) => ({ reason: row.failureReason ?? "unknown", count: row._count._all }))
    .sort((a, b) => b.count - a.count);

  return {
    id: campaign.id,
    name: campaign.name,
    objective: campaign.objective,
    segmentId: campaign.segmentId,
    segmentName: campaign.segment.name,
    channel: campaign.channel,
    messageTemplate: campaign.messageTemplate,
    status: campaign.status,
    audienceSize: campaign.audienceSize,
    createdAt: campaign.createdAt.toISOString(),
    sentAt: campaign.sentAt ? campaign.sentAt.toISOString() : null,
    statusCounts,
    funnel: { audience, sent, delivered, read, clicked, failed },
    failures,
    deliveredPct: pct(delivered, sent),
    readPct: pct(read, delivered),
    clickedPct: pct(clicked, delivered),
    attributedRevenue: revenue._sum.amount ?? 0,
    attributedOrders: revenue._count._all,
  };
}
