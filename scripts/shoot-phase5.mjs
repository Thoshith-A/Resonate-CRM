import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const OUT = "C:/Users/thoshith.a/CRM/.shots";

async function launch() {
  // Prefer system Edge/Chrome — no browser download needed.
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      /* try next */
    }
  }
  return chromium.launch({ headless: true }); // fall back to bundled if present
}

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const cid = await (await fetch(`${BASE}/api/dashboard`).then((r) => r.json()).then((j) => {
  const rows = (j.campaigns || []).slice().sort((a, b) => (b.audienceSize || 0) - (a.audienceSize || 0));
  return rows[0]?.id;
}));

// Dashboard
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true });
console.log("shot dashboard.png");

// Campaign detail (funnel + live feed)
if (cid) {
  await page.goto(`${BASE}/campaigns/${cid}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/campaign.png`, fullPage: true });
  console.log("shot campaign.png", cid);
} else {
  console.log("no campaign id found");
}

await browser.close();
