import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import {
  COMPARATOR_LABELS,
  SEGMENT_COMPARATORS,
  SEGMENT_FIELDS,
  SEGMENT_FIELD_DEFS,
  SegmentRulesSchema,
  type SegmentRules,
} from "@resonate/shared";
import { getAiModel } from "./provider";

export type AiSegmentResult = {
  rules: SegmentRules | null;
  explanation: string;
  suggestedName: string;
};

/**
 * AI output schema. A condition is a single flat object (so the JSON schema
 * sent to the model stays simple across providers); groups nest up to depth
 * 3 without recursion. The model's output is then re-validated against the
 * canonical SegmentRulesSchema — the single source of truth — which enforces
 * the strict per-field comparator/value rules. `rules` is nullable so the
 * model can decline an unmappable request gracefully.
 */
const AiConditionSchema = z.object({
  field: z.enum(SEGMENT_FIELDS),
  cmp: z.enum(SEGMENT_COMPARATORS),
  value: z.union([z.number(), z.string(), z.array(z.string())]),
});
const group = <T extends z.ZodTypeAny>(child: T) =>
  z.object({ op: z.enum(["AND", "OR"]), children: z.array(child).min(1) });
const depth3 = group(AiConditionSchema);
const depth2 = group(z.union([AiConditionSchema, depth3]));
const depth1 = group(z.union([AiConditionSchema, depth2]));
const AiRulesSchema = z.union([AiConditionSchema, depth1]);

const AiOutputSchema = z.object({
  rules: AiRulesSchema.nullable(),
  explanation: z.string().max(500),
  suggestedName: z.string().max(80),
});

function fieldReference(): string {
  return SEGMENT_FIELD_DEFS.map((def) => {
    const cmps = def.comparators.map((c) => `${c} (${COMPARATOR_LABELS[c]})`).join(", ");
    const valueHint =
      def.kind === "money"
        ? "value: integer PAISE (₹1 = 100 paise; ₹5,000 → 500000)"
        : def.kind === "days"
          ? "value: integer number of days"
          : def.kind === "count"
            ? "value: integer count"
            : def.kind === "city"
              ? "value: a city string, or an array of strings for `in`"
              : "value: a single tag string";
    return `- ${def.field} — ${def.label}; comparators: ${cmps}; ${valueHint}`;
  }).join("\n");
}

const SYSTEM_PROMPT = `You translate a marketer's plain-English audience description into a structured segment rule tree for an Indian D2C coffee brand (Brewline).

Output a JSON object: { "rules": <rule tree | null>, "explanation": string, "suggestedName": string }.

A rule tree is either a single condition { "field", "cmp", "value" } or a group { "op": "AND" | "OR", "children": [...] }. Groups may nest up to 3 levels deep.

ONLY these fields and comparators are allowed:
${fieldReference()}

Hard rules:
- Use ONLY the fields above. Never invent a field. Money values are integer paise (multiply rupees by 100).
- "haven't ordered in N days" / "lapsed N days" → last_order_days_ago gt N. "ordered in the last N days" → last_order_days_ago lt N.
- "never ordered" → order_count eq 0. Multiple cities → city in [..]. A tag → tags contains "tag".
- If the request mentions something that maps to NO allowed field (e.g. music taste, gender, favourite product they didn't buy), and nothing else is mappable, return "rules": null and explain what IS available. If only PART is unmappable, build rules from the mappable part and note the dropped part in the explanation.
- explanation: one or two sentences, plain English. suggestedName: a short title (≤ 6 words).

Examples:

Input: "people in Mumbai or Delhi who spent over ₹5,000 but haven't ordered in 90 days"
Output: { "rules": { "op": "AND", "children": [ { "field": "city", "cmp": "in", "value": ["Mumbai", "Delhi"] }, { "field": "total_spend", "cmp": "gt", "value": 500000 }, { "field": "last_order_days_ago", "cmp": "gt", "value": 90 } ] }, "explanation": "High-spending customers in Mumbai or Delhi who have gone quiet for over 90 days.", "suggestedName": "Lapsed metro VIPs" }

Input: "subscribers who have never placed an order"
Output: { "rules": { "op": "AND", "children": [ { "field": "tags", "cmp": "contains", "value": "subscriber" }, { "field": "order_count", "cmp": "eq", "value": 0 } ] }, "explanation": "Subscribers with zero orders so far.", "suggestedName": "Subscribers, no orders" }

Input: "customers who love jazz"
Output: { "rules": null, "explanation": "There's no attribute for music taste. You can segment by total spend, order count, average order value, days since last order, days since signup, city, or tags.", "suggestedName": "" }`;

async function attempt(model: LanguageModel, prompt: string): Promise<AiSegmentResult> {
  const { object } = await generateObject({
    model,
    schema: AiOutputSchema,
    system: SYSTEM_PROMPT,
    prompt,
  });

  if (object.rules === null) {
    return { rules: null, explanation: object.explanation, suggestedName: object.suggestedName };
  }
  // Canonical validation — the one validator the whole app trusts.
  const parsed = SegmentRulesSchema.safeParse(object.rules);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }
  return { rules: parsed.data, explanation: object.explanation, suggestedName: object.suggestedName };
}

/**
 * NL → segment. One attempt, then one retry with the validation error
 * appended, then a graceful fallback message (never throws to the route for
 * a model/validation problem — only a missing provider key does).
 */
export async function segmentFromText(userPrompt: string): Promise<AiSegmentResult> {
  // Resolve the provider first; a missing key surfaces as a 503, not a
  // "couldn't map" fallback.
  const model = getAiModel();
  try {
    return await attempt(model, userPrompt);
  } catch (firstError) {
    const reason = firstError instanceof Error ? firstError.message : String(firstError);
    try {
      return await attempt(
        model,
        `${userPrompt}\n\nYour previous attempt produced invalid rules (${reason}). Use only the allowed fields and value types, or return rules: null.`,
      );
    } catch (secondError) {
      // AI failures degrade to a helpful message rather than a 500; log for ops.
      console.error("[ai] segment-from-text failed:", secondError instanceof Error ? secondError.message : secondError);
      return {
        rules: null,
        explanation:
          "I couldn't turn that into segment rules. Try describing spend, orders, average order value, recency, signup date, city, or tags.",
        suggestedName: "",
      };
    }
  }
}
