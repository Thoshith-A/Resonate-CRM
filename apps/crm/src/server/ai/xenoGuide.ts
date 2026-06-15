import { generateText, type ModelMessage } from "ai";
import { getAiModel } from "./provider";
import { XENO_GUIDE_SYSTEM_PROMPT } from "./xenoGuidePrompt";

/**
 * Xeno Guide — free-form (markdown) help assistant. Unlike the campaign copilot
 * it has no tools: it answers from the system prompt's knowledge of Resonate
 * and returns plain markdown. Full conversation history is passed for multi-turn
 * context. Throws if no AI provider key is configured (the route maps that to a
 * friendly reply).
 */

export type GuideMessage = { role: "user" | "assistant"; content: string };

const OUT_OF_SCOPE_FALLBACK =
  "I'm here to help with Resonate only. Try asking about segments, campaigns, AI features, or analytics!";

export async function runXenoGuide(messages: GuideMessage[]): Promise<string> {
  const model = getAiModel(); // throws ApiError(503) if no provider key

  const modelMessages: ModelMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const result = await generateText({
    model,
    system: XENO_GUIDE_SYSTEM_PROMPT,
    messages: modelMessages,
  });

  return result.text.trim() || OUT_OF_SCOPE_FALLBACK;
}
