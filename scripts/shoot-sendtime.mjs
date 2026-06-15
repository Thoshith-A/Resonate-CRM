import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const OUT = "C:/Users/thoshith.a/CRM/.shots";
const CAMPAIGN_ID = process.argv[2];
const SEGMENT_ID = process.argv[3];

async function launch() {
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      /* next */
    }
  }
  return chromium.launch({ headless: true });
}

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// 1) Campaign detail — scroll the Send-Time Intelligence section into view.
await page.goto(`${BASE}/campaigns/${CAMPAIGN_ID}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);
try {
  await page.getByText("Send-Time Intelligence").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
} catch {
  /* leave at top */
}
await page.screenshot({ path: `${OUT}/sendtime-detail.png`, fullPage: false });
console.log("shot sendtime-detail.png");

// 2) Builder Step 2 — Recommended badges + SendTimeSelector (Smart Windows).
if (SEGMENT_ID) {
  await page.goto(`${BASE}/campaigns/new?segment=${SEGMENT_ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  try {
    await page.getByRole("button", { name: /continue/i }).first().click();
    await page.waitForTimeout(700);
    await page.getByText(/Smart Windows/i).first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/sendtime-builder.png`, fullPage: true });
    console.log("shot sendtime-builder.png");
  } catch (err) {
    await page.screenshot({ path: `${OUT}/sendtime-builder.png`, fullPage: true });
    console.log("shot sendtime-builder.png (partial:", err.message, ")");
  }
}

await browser.close();
