import { prisma } from "../db";

export type FeedItem = {
  id: string;
  customerName: string;
  channel: string;
  status: string;
  failureReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  clickedAt: string | null;
  updatedAt: string;
};

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

/**
 * Most-recently-updated communications for a campaign — the live delivery
 * feed (polled every 3s). Ordered by updatedAt so freshly-flipped rows
 * surface to the top as receipts land.
 */
export async function getCampaignFeed(
  campaignId: string,
  limit = DEFAULT_LIMIT,
): Promise<FeedItem[]> {
  const take = Math.min(MAX_LIMIT, Math.max(1, limit));
  const rows = await prisma.communicationLog.findMany({
    where: { campaignId },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      channel: true,
      status: true,
      failureReason: true,
      sentAt: true,
      deliveredAt: true,
      readAt: true,
      clickedAt: true,
      updatedAt: true,
      customer: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    customerName: row.customer.name,
    channel: row.channel,
    status: row.status,
    failureReason: row.failureReason,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    clickedAt: row.clickedAt ? row.clickedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  }));
}
