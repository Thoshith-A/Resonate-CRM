import { prisma } from "../db";

export type DashboardStats = {
  customers: number;
  campaigns: number;
  messagesSent: number;
  attributedRevenue: number;
};

export type DashboardCampaign = {
  id: string;
  name: string;
  channel: string;
  status: string;
  audienceSize: number;
  deliveredPct: number;
  clickedPct: number;
  revenue: number;
  createdAt: string;
};

export type Dashboard = {
  stats: DashboardStats;
  campaigns: DashboardCampaign[];
};

const SENT_STATUSES = ["SENT", "DELIVERED", "READ", "CLICKED"] as const;
const CAMPAIGN_LIMIT = 25;

const pct = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;

/**
 * Dashboard: four headline stats + the campaign history table. Per-campaign
 * delivery/click rates and revenue are computed from two grouped aggregates
 * (not N queries), so the whole table is a handful of round-trips.
 */
export async function getDashboard(): Promise<Dashboard> {
  const [customers, campaignsCount, statusGroups, revenueAgg, campaigns] = await Promise.all([
    prisma.customer.count(),
    prisma.campaign.count(),
    prisma.communicationLog.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.aggregate({
      where: { attributedCampaignId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, take: CAMPAIGN_LIMIT }),
  ]);

  const messagesSent = statusGroups
    .filter((g) => (SENT_STATUSES as readonly string[]).includes(g.status))
    .reduce((sum, g) => sum + g._count._all, 0);

  const campaignIds = campaigns.map((c) => c.id);

  const [perCampaignStatus, perCampaignRevenue] = await Promise.all([
    campaignIds.length
      ? prisma.communicationLog.groupBy({
          by: ["campaignId", "status"],
          where: { campaignId: { in: campaignIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    campaignIds.length
      ? prisma.order.groupBy({
          by: ["attributedCampaignId"],
          where: { attributedCampaignId: { in: campaignIds } },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
  ]);

  const statusByCampaign = new Map<string, Record<string, number>>();
  for (const row of perCampaignStatus) {
    const map = statusByCampaign.get(row.campaignId) ?? {};
    map[row.status] = row._count._all;
    statusByCampaign.set(row.campaignId, map);
  }
  const revenueByCampaign = new Map<string, number>();
  for (const row of perCampaignRevenue) {
    if (row.attributedCampaignId) {
      revenueByCampaign.set(row.attributedCampaignId, row._sum.amount ?? 0);
    }
  }

  const table: DashboardCampaign[] = campaigns.map((campaign) => {
    const counts = statusByCampaign.get(campaign.id) ?? {};
    const clicked = counts.CLICKED ?? 0;
    const read = (counts.READ ?? 0) + clicked;
    const delivered = (counts.DELIVERED ?? 0) + read;
    return {
      id: campaign.id,
      name: campaign.name,
      channel: campaign.channel,
      status: campaign.status,
      audienceSize: campaign.audienceSize,
      deliveredPct: pct(delivered, campaign.audienceSize),
      clickedPct: pct(clicked, campaign.audienceSize),
      revenue: revenueByCampaign.get(campaign.id) ?? 0,
      createdAt: campaign.createdAt.toISOString(),
    };
  });

  return {
    stats: {
      customers,
      campaigns: campaignsCount,
      messagesSent,
      attributedRevenue: revenueAgg._sum.amount ?? 0,
    },
    campaigns: table,
  };
}
