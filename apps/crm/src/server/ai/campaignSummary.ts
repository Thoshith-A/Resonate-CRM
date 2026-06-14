import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getCampaignInsights, type CampaignInsights } from "../campaigns/getCampaignInsights";
import { getAiModel } from "./provider";

export type CampaignSummaryResult = {
  headline: string;
  narrative: string;
  recommendations: string[];
  degraded: boolean;
};

const MAX_WORDS = 120;

const AiOutputSchema = z.object({
  headline: z.string().min(1).max(120),
  narrative: z.string().min(1).max(800),
  recommendations: z.array(z.string().min(1).max(200)).length(2),
});

const rupees = (paise: number): string => `₹${new Intl.NumberFormat("en-IN").format(Math.round(paise / 100))}`;

/** A compact, factual brief of the campaign for the model to interpret. */
function statsBrief(c: CampaignInsights): string {
  const readWord = c.channel === "EMAIL" ? "opened" : "read";
  return [
    `Campaign: "${c.name}" on ${c.channel}, status ${c.status}.`,
    c.objective ? `Objective: ${c.objective}.` : "",
    `Audience snapshot: ${c.audienceSize} customers.`,
    `Sent ${c.funnel.sent}, delivered ${c.funnel.delivered} (${c.deliveredPct}% of sent), ${readWord} ${c.funnel.read} (${c.readPct}% of delivered), clicked ${c.funnel.clicked} (${c.clickedPct}% of delivered).`,
    `Failed ${c.funnel.failed}${c.failures.length ? ` (${c.failures.map((f) => `${f.reason} ${f.count}`).join(", ")})` : ""}.`,
    `Attributed revenue: ${rupees(c.attributedRevenue)} from ${c.attributedOrders} orders placed after a click.`,
  ]
    .filter(Boolean)
    .join("\n");
}

const SYSTEM_PROMPT = `You are a marketing analyst for Brewline, an Indian specialty-coffee D2C brand. Given a campaign's computed stats, write a concise, plain-English performance summary for a busy marketer.

Output JSON: { "headline": string, "narrative": string, "recommendations": [string, string] }.
- headline: one punchy sentence with the single most important result.
- narrative: ≤ ${MAX_WORDS} words. State what happened using the actual numbers (reach, delivery, reads/opens, clicks, attributed revenue). Be specific and honest — if engagement or revenue is low, say so plainly.
- recommendations: exactly two concrete, actionable next steps grounded in these numbers (e.g. follow up with readers who didn't click; investigate a high failure reason).
Never invent numbers that aren't in the brief. Rupee amounts as given.`;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function attempt(
  model: LanguageModel,
  brief: string,
  extra: string,
): Promise<Omit<CampaignSummaryResult, "degraded">> {
  const { object } = await generateObject({
    model,
    schema: AiOutputSchema,
    system: SYSTEM_PROMPT,
    prompt: `${brief}${extra}`,
  });
  if (wordCount(object.narrative) > MAX_WORDS + 15) {
    throw new Error(`narrative is ${wordCount(object.narrative)} words; keep it ≤ ${MAX_WORDS}`);
  }
  return object;
}

/** Deterministic, numbers-only summary when the model is unavailable. */
function fallbackSummary(c: CampaignInsights): Omit<CampaignSummaryResult, "degraded"> {
  const readWord = c.channel === "EMAIL" ? "opened" : "read";
  return {
    headline: `Reached ${c.funnel.sent.toLocaleString("en-IN")} customers; ${rupees(c.attributedRevenue)} attributed.`,
    narrative: `"${c.name}" delivered to ${c.funnel.delivered.toLocaleString("en-IN")} of ${c.funnel.sent.toLocaleString("en-IN")} sent (${c.deliveredPct}%). ${c.funnel.read.toLocaleString("en-IN")} ${readWord} and ${c.funnel.clicked.toLocaleString("en-IN")} clicked (${c.clickedPct}% of delivered), driving ${rupees(c.attributedRevenue)} across ${c.attributedOrders} attributed orders. ${c.funnel.failed} messages failed.`,
    recommendations: [
      `Follow up with the ${Math.max(0, c.funnel.read - c.funnel.clicked).toLocaleString("en-IN")} customers who ${readWord} but didn't click.`,
      c.failures.length
        ? `Investigate the top failure reason ("${c.failures[0]?.reason}") before the next send.`
        : `Test a second variant on a held-out slice to lift the ${c.clickedPct}% click rate.`,
    ],
  };
}

/**
 * AI insight summary (SPEC §9.3). Summarises the campaign's REAL computed
 * stats (never client-supplied numbers): one attempt, one retry, then a
 * deterministic numbers-only fallback so the card always renders.
 */
export async function campaignSummary(campaignId: string): Promise<CampaignSummaryResult> {
  const insights = await getCampaignInsights(campaignId);
  const model = getAiModel();
  const brief = statsBrief(insights);
  try {
    return { ...(await attempt(model, brief, "")), degraded: false };
  } catch (firstError) {
    const reason = firstError instanceof Error ? firstError.message : String(firstError);
    try {
      return {
        ...(await attempt(model, brief, `\n\nYour previous attempt was rejected (${reason}). Fix it.`)),
        degraded: false,
      };
    } catch (secondError) {
      console.error(
        "[ai] campaign-summary failed:",
        secondError instanceof Error ? secondError.message : secondError,
      );
      return { ...fallbackSummary(insights), degraded: true };
    }
  }
}
