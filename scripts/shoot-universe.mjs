import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const OUT = "C:/Users/thoshith.a/CRM/.shots";
const CID = process.argv[2] ?? "cmqefogjz0002qcgcasddr0c0";

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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(`${BASE}/campaigns/${CID}`, { waitUntil: "domcontentloaded" });
// Wait for the insights poll to populate + the canvas field to settle.
await page.waitForTimeout(4500);
await page.screenshot({ path: `${OUT}/universe.png`, fullPage: false });
console.log("shot universe.png", CID);

await browser.close();
