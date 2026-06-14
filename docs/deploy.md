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

## 3. Render (channel-sim)
1. New **Blueprint** from the repo (it reads [`render.yaml`](../render.yaml)) — or a Web Service with build `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @resonate/channel-sim build` and start `pnpm --filter @resonate/channel-sim start`. Leave Root Directory at the repo root.
2. Env vars: `CRM_URL` = the Vercel URL, `WEBHOOK_SECRET` = the **same** shared secret, `SIM_SPEED=4`, `CONVERSION_RATE=0.08`. (Render injects `PORT`.)
3. Deploy. Note the URL, e.g. `https://resonate-channel-sim.onrender.com`; check `GET /health`.

## 4. Wire them together
Set Vercel's `CHANNEL_SIM_URL` to the Render URL → **redeploy** the CRM.

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
