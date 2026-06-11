import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.loadEnvFile(resolve("apps/crm/.env"));
}
const BASE = "http://localhost:3000";
const prisma = new PrismaClient();
const SENT_PLUS = ["SENT", "DELIVERED", "READ", "CLICKED"] as const;

let failures = 0;
function check(label: string, api: number, db: number) {
  const ok = api === db;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${label}: api=${api} db=${db}`);
}

async function main() {
  // ── Dashboard stats reconcile with raw DB ──
  const dash = await (await fetch(`${BASE}/api/dashboard`)).json();
  const [customers, campaigns, statusGroups, revenue] = await Promise.all([
    prisma.customer.count(),
    prisma.campaign.count(),
    prisma.communicationLog.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.aggregate({ where: { attributedCampaignId: { not: null } }, _sum: { amount: true } }),
  ]);
  const messagesSent = statusGroups
    .filter((g) => (SENT_PLUS as readonly string[]).includes(g.status))
    .reduce((s, g) => s + g._count._all, 0);

  console.log("dashboard stats:");
  check("customers", dash.stats.customers, customers);
  check("campaigns", dash.stats.campaigns, campaigns);
  check("messagesSent", dash.stats.messagesSent, messagesSent);
  check("attributedRevenue", dash.stats.attributedRevenue, revenue._sum.amount ?? 0);

  // ── Pick the largest campaign and reconcile its funnel ──
  const target = await prisma.campaign.findFirst({ orderBy: { audienceSize: "desc" } });
  if (!target) {
    console.log("no campaigns to reconcile");
    return;
  }
  const insights = await (await fetch(`${BASE}/api/campaigns/${target.id}`)).json();
  const g = await prisma.communicationLog.groupBy({
    by: ["status"],
    where: { campaignId: target.id },
    _count: { _all: true },
  });
  const c: Record<string, number> = {};
  for (const row of g) c[row.status] = row._count._all;
  const clicked = c.CLICKED ?? 0;
  const read = (c.READ ?? 0) + clicked;
  const delivered = (c.DELIVERED ?? 0) + read;
  const sent = (c.SENT ?? 0) + delivered;

  console.log(`\ncampaign funnel reconcile (${target.name}):`);
  check("funnel.clicked", insights.funnel.clicked, clicked);
  check("funnel.read", insights.funnel.read, read);
  check("funnel.delivered", insights.funnel.delivered, delivered);
  check("funnel.sent", insights.funnel.sent, sent);
  check("funnel.failed", insights.funnel.failed, c.FAILED ?? 0);
  check("funnel.audience", insights.funnel.audience, target.audienceSize);

  console.log(`\n${failures === 0 ? "ALL NUMBERS RECONCILE ✓" : `${failures} MISMATCH(ES) ✗`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
