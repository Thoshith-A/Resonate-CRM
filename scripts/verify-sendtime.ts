import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.loadEnvFile(resolve("apps/crm/.env"));
}
const BASE = "http://localhost:3000";
const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Seg = { id: string; name: string; lastPreviewCount: number | null };

async function bucketStatus(campaignId: string) {
  const rows = await prisma.communicationLog.groupBy({
    by: ["sendWindow", "status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const map = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const w = r.sendWindow ?? "—";
    const m = map.get(w) ?? {};
    m[r.status] = r._count._all;
    map.set(w, m);
  }
  for (const [w, m] of map) console.log(`  ${w}: ${JSON.stringify(m)}`);
}

async function main() {
  const { segments } = (await (await fetch(`${BASE}/api/segments`)).json()) as { segments: Seg[] };
  const seg =
    segments.filter((s) => (s.lastPreviewCount ?? 0) >= 50 && (s.lastPreviewCount ?? 0) <= 600)
      .sort((a, b) => (a.lastPreviewCount ?? 0) - (b.lastPreviewCount ?? 0))[0] ?? segments[0];
  if (!seg) return console.log("no segments");
  console.log(`segment: "${seg.name}" (${seg.lastPreviewCount})`);

  const camp = await (
    await fetch(`${BASE}/api/campaigns`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Smart Windows test",
        segmentId: seg.id,
        channel: "WHATSAPP",
        sendStrategy: "SMART_WINDOWS",
        messageTemplate: "Hi {{first_name}}, 15% off your next Brewline order. ☕",
      }),
    })
  ).json();
  console.log(`campaign: ${camp.id} | sendStrategy: ${camp.sendStrategy}`);

  const sent = await (await fetch(`${BASE}/api/campaigns/${camp.id}/send`, { method: "POST" })).json();
  console.log(`send: ${JSON.stringify(sent)}  ← SENDING (later windows dispatch async)`);

  console.log("\n=== per-window inference (DB) ===");
  const dist = await prisma.communicationLog.groupBy({
    by: ["sendWindow"],
    where: { campaignId: camp.id },
    _count: { _all: true },
  });
  for (const d of dist) console.log(`  ${d.sendWindow}: ${d._count._all}`);

  const sample = await prisma.communicationLog.findMany({
    where: { campaignId: camp.id },
    select: { sendWindow: true, windowConfidence: true, scheduledFor: true },
    take: 4,
  });
  console.log("sample rows:");
  for (const r of sample) console.log(`  ${r.sendWindow} ${r.windowConfidence} → ${r.scheduledFor?.toISOString()}`);

  console.log("\n=== right after send: MORNING dispatched, later windows QUEUED (staggered) ===");
  await bucketStatus(camp.id);

  await sleep(12000);
  console.log("\n=== +12s: morning funnel progressing, later windows still QUEUED ===");
  await bucketStatus(camp.id);

  console.log("\n=== window-stats API ===");
  const ws = await (await fetch(`${BASE}/api/campaigns/${camp.id}/window-stats`)).json();
  console.log(JSON.stringify(ws, null, 2));

  console.log(`\nCampaign: ${BASE}/campaigns/${camp.id} (watch the night wave land at ~3min, then the lift table fill)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
