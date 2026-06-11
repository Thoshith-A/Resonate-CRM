/**
 * Dev-only route warmer. Next.js compiles routes on first request in dev, so
 * the first navigation to a page otherwise stalls a few seconds. This polls
 * the CRM until it's up, then requests each route once so they're already
 * compiled before anyone clicks. No-op against a production build.
 */
const BASE = process.env.WARM_BASE ?? "http://localhost:3000";
const ROUTES = ["/dashboard", "/customers", "/segments", "/segments/new"];
const DEADLINE = Date.now() + 120_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function isUp() {
  try {
    const res = await fetch(`${BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  while (Date.now() < DEADLINE) {
    if (await isUp()) {
      break;
    }
    await sleep(1000);
  }
  for (const route of ROUTES) {
    try {
      await fetch(`${BASE}${route}`);
      console.log(`[warm] compiled ${route}`);
    } catch {
      // Best-effort; ignore.
    }
  }
  console.log("[warm] routes ready");
}

void main();
