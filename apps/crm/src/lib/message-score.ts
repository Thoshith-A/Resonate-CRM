import type { Channel } from "@resonate/shared";

// Predicted-engagement heuristic for a drafted message. Pure + deterministic so
// the score is explainable and works even when the AI fallback produced the
// draft. Scored 0–100 across five marketing-quality signals that sum to 100:
//   personalization 25 · length fit 25 · clear CTA 20 · incentive 15 · urgency 10
//   (+ up to 5 readability), capped at 100.

export type MessageTier = "Excellent" | "Strong" | "Good" | "Fair";

export type MessageScore = {
  score: number;
  tier: MessageTier;
};

type LengthBand = { min: number; max: number; hardMax?: number };

// Ideal character bands per channel; hardMax flags a real limit (SMS).
const LENGTH_BANDS: Record<Channel, LengthBand> = {
  SMS: { min: 90, max: 155, hardMax: 160 },
  WHATSAPP: { min: 120, max: 320 },
  RCS: { min: 120, max: 320 },
  EMAIL: { min: 150, max: 600 },
};

const FIRST_NAME = /\{\{\s*first_name\s*\}\}/i;
const OTHER_FIELDS = /\{\{\s*(city|last_order_days_ago|total_spend_rupees)\s*\}\}/gi;
const CTA =
  /\b(shop|order|reorder|buy|claim|get|grab|redeem|use code|tap|click|explore|discover|start|join|reactivate|return|try|unlock|browse|visit|enjoy|treat yourself)\b/i;
const INCENTIVE =
  /(\d+\s*%|₹\s*?\d|\bfree\b|\boff\b|\bdiscount\b|\bgift\b|\bsave\b|\bcashback\b|\bcredit\b|\bbonus\b)/i;
const URGENCY =
  /\b(today|now|tonight|ends?|hours?|last chance|limited|expires?|hurry|only|soon|before|don'?t miss)\b/i;

function lengthFit(len: number, band: LengthBand): number {
  if (band.hardMax && len > band.hardMax) return 3; // over a real limit (SMS)
  if (len >= band.min && len <= band.max) return 25;
  if (len < band.min) return Math.max(8, Math.round((len / band.min) * 25));
  return Math.max(6, Math.round(25 - (len - band.max) / 12));
}

function readability(text: string): number {
  let score = 5;
  const letters = text.replace(/[^a-zA-Z]/g, "").length;
  if (letters > 0) {
    const upper = text.replace(/[^A-Z]/g, "").length;
    if (upper / letters > 0.5) score -= 3; // shouting in ALL CAPS
  }
  if ((text.match(/!/g)?.length ?? 0) > 2) score -= 2; // exclamation spam
  return Math.max(0, score);
}

function tierFor(score: number): MessageTier {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Good";
  return "Fair";
}

export function scoreMessage(rawText: string, channel: Channel): MessageScore {
  const text = rawText.trim();
  if (text.length === 0) return { score: 0, tier: "Fair" };

  let personalization = FIRST_NAME.test(text) ? 15 : 0;
  personalization += Math.min((text.match(OTHER_FIELDS)?.length ?? 0) * 6, 10);
  personalization = Math.min(personalization, 25);

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        personalization +
          lengthFit(text.length, LENGTH_BANDS[channel]) +
          (CTA.test(text) ? 20 : 0) +
          (INCENTIVE.test(text) ? 15 : 0) +
          (URGENCY.test(text) ? 10 : 0) +
          readability(text),
      ),
    ),
  );

  return { score, tier: tierFor(score) };
}
