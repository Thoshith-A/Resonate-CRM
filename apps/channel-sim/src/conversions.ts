import { OrderInputSchema, type OrderInput, type OrderItem } from "@resonate/shared";
import { config } from "./config";
import { logger } from "./logger";
import type { MessageRecord } from "./store";

/**
 * Phase 6 conversion loop (SPEC §7). A fraction of CLICKED messages convert:
 * the sim posts a realistic CAMPAIGN-sourced order back through the CRM's
 * PUBLIC ingestion API (POST /api/orders) carrying the attribution ids, so a
 * campaign's "attributed revenue" reflects orders that its clicks drove.
 *
 * Closing the loop through the CRM's own front door (rather than writing the
 * DB directly) keeps aggregate maintenance + attribution in exactly one place.
 */

type Sku = { name: string; category: string; min: number; max: number };

// A representative slice of Brewline's catalogue (mirrors prisma/seed.ts so
// attributed orders read consistently on camera). Prices are integer paise.
const FALLBACK_SKU: Sku = {
  name: "Single-Origin Arabica 250g",
  category: "beans",
  min: 45000,
  max: 90000,
};

const SKUS: readonly Sku[] = [
  FALLBACK_SKU,
  { name: "Estate Reserve Beans 500g", category: "beans", min: 90000, max: 160000 },
  { name: "Espresso Blend 1kg", category: "beans", min: 140000, max: 220000 },
  { name: "Pour-Over Kit", category: "equipment", min: 180000, max: 320000 },
  { name: "AeroPress Go", category: "equipment", min: 300000, max: 450000 },
  { name: "Monthly Beans Subscription", category: "subscription", min: 80000, max: 140000 },
];

const RETRY_BACKOFF_MS = [500, 1500] as const;
const ORDERS_PATH = "/api/orders";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pickSku(): Sku {
  return SKUS[Math.floor(Math.random() * SKUS.length)] ?? FALLBACK_SKU;
}

/** Build a realistic 1–2 line CAMPAIGN order attributed to the click. */
function buildOrder(record: MessageRecord): OrderInput {
  const lineCount = Math.random() < 0.3 ? 2 : 1;
  const items: OrderItem[] = [];
  for (let i = 0; i < lineCount; i += 1) {
    const sku = pickSku();
    const qty = sku.category === "equipment" ? 1 : randInt(1, 2);
    const price = randInt(sku.min, sku.max);
    items.push({ name: sku.name, category: sku.category, qty, price });
  }
  const amount = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  // Self-validate against the shared contract before it leaves the sim — the
  // same schema the CRM validates on the way in, so the wire format can't drift.
  return OrderInputSchema.parse({
    customerId: record.customerId,
    amount,
    currency: "INR",
    items,
    placedAt: new Date().toISOString(),
    source: "CAMPAIGN",
    attributedCampaignId: record.campaignId,
    attributedCommunicationId: record.clientRef,
  });
}

async function postOrder(body: string): Promise<boolean> {
  try {
    const res = await fetch(`${config.crmUrl}${ORDERS_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Post one attributed conversion order, best-effort with light backoff. A
 * conversion that can't be recorded is logged and dropped — it must never
 * crash the simulator or block receipt delivery.
 */
export async function recordConversion(record: MessageRecord): Promise<void> {
  let body: string;
  try {
    body = JSON.stringify(buildOrder(record));
  } catch (err) {
    logger.error("conversion build failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
    if (await postOrder(body)) {
      logger.info("conversion recorded", { campaignId: record.campaignId });
      return;
    }
    const backoff = RETRY_BACKOFF_MS[attempt];
    if (backoff !== undefined) {
      await sleep(backoff);
    }
  }
  logger.warn("conversion dropped (CRM unreachable)", { campaignId: record.campaignId });
}
