import { waitUntil } from "@vercel/functions";
import { createApp, type AcceptedMessage } from "../src/app";
import { simulateBatch } from "../src/simulate";

/**
 * Vercel serverless entry for the channel-sim.
 *
 * A serverless function is frozen the instant the HTTP response is sent, so the
 * standalone server's background timers + periodic flusher never run here. We
 * keep the request/response contract identical (same Express app) but drive the
 * post-202 lifecycle through `waitUntil`: it hands the platform a promise to
 * settle the funnel — posting receipts back to the CRM — while the 202 has
 * already been returned to the caller. Bounded to fit maxDuration (vercel.json).
 *
 * All routes are rewritten to this function (see vercel.json), and Express
 * dispatches on the original path.
 */
const app = createApp((messages: AcceptedMessage[]) => {
  waitUntil(simulateBatch(messages));
});

export default app;
