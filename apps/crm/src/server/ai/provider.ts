import type { LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { getEnv } from "../env";
import { ApiError } from "../api";

/**
 * Resolve the AI model from whichever provider key is configured, in SPEC
 * order (Anthropic → OpenAI), with Google added so the provided Gemini key
 * works. The provider SDKs read their own key env vars; we only pick which
 * one to instantiate.
 *
 * Keys are validated here (point of use) rather than at boot, so the app
 * still builds/boots without an AI key for the non-AI phases.
 */
export function getAiModel(): LanguageModel {
  const env = getEnv();
  if (env.ANTHROPIC_API_KEY) {
    return anthropic(selectModelId("anthropic", env.AI_MODEL));
  }
  if (env.OPENAI_API_KEY) {
    return openai(selectModelId("openai", env.AI_MODEL));
  }
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(selectModelId("google", env.AI_MODEL));
  }
  throw new ApiError(
    503,
    "ai_unconfigured",
    "No AI provider key is configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.",
  );
}

const PROVIDER_DEFAULT_MODEL = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  google: "gemini-2.5-flash",
} as const;

const PROVIDER_MODEL_PATTERN: Record<keyof typeof PROVIDER_DEFAULT_MODEL, RegExp> = {
  anthropic: /^claude/i,
  openai: /^(gpt|o\d|chatgpt)/i,
  google: /^gemini/i,
};

/**
 * Pick a model id that actually belongs to the provider whose key is set.
 *
 * `AI_MODEL` is a single shared env var that defaults to a Claude id. A common
 * deploy mistake is to configure only a Google (Gemini) key but leave AI_MODEL
 * unset or as the Claude default — then `google("claude-…")` is instantiated
 * and EVERY AI call fails, silently degrading drafts to canned copy and looking
 * exactly like "the Gemini key isn't working". So if the configured model
 * doesn't match the active provider, fall back to that provider's default
 * instead. A correctly-set AI_MODEL (e.g. gemini-2.5-flash) is used verbatim.
 */
export function selectModelId(
  provider: keyof typeof PROVIDER_DEFAULT_MODEL,
  configured: string,
): string {
  const trimmed = configured.trim();
  return PROVIDER_MODEL_PATTERN[provider].test(trimmed)
    ? trimmed
    : PROVIDER_DEFAULT_MODEL[provider];
}
