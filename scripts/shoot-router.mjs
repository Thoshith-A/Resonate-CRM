import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const OUT = "C:/Users/thoshith.a/CRM/.shots";
const SEGMENT_ID = process.argv[2];
const CAMPAIGN_ID = process.argv[3];

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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// Builder Step 2 with "Let Resonate decide" + routing preview.
await page.goto(`${BASE}/campaigns/new?segment=${SEGMENT_ID}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
try {
  await page.getByRole("button", { name: /continue/i }).first().click();
  await page.waitForTimeout(800);
  await page.getByText(/Let Resonate decide/i).first().click();
  await page
    .getByText(/Est\. blended CTR|Routing preview failed/i)
    .first()
    .waitFor({ timeout: 35000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/router-builder.png`, fullPage: false });
  console.log("shot router-builder.png");
} catch (err) {
  await page.screenshot({ path: `${OUT}/router-builder.png`, fullPage: false });
  console.log("shot router-builder.png (partial:", err.message, ")");
}

// Campaign detail with ✦ AI-routed badge + Channel routing card.
if (CAMPAIGN_ID) {
  await page.goto(`${BASE}/campaigns/${CAMPAIGN_ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/router-detail.png`, fullPage: false });
  console.log("shot router-detail.png");
}

await browser.close();
