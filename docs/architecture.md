# Architecture

Resonate is two deployable services plus a shared contract package, over Postgres.

## System

```mermaid
flowchart LR
  subgraph Vercel
    CRM["apps/crm<br/>Next.js 15 — UI + API routes + domain layer (src/server)"]
  end
  subgraph Render
    SIM["apps/channel-sim<br/>Express — delivery simulator"]
  end
  DB[("Neon Postgres<br/>via Prisma")]

  CRM -- "POST /v1/messages<br/>HMAC-signed, idempotency key, batches of 100" --> SIM
  SIM -- "POST /api/webhooks/receipts<br/>batched (≤50/3s), shuffled, HMAC-signed" --> CRM
  SIM -- "POST /api/orders (conversions)<br/>source=CAMPAIGN + attribution ids" --> CRM
  CRM --- DB

  SHARED["packages/shared<br/>zod contracts: channel API, webhook payloads, segment AST"]
  SHARED -.-> CRM
  SHARED -.-> SIM
```

## Send → receipt → fold (the heart)

```mermaid
sequenceDiagram
  participant U as Marketer (UI)
  participant CRM as CRM (Next.js)
  participant DB as Postgres
  participant SIM as channel-sim

  U->>CRM: POST /campaigns/:id/send
  CRM->>DB: snapshot audience → CommunicationLog rows (QUEUED)
  loop batches of 100, concurrency 5
    CRM->>SIM: POST /v1/messages (HMAC + Idempotency-Key)
    SIM-->>CRM: 202 [{ clientRef, vendorMessageId, accepted|rejected }]
    CRM->>DB: rows → SENT (+vendorMessageId) or FAILED(reason)
  end
  Note over CRM,DB: campaign → COMPLETED once every row has left QUEUED

  loop every 3s, up to 50 events, SHUFFLED
    SIM->>CRM: POST /webhooks/receipts (HMAC, batch)
    CRM->>CRM: verify HMAC + reject >5min skew
    CRM->>DB: ONE txn: insert ReceiptEvent ON CONFLICT(vendorMessageId,eventType) DO NOTHING
    CRM->>DB: fold ONLY fresh events → forward-only status (bulk UPDATE…FROM VALUES)
    CRM-->>SIM: { accepted, duplicates, failed }
  end

  opt ~8% of CLICKED, 10–60s later
    SIM->>CRM: POST /api/orders (source=CAMPAIGN, attribution ids)
    CRM->>DB: order + maintain customer aggregates (one txn)
  end
```

## Why this survives a hostile receipt stream

- **Contract-first** — both services validate every boundary with the *same* zod schemas from `packages/shared`. Drift fails loudly on whichever side is wrong.
- **Idempotent ingestion** — the append-only `ReceiptEvent` ledger has a unique `(vendorMessageId, eventType)` constraint. Replaying a whole batch inserts zero new rows, so it produces zero duplicate state changes.
- **Forward-only state machine** — `QUEUED(0) < SENT(1) < DELIVERED(2) < READ(3) < CLICKED(4)`; `FAILED` is terminal and only reachable from QUEUED/SENT. A CLICKED that arrives before DELIVERED still lands at CLICKED with both timestamps set — order-independent by construction.
- **Crash-safe send** — a batch that can't reach the sim (after one retry) marks its rows `FAILED("channel_unreachable")` and the run continues; the campaign always settles, never leaving zombies in QUEUED.
- **AI fails safe** — `generateObject` fills a bounded schema, then the canonical zod whitelist (segment fields / merge fields) re-validates it; one retry-with-error, then a graceful fallback. A hallucinated field is structurally impossible.
- **One domain layer, thin routes** — API handlers parse/validate and delegate to `apps/crm/src/server/*`; the same functions would back the optional AI copilot (one domain, two consumers).

See [`decisions.md`](decisions.md) for the at-scale evolution of each of these.
