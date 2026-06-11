import { z } from "zod";

/**
 * Environment contract for the CRM service.
 *
 * The AI keys stay optional at boot — they are validated at point of use
 * when AI features land.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  CHANNEL_SIM_URL: z.string().url(),
  WEBHOOK_SECRET: z.string().min(8),
  ADMIN_KEY: z.string().min(4),
  AI_MODEL: z.string().min(1).default("claude-sonnet-4-6"),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Lazily parse and cache process.env. Intentionally NOT executed at module
 * import time — Next.js evaluates modules during build, where runtime-only
 * variables may be absent. Call this inside request handlers / server code.
 *
 * On failure, throws an Error listing each missing/invalid variable, one per
 * line. Secret values are never included in the message.
 */
export function getEnv(): Env {
  if (cached) return cached;

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }

  cached = result.data;
  return cached;
}
