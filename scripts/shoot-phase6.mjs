import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const OUT = "C:/Users/thoshith.a/CRM/.shots";
const SEGMENT_ID = "cmq94fgp70000qco4ey0c9ny2"; // "High spenders gone quiet"
const CAMPAIGN_ID = "cmqe3zwby0001qc0g9pkwz5c3"; // Phase 6 conversion test (has revenue + summary)

async function launch() {
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      /* try next */
    }
  }
  return chromium.launch({ headless: true });
}

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// ── Campaign builder, step 1 (audience, pre-selected via ?segment=) ──
await page.goto(`${BASE}/campaigns/new?segment=${SEGMENT_ID}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/p6-new-step1.png`, fullPage: true });
console.log("shot p6-new-step1.png");

// ── Step 2 (message + AI variants + live preview) ──
try {
  await page.getByRole("button", { name: /continue/i }).first().click();
  await page.waitForTimeout(800);
  // Fill objective if there's an input for it, then draft with AI.
  const objective = page.getByPlaceholder(/win them back|objective|15%/i).first();
  if (await objective.count()) {
    await objective.fill("win them back with 15% off");
  }
  await page.getByRole("button", { name: /draft.*ai|ai.*draft/i }).first().click();
  // Wait until the variant cards appear (model can take ~10s), then settle.
  await page
    .getByText(/direct|warm|playful|nostalgic|exclusive/i)
    .first()
    .waitFor({ timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/p6-new-step2.png`, fullPage: true });
  console.log("shot p6-new-step2.png");
} catch (err) {
  await page.screenshot({ path: `${OUT}/p6-new-step2.png`, fullPage: true });
  console.log("shot p6-new-step2.png (partial:", err.message, ")");
}

// ── Insights with AI summary card + attributed revenue ──
await page.goto(`${BASE}/campaigns/${CAMPAIGN_ID}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000); // AI summary generates on mount
await page.screenshot({ path: `${OUT}/p6-insights.png`, fullPage: true });
console.log("shot p6-insights.png");

await browser.close();
