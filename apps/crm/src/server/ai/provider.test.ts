import { describe, expect, it } from "vitest";
import { selectModelId } from "./provider";

// Guards the deploy footgun: AI_MODEL defaults to a Claude id, so a Google-only
// deploy that forgets to set it must NOT end up calling google("claude-…")
// (which fails every AI call and looks like a dead Gemini key).
describe("selectModelId — matches the model to the active provider", () => {
  it("uses a correctly-set model verbatim", () => {
    expect(selectModelId("google", "gemini-2.5-flash")).toBe("gemini-2.5-flash");
    expect(selectModelId("anthropic", "claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
    expect(selectModelId("openai", "gpt-4o-mini")).toBe("gpt-4o-mini");
  });

  it("falls back to the provider default when the model belongs to another provider", () => {
    // The classic case: Google key configured, AI_MODEL still the Claude default.
    expect(selectModelId("google", "claude-sonnet-4-6")).toBe("gemini-2.5-flash");
    expect(selectModelId("openai", "claude-sonnet-4-6")).toBe("gpt-4o-mini");
    expect(selectModelId("anthropic", "gemini-2.5-flash")).toBe("claude-sonnet-4-6");
  });

  it("falls back on a blank/whitespace model", () => {
    expect(selectModelId("google", "")).toBe("gemini-2.5-flash");
    expect(selectModelId("google", "   ")).toBe("gemini-2.5-flash");
  });

  it("accepts newer gemini ids verbatim", () => {
    expect(selectModelId("google", "gemini-2.0-flash")).toBe("gemini-2.0-flash");
    expect(selectModelId("google", "gemini-1.5-pro")).toBe("gemini-1.5-pro");
  });
});
