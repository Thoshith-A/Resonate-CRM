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
 * one to instantiate. AI_MODEL must match the configured provider.
 *
 * Keys are validated here (point of use) rather than at boot, so the app
 * still builds/boots without an AI key for the non-AI phases.
 */
export function getAiModel(): LanguageModel {
  const env = getEnv();
  if (env.ANTHROPIC_API_KEY) {
    return anthropic(env.AI_MODEL);
  }
  if (env.OPENAI_API_KEY) {
    return openai(env.AI_MODEL);
  }
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(env.AI_MODEL);
  }
  throw new ApiError(
    503,
    "ai_unconfigured",
    "No AI provider key is configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.",
  );
}
