import { z } from "zod";
import type { Logger } from "./logger";

// Load a local .env for dev. `process.loadEnvFile` only exists on Node >= 20.12,
// and on serverless there's no .env — guard both so neither crashes module load.
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch (err) {
    // A missing .env is fine (e.g. in production); anything else is a real error.
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  CRM_URL: z.url().default("http://localhost:3000"),
  WEBHOOK_SECRET: z.string().min(8),
  SIM_SPEED: z.coerce.number().positive().default(1),
  /** Share of CLICKED messages that place an attributed order (SPEC §7). */
  CONVERSION_RATE: z.coerce.number().min(0).max(1).default(0.08),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(env)"}: ${issue.message}`)
    .join("\n");
  const message = `channel-sim: invalid environment configuration\n${problems}`;
  // Throw rather than process.exit(1): on a serverless function a bare exit
  // surfaces only as FUNCTION_INVOCATION_FAILED with no detail, whereas a
  // thrown error is written to the function logs so the missing var is obvious.
  console.error(message);
  throw new Error(message);
}

export const config = Object.freeze({
  port: parsed.data.PORT,
  crmUrl: parsed.data.CRM_URL,
  webhookSecret: parsed.data.WEBHOOK_SECRET,
  simSpeed: parsed.data.SIM_SPEED,
  conversionRate: parsed.data.CONVERSION_RATE,
});

export function printConfig(logger: Logger): void {
  logger.info("config", {
    port: config.port,
    crmUrl: config.crmUrl,
    webhookSecret: `${config.webhookSecret.slice(0, 4)}…`,
    simSpeed: config.simSpeed,
    conversionRate: config.conversionRate,
  });
}
