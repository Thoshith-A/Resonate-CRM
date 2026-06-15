import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.loadEnvFile(resolve("apps/crm/.env"));
}
const BASE = "http://localhost:3000";
const prisma = new PrismaClient();

type Seg = { id: string; name: string; lastPreviewCount: number | null };

async function main() {
  const { segments } = (await (await fetch(`${BASE}/api/segments`)).json()) as { segments: Seg[] };
  // A medium, mixed segment: fast to route (< maxDuration) but diverse signals.
  const candidates = segments
    .filter((s) => (s.lastPreviewCount ?? 0) >= 50 && (s.lastPreviewCount ?? 0) <= 600)
    .sort((a, b) => (a.lastPreviewCount ?? 0) - (b.lastPreviewCount ?? 0));
  const seg = candidates[0] ?? segments[0];
  if (!seg) {
    console.log("no segments — create one first");
    return;
  }
  console.log(`segment: "${seg.name}" (${seg.lastPreviewCount} customers)`);

  console.log("\n=== POST /api/ai/route-preview ===");
  const preview = await (
    await fetch(`${BASE}/api/ai/route-preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ segmentId: seg.id }),
    })
  ).json();
  console.log("distribution:", JSON.stringify(preview.distribution));
  console.log("estimatedBlendedCtr:", preview.estimatedBlendedCtr, "%");
  for (const r of preview.sampleReasons ?? [])
    console.log(`  ${r.customerId.slice(0, 8)} → ${r.channel} · ${r.reason}`);

  console.log("\n=== create AI_ROUTED campaign + send ===");
  const camp = await (
    await fetch(`${BASE}/api/campaigns`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "AI-routed test",
        objective: "win them back with 15% off",
        segmentId: seg.id,
        channel: "WHATSAPP",
        channelStrategy: "AI_ROUTED",
        messageTemplate: "Hi {{first_name}}, 15% off your next Brewline order in {{city}}. ☕",
      }),
    })
  ).json();
  console.log("campaign:", camp.id, "| strategy:", camp.channelStrategy);
  const sent = await (await fetch(`${BASE}/api/campaigns/${camp.id}/send`, { method: "POST" })).json();
  console.log("send:", JSON.stringify(sent));

  console.log("\n=== DB: per-customer channels (proves routing) ===");
  const byChannel = await prisma.communicationLog.groupBy({
    by: ["channel"],
    where: { campaignId: camp.id },
    _count: { _all: true },
  });
  for (const g of byChannel) console.log(`  ${g.channel}: ${g._count._all}`);

  const sampleRows = await prisma.communicationLog.findMany({
    where: { campaignId: camp.id },
    select: { channel: true, routingReason: true },
    take: 6,
  });
  console.log("sample rows (channel · routingReason):");
  for (const r of sampleRows) console.log(`  ${r.channel} · ${r.routingReason}`);

  const campaign = await prisma.campaign.findUnique({
    where: { id: camp.id },
    select: { channel: true, channelStrategy: true, variantMeta: true },
  });
  const meta = campaign?.variantMeta as Record<string, unknown> | null;
  console.log(`\ncampaign.channel (plurality winner): ${campaign?.channel} | strategy: ${campaign?.channelStrategy}`);
  console.log("variantMeta.routingSummary:", JSON.stringify(meta?.routingSummary));

  const distinct = byChannel.length;
  const everyReason = sampleRows.length > 0 && sampleRows.every((r) => r.routingReason);
  console.log(`\n${distinct >= 2 ? "✓" : "✗"} multiple channels assigned (${distinct} distinct)`);
  console.log(`${everyReason ? "✓" : "✗"} every sampled row has a routingReason`);
  console.log(distinct >= 2 && everyReason ? "\nAI CHANNEL ROUTER WORKS ✓" : "\nCHECK FAILED ✗");
  process.exitCode = distinct >= 2 && everyReason ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
