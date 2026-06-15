# Deploy runbook

Three managed services: **Neon** (Postgres), **Vercel** (CRM), **Render** (channel-sim). ~30–60 minutes. Config: [`apps/crm/vercel.json`](../apps/crm/vercel.json), [`render.yaml`](../render.yaml).

## 0. Generate a shared secret
Pick a long random string — it's `WEBHOOK_SECRET` and must be **identical** on both services.
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 1. Neon (database)
1. Create a project → copy the **pooled** connection string (`...-pooler...`).
2. From your machine, apply schema + seed against it:
   ```bash
   DATABASE_URL="<neon-pooled-url>" pnpm db:deploy   # prisma migrate deploy
   DATABASE_URL="<neon-pooled-url>" pnpm db:seed     # ~8k customers + ~29k orders
   ```

## 2. Vercel (CRM)
1. Import the repo. **Root Directory → `apps/crm`** (Vercel installs the workspace at the repo root automatically).
2. Build is pinned by `apps/crm/vercel.json` (`prisma generate … && next build`).
3. Environment variables (see the table in [`README.md`](../README.md#environment-variables)):
   - `DATABASE_URL` (Neon pooled), `WEBHOOK_SECRET` (the shared secret), `ADMIN_KEY` (any strong string)
   - One AI key (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`) + `AI_MODEL` matching it
   - `CHANNEL_SIM_URL` → placeholder for now (e.g. `https://example.com`); updated in step 4
4. Deploy. Note the production URL, e.g. `https://resonate.vercel.app`.

## 3. Channel-sim — deploy on **Render** *or* **Vercel**
The sim runs the same on either: a long-running server on Render, or a serverless
function on Vercel that finishes each send's lifecycle via `waitUntil` (see
[Serverless caveats](#serverless-caveats-and-the-demo-recommendation)).

**Option A — Render (long-running).**
1. New **Blueprint** from the repo (it reads [`render.yaml`](../render.yaml)) — or a Web Service with build `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @resonate/channel-sim build` and start `pnpm --filter @resonate/channel-sim start`. Leave Root Directory at the repo root.
2. Env vars: `CRM_URL` = the Vercel URL, `WEBHOOK_SECRET` = the **same** shared secret, `SIM_SPEED=10`, `CONVERSION_RATE=0.08`. (Render injects `PORT`.)
3. Deploy. Note the URL, e.g. `https://resonate-channel-sim.onrender.com`; check `GET /health`.

**Option B — Vercel (serverless).** A second Vercel project, separate from the CRM.
1. Import the repo → **Root Directory → `apps/channel-sim`**. [`apps/channel-sim/vercel.json`](../apps/channel-sim/vercel.json) wires every route to `api/index.ts` and gives it `maxDuration=60`; no build command needed (`@vercel/node` compiles the function).
2. Env vars: `CRM_URL` = the Vercel **CRM** URL, `WEBHOOK_SECRET` = the **same** shared secret, `SIM_SPEED=10`, `CONVERSION_RATE=0.08`. (Vercel injects `PORT`.) `SIM_SPEED=10` keeps the full funnel inside the function window — the sim also auto-compresses to fit, but a low speed wastes headroom.
3. Deploy. Check `GET /health` on the Vercel URL.

## 4. Wire them together
Set the CRM's `CHANNEL_SIM_URL` to the sim's URL (Render or Vercel) → **redeploy** the CRM.

## 5. Smoke test (public URL, incognito)
1. **Reset demo** in the nav (enter `ADMIN_KEY`) → dashboard shows ~8,000 customers, 0 campaigns.
2. New campaign → segment **"high spenders gone quiet"** (or build one via the AI prompt) → AI-draft a message → **Send**.
3. Stay on `/campaigns/[id]`: the funnel fills and the live feed flips SENT→DELIVERED→READ→CLICKED.
4. Within ~1 min, **attributed revenue** appears and the **AI summary** card renders.

## Gotchas
- **Render free tier sleeps (~50s cold start).** Hit the sim's `/health` a couple of minutes before any demo/recording so reviewers don't hit a dead first click.
- **`WEBHOOK_SECRET` mismatch** → the sim's receipts get `401`ed and dead-letter; the funnel never advances past SENT. Same value on both sides.
- **`CHANNEL_SIM_URL` still a placeholder** → sends mark rows `FAILED("channel_unreachable")`. Update it (step 4) and redeploy.
- Use the Neon **pooled** string for serverless; the direct string can exhaust connections.

## Serverless caveats (and the demo recommendation)
The whole **INSTANT** flow runs end-to-end on Vercel: the CRM dispatches within the
send request, and the **channel-sim finishes each batch's lifecycle in a `waitUntil`**
(posting receipts + conversions back after its 202), bounded to stay inside
`maxDuration=60`. Dashboard, segments, NL→segment, AI drafting, AI channel routing,
insights, copilot, Delivery Universe, and the lift analytics all work too.

One feature still relies on **CRM-side work that continues after the HTTP response**,
which a serverless function can't do (it's frozen at `maxDuration`):
- **Smart Windows** staggers later waves with `setTimeout` *on the CRM* after the send returns `SENDING` — so on the CRM's Vercel function the afternoon/evening/night waves won't fire (only the morning wave). It works fully on a long-running CRM runtime. (The sim itself handles whichever waves reach it.)
- A single **INSTANT send** large enough that the CRM's in-request dispatch exceeds its own `maxDuration=60` is cut off. Each sim batch is independently bounded, so the limit is the CRM request, not the sim.

**For a flawless live demo:** either (a) record the **Smart Windows + waves** flow on **localhost** (long-running, all waves + the lift land in ~15s), or (b) on the Vercel URLs demo **Send Now** on a **few-hundred-customer** segment (completes well within 60s, receipts stream back over ~10s). Everything else demos identically. The production fix — an outbox + durable queue (BullMQ/Inngest) for staggered/large dispatch — is documented in `decisions.md`.
