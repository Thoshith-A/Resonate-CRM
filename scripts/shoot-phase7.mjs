import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const OUT = "C:/Users/thoshith.a/CRM/.shots";

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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/p7-dashboard.png`, fullPage: true });
console.log("shot p7-dashboard.png");

await browser.close();
