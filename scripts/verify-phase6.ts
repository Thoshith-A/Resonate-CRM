import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.loadEnvFile(resolve("apps/crm/.env"));
}
const BASE = "http://localhost:3000";
const prisma = new PrismaClient();

let failures = 0;
function check(label: string, api: number, db: number) {
  const ok = api === db;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${label}: api=${api} db=${db}`);
}

async function main() {
  // ── Every CAMPAIGN-attributed order is genuinely sourced from a campaign ──
  const [attributed, mislabelled] = await Promise.all([
    prisma.order.count({ where: { attributedCampaignId: { not: null } } }),
    prisma.order.count({ where: { attributedCampaignId: { not: null }, source: { not: "CAMPAIGN" } } }),
  ]);
  console.log("attribution integrity:");
  console.log(`  ${mislabelled === 0 ? "✓" : "✗"} all ${attributed} attributed orders have source=CAMPAIGN (mislabelled=${mislabelled})`);
  if (mislabelled !== 0) failures += 1;

  // Every attributed order must link to a real communication IN THE SAME
  // campaign (the hard invariant). The comm reaching CLICKED is eventually
  // consistent: conversion orders POST immediately, while click receipts fold
  // through the rate-limited (50 / 3s), shuffled webhook pipeline — so a
  // conversion can legitimately land before its own click receipt is folded.
  const sampleOrders = await prisma.order.findMany({
    where: { attributedCampaignId: { not: null } },
    select: { attributedCampaignId: true, attributedCommunicationId: true },
    take: 500,
  });
  let badLinks = 0;
  let clickedFolded = 0;
  for (const o of sampleOrders) {
    if (!o.attributedCommunicationId) {
      badLinks += 1;
      continue;
    }
    const comm = await prisma.communicationLog.findUnique({
      where: { id: o.attributedCommunicationId },
      select: { campaignId: true, status: true },
    });
    if (!comm || comm.campaignId !== o.attributedCampaignId) {
      badLinks += 1;
    } else if (comm.status === "CLICKED") {
      clickedFolded += 1;
    }
  }
  console.log(`  ${badLinks === 0 ? "✓" : "✗"} ${sampleOrders.length} sampled orders link to a comm in the same campaign (bad=${badLinks})`);
  console.log(`  · ${clickedFolded}/${sampleOrders.length} of those comms have already folded to CLICKED (rest still flushing — eventually consistent)`);
  if (badLinks !== 0) failures += 1;

  // ── Dashboard attributed revenue reconciles with the raw sum ──
  const dash = await (await fetch(`${BASE}/api/dashboard`)).json();
  const totalRevenue = await prisma.order.aggregate({
    where: { attributedCampaignId: { not: null } },
    _sum: { amount: true },
  });
  console.log("\ndashboard:");
  check("attributedRevenue", dash.stats.attributedRevenue, totalRevenue._sum.amount ?? 0);

  // ── Per-campaign insights revenue + orders reconcile ──
  const top = await prisma.order.groupBy({
    by: ["attributedCampaignId"],
    where: { attributedCampaignId: { not: null } },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 1,
  });
  if (top.length === 0 || !top[0]?.attributedCampaignId) {
    console.log("\nno attributed orders yet — run a campaign and let conversions land, then re-run.");
  } else {
    const id = top[0].attributedCampaignId;
    const insights = await (await fetch(`${BASE}/api/campaigns/${id}`)).json();
    console.log(`\ncampaign insights reconcile (${insights.name}):`);
    check("attributedRevenue", insights.attributedRevenue, top[0]._sum.amount ?? 0);
    check("attributedOrders", insights.attributedOrders, top[0]._count._all);
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASS ✓" : `${failures} FAILURE(S) ✗`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
