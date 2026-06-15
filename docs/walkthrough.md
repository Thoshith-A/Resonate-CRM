# Resonate — Walkthrough Video & Defense Pack

A complete, code-grounded script for the 5:30 walkthrough video plus interview-defense
prep. Every claim here maps to real files in this repo.

---

## The 5:30 run sheet (memorize this table)

| Time | Section | On screen | One-line goal |
|---|---|---|---|
| 0:00–0:30 | Product intro | The 3D hero / landing | Frame the *problem*, not the features |
| 0:30–2:00 | Functional demo | `/campaigns/new` → live `/campaigns/[id]` | The 90 seconds that win it |
| 2:00–3:00 | Architecture | `docs/architecture.md` mermaid | Two services, hostile receipts, idempotency, forward-only state |
| 3:00–4:00 | Code | 3 files only | Pure compiler, the receipt fold, the shared contract |
| 4:00–5:00 | AI-native | `SPEC.md` + `docs/ai-workflow.md` | "AI as a team I direct, with real overrides" |
| 5:00–5:30 | Close | Live URL | Conscious tradeoffs + what's next |

---

## 1 · Product intro (~0:30)

**Say (≈75 words):**

> "Brands don't lose customers loudly — they lose them silently. I built **Resonate**, an
> AI campaign copilot for D2C brands. The loop is **Audience → Message → Send → Learn**,
> with AI at every step: describe an audience in plain English, AI drafts the message, a
> *separate, realistic* channel pipeline delivers it, and the system tells you — in plain
> English — what happened and what revenue it drove. I deliberately scoped it as a
> marketer's copilot, **not** an everything-CRM."

**The "why" behind the scope (have this ready):**

- I picked one sharp loop and made it *real* end-to-end rather than building shallow CRM breadth.
- Explicit non-goals (state them — scoping is a graded category): sales pipelines, support
  tickets, real messaging integrations, multi-tenant auth, drag-drop journey builders.
  Single workspace, no login — documented as a tradeoff, not an oversight.
- Demo brand is **Brewline**, an Indian specialty-coffee D2C — so every number on screen is
  realistic (₹, Indian names, Mumbai/Delhi/Bangalore weighting).

---

## 2 · Functional demo (~1:30) — the ballgame

Record this with `SIM_SPEED=4` so a full funnel plays out in ~60s. **Warm the sim first**
(`GET /health`) and have the campaign page already loading when you hit send.

**Exact click path + what to narrate:**

1. **Audience (NL → segment).** On `/segments` (or the copilot), type:
   > *"high spenders in Mumbai or Delhi who haven't ordered in 90 days"*

   Narrate: *"This goes to the AI, which returns a structured rule tree — not free text."*
   The AST populates the **visual builder**.

2. **Show human control.** Tweak one condition manually (e.g. bump spend, or change a city).
   Narrate: *"AI assists, the marketer stays in control — and it can't hallucinate a field
   that doesn't exist; I'll show why in the code."* The **live preview count** updates
   (debounced).

3. **Message (AI drafting).** Go to `/campaigns/new`, pick the segment, set objective:
   > *"win them back with 15% off"*

   Click **"Let Resonate draft three options"** → 3 variant cards with predicted-engagement
   scores. Pick one → show the **personalization preview on a real sample customer**
   (`{{first_name}}`, `{{city}}` rendered).

4. **Send → stay on the live feed.** Hit send and **do not navigate away**. Narrate while
   statuses flip:
   > *"Messages are now dispatching to a separate delivery service. Watch the funnel —
   > sent → delivered → read → clicked — updating in real time. These receipts arrive
   > **batched, shuffled, sometimes duplicated**, and the page polls every 3 seconds."*

5. **The money moment.** Attributed orders land, the funnel fills, and the **AI summary card**
   writes the plain-English recap — now auto-refreshing live until the campaign settles.
   Read one line aloud:
   > *"Reached 263 lapsed customers, 94% delivered, clickers converted ₹15,273 in attributed
   > revenue."*

**If asked "is the revenue real?"** — Yes: ~8% of clicked messages trigger the simulator to
place an actual order through the CRM's *public* `POST /api/orders`, tagged `source=CAMPAIGN`
with attribution IDs. The revenue on screen is a live DB aggregate of those orders.

---

## 3 · Technical architecture (~1:00)

Pull up the mermaid diagram in [docs/architecture.md](architecture.md). It's two deployable
services + a shared contract package over Postgres:

```
apps/crm  (Vercel)  ──POST /v1/messages────────────────▶  apps/channel-sim (Render)
Next.js 15           HMAC-signed, idempotency key,         Express delivery simulator
UI + API + domain    batches of 100, concurrency 5
   ▲   │                                                        │
   │   └──────────────── Neon Postgres (Prisma) ◀──────────────┘
   │                                                            │
   └─POST /webhooks/receipts── batched, SHUFFLED, HMAC ◀────────┤
   └─POST /api/orders ──────── conversions (source=CAMPAIGN) ◀──┘

packages/shared  ·  zod contracts (channel API, webhook payloads, segment AST) — imported by BOTH
```

**Hit exactly four beats (this is what earns system-design points):**

1. **Two genuinely separate, deployed services** talking over **HMAC-SHA256-signed HTTP**
   ([packages/shared/src/crypto.ts](../packages/shared/src/crypto.ts)) — constant-time verify,
   reject >5-min timestamp skew (forgery + replay-window defense). A shared zod package means
   the wire format **can't silently drift**.

2. **Receipts are hostile *by design*.** The sim buffers events and flushes them on an
   interval, **Fisher–Yates shuffled**
   ([apps/channel-sim/src/receipts.ts](../apps/channel-sim/src/receipts.ts)), with
   retry/backoff and a dead-letter log. Out-of-order is a *feature* — it proves the state
   machine.

3. **Idempotency via an append-only ledger.** Every receipt is inserted into `ReceiptEvent`
   with a unique **`(vendorMessageId, eventType)`** constraint. Replaying a whole batch
   inserts zero rows → **zero duplicate state changes**.

4. **A forward-only status state machine** so out-of-order events can never corrupt state:
   `QUEUED(0) < SENT(1) < DELIVERED(2) < READ(3) < CLICKED(4)`; `FAILED` is terminal, only
   reachable from QUEUED/SENT. A CLICKED that arrives *before* DELIVERED still lands at
   CLICKED with both timestamps set.

**Then one sentence of humility:**

> "At 10M customers I'd replace the synchronous batched send with an outbox + worker queue,
> and the webhook with a partitioned consumer keyed by campaignId — both documented in
> decisions.md."

**Decision-reasoning table (be ready for "why this and not that"):**

| Decision | Why | At scale → |
|---|---|---|
| **Snapshot audiences** (freeze into `CommunicationLog` at send) | Reproducible stats, dead-simple attribution | Dynamic segments = a recompute job |
| **Synchronous batched send** (100/batch, conc. 5, `maxDuration=60`) | Correct + simple under ≤~10k audiences | Outbox + workers |
| **Webhook + single idempotent txn** | One bulk `UPDATE…FROM(VALUES)` per batch | Queue + consumer partitioned by `campaignId` |
| **Denormalized customer aggregates** (`totalSpend`, `lastOrderAt`…) | Segment preview is *one indexed query* | Async aggregate refresh / CDC |
| **3s polling, not websockets** | Single-tenant demo simplicity | Push channel |
| **In-memory sim scheduling** | It's a simulator | Real vendor = durable queue |
| **Single tenant, no auth** | Scope | `tenantId` on every row + RLS + per-tenant limits |

---

## 4 · Code walkthrough (~1:00) — show three files only

**First, the structure (10 seconds):** *"API route handlers are thin — they parse, validate,
and delegate to `apps/crm/src/server/*`, the domain layer. No business logic in routes or
components. The same domain functions back both the UI and the AI copilot — one domain, two
consumers."*

**File 1 — the segment compiler (pure function + its tests).**
[apps/crm/src/server/segments/compile.ts](../apps/crm/src/server/segments/compile.ts)

> "`compileRules(ast, now)` turns a validated rule tree into a Prisma `where` clause. It's
> **pure and total** — `now` is injected so date-relative fields like `last_order_days_ago`
> are deterministic and unit-testable. It assumes the AST already passed the shared zod
> schema, so every branch is exhaustive."

Show the `*_days_ago` inversion logic (larger 'days ago' = older date) and the dedicated tests
in [compile.test.ts](../apps/crm/src/server/segments/compile.test.ts).

**File 2 — the receipt processor (the heart).**
[apps/crm/src/server/receipts/processReceipts.ts](../apps/crm/src/server/receipts/processReceipts.ts)
+ [statusMachine.ts](../apps/crm/src/server/receipts/statusMachine.ts)

> "One transaction: find which `(vendorMessageId, eventType)` pairs already exist, insert only
> the **fresh** ones, fold *only those* through the forward-only state machine, and apply the
> whole batch as a **single `UPDATE…FROM(VALUES)`** — four round-trips regardless of batch
> size."

Show `foldEvents`: it's **order-independent** — it computes the furthest-forward progress from
whichever timestamps are present, so arrival order is irrelevant. Point at the
CLICKED-before-DELIVERED and duplicate-delivery tests.

**File 3 — the shared zod contract.**
[packages/shared/src/segment.ts](../packages/shared/src/segment.ts)

> "Both services *and* the AI validate against the **same** schemas. The segment AST whitelists
> fields and comparators, so a hallucinated segment field is **structurally impossible** — zod
> rejects it before it reaches the compiler."

Tie it to [segmentFromText.ts](../apps/crm/src/server/ai/segmentFromText.ts): the model fills
a *flat* schema, then output is re-validated against the *canonical recursive*
`SegmentRulesSchema` — "two schemas, one source of truth."

---

## 5 · AI-native workflow (~1:00) — this is what gets you hired

Open [SPEC.md](../SPEC.md) then [docs/ai-workflow.md](ai-workflow.md).

**Say:**

> "I wrote a full spec and drove the agent through **phase gates** with verification criteria —
> plan → implement → typecheck + test → manual verify → approve, then the next phase. AI as a
> team I direct, not autocomplete. The honest record of what it got wrong, and how I caught it,
> lives in `ai-workflow.md`."

**Lead with ONE concrete override (the headline story):**

> "The first cut processed receipts **one event at a time**, each in its own write. I redirected
> it to fold a whole batch in **one transaction** with
> `ON CONFLICT (vendorMessageId, eventType) DO NOTHING` — because real vendors retry and replay
> *entire batches*, and per-event processing double-counts under replay. That made idempotency a
> property of the **schema** (a unique key), not of careful code."

**Then the runtime-only bug (shows you verify, not just generate):**

> "The batched version then *timed out* — a 50-event batch did ~40 sequential `UPDATE`s inside
> the transaction and blew Prisma's 5-second limit. Root cause was round-trip count, not logic;
> I fixed it with a single `UPDATE…FROM(VALUES)`. I caught it by **replaying a captured batch**
> and by **killing the sim mid-send** and confirming the campaign settled to all-FAILED with
> zero rows stuck in QUEUED."

**Have a second story ready ("it was all perfect" is a failing answer at an AI-native company):**

- *The check was wrong, not the code:* my first `verify-phase6` asserted every attributed
  order's comm was *already* CLICKED. It failed 21/34 — because conversions POST immediately but
  click receipts fold through the rate-limited, shuffled webhook, so **a conversion legitimately
  outruns its own click receipt**. I corrected the *invariant being tested* (same-campaign
  linkage is the hard guarantee; CLICKED is eventually consistent), not the data.
- *Graceful degradation, proven by accident:* the Gemini key was billing-blocked mid-build
  (429). Because every AI output is validated and failures degrade, this surfaced as a calm
  "couldn't map that" message in the UI instead of a crash — exactly the safety property the
  design is for.
- *Ambition + orchestration (the 3D hero):* the cinematic "Stellar Genesis" intro was built by
  **parallel sub-agents over disjoint paths** against a contract authored first, then a
  "director" agent integrated the master timeline. I picked up verification an agent skipped and
  caught two bugs no static check could — a GLSL reserved-word (`patch`) silently failing shader
  compilation, and a React-19 ref-as-prop circular `JSON.stringify` crash in postprocessing.

**The architecture payoff line:** "The copilot's tools (`preview_segment`, `draft_message`,
`create_and_send_campaign`) call the **exact same `src/server` functions** the UI buttons call —
no parallel 'AI path' to drift." See [copilot.ts](../apps/crm/src/server/ai/copilot.ts).

---

## 6 · Close (~0:30)

> "Tradeoffs I made consciously: snapshot audiences, single tenant, synchronous send under 10k.
> What I'd build next: the agentic copilot end-to-end. The AI fails safe by construction —
> structured output → zod whitelist → retry-with-error → graceful fallback — so it can never
> inject a field the compiler doesn't know. Code, live URL, and the decisions doc are linked
> below."

---

## Appendix · Interview defense (rehearse 30-sec answers)

1. **One message's full lifecycle, row by row.** `CommunicationLog` created QUEUED → batch POST
   to sim → sim returns vendorMessageId → row SENT (bulk update). Receipts arrive (shuffled):
   each inserts a `ReceiptEvent` row (unique key), then folds into the comm row's timestamps +
   status, forward-only. ~8% of CLICKED → sim POSTs an `Order` (source=CAMPAIGN, attribution
   ids) through `/api/orders`, which also maintains the customer's denormalized aggregates in
   one txn.
2. **CLICKED before DELIVERED?** `foldEvents` stamps every timestamp present and sets status =
   furthest precedence reached → CLICKED with both `deliveredAt` and `clickedAt` set.
   Precedence map, not last-write-wins, because last-write-wins would let a late DELIVERED
   *regress* a CLICKED message.
3. **Vendor replays a whole batch?** Unique `(vendorMessageId, eventType)` ledger +
   conflict-skip; we fold **only freshly-inserted** events. Replay = 0 fresh = 0 state changes
   (ack returns `duplicates: N`).
4. **Sim dies mid-send?** One retry + backoff per batch; still failing → rows marked
   `FAILED("channel_unreachable")` and the run continues. Campaign always settles COMPLETED;
   nothing is stuck in QUEUED forever.
5. **Why snapshot audiences?** Reproducible stats + simple attribution. Dynamic = a recompute
   job (in decisions.md).
6. **How does the AI fail safely?** `generateObject` → bounded schema → re-validate against the
   canonical zod whitelist → one retry-with-error → graceful fallback (`rules: null` + helpful
   message). Hallucinated field is structurally impossible.
7. **Why denormalize `totalSpend`/`lastOrderAt`?** Segment preview must be one indexed query.
   Cost = write-path transaction work; at scale → async refresh/CDC.
8. **10M customers / 1M-message campaigns — what breaks first?** Synchronous send → outbox +
   workers; webhook → queue partitioned by campaignId; segment counts → async estimate jobs.
9. **Why HMAC + reject old timestamps?** Forgery defense + replay-window defense.
10. **What did the AI get wrong?** Two real stories above (per-event receipts; the over-strict
    phase-6 check).

---

## Accuracy notes (so nothing bites you on camera)

- Seed is **~8,000 customers / ~29,000 orders** (deterministic faker), per the README — *not*
  the 35k the original SPEC drafted.
- The architecture doc says receipts flush "≤50 / 3s," but the actual sim is tuned for a fast
  demo (**~1s flushes, larger batches**, still shuffled) in
  [receipts.ts](../apps/channel-sim/src/receipts.ts). If a reviewer diffs the two, say: "the
  *design* is small batched flushes; I tuned the interval up for a sub-20s on-camera funnel."
- AI provider resolves **Anthropic → OpenAI → Google**; default `AI_MODEL` is
  `claude-sonnet-4-6`. Name whichever you actually recorded with.
- Two features beyond SPEC are worth a 5-second mention if time allows: the **AI channel router**
  ("Let Resonate decide" — picks a channel per customer) and **smart send windows**. Don't
  over-index on them; the core loop is the story.
