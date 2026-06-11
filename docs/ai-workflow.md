# AI workflow

> Maintained by the author. This is the honest record of how AI was used to build Resonate — the prompts that worked, the outputs that were rejected, and why.

## How this project is driven

- `SPEC.md` is the source of truth; the agent works in strict phase gates and stops for verification after each phase.
- Each phase: plan (file-level checklist) → implement → `pnpm typecheck` + `pnpm test` → manual verification steps → approval before the next phase.

## Log

### Phase 0 — skeleton
- Authored the monorepo skeleton, Prisma schema, typed env loaders, health endpoints, and the 3D landing experience with parallel sub-agents over disjoint paths, then integrated and verified centrally (typecheck, boot, curl).
- Override worth recording: `create-next-app` was rejected at the repo root by its writability probe on Windows; re-ran it from inside `apps/crm` with `.` as the target.

### Interlude — "Stellar Genesis" cinematic intro
- Driven from a film-style creative brief (beat-by-beat timeline with named labels, art direction, acceptance criteria). The orchestration pattern: the contract files (`intro/constants.ts`, `intro/contract.ts`, shared GLSL noise) were authored first by the lead, then three scene-module agents built cosmos/system/violence in parallel against that contract, then a single "director" agent built the master GSAP timeline and integrated with the existing hero (camera blend into the live rig formula instead of a crossfade — zero-pop handoff).
- Override worth recording: the brief suggested swapping to a separate intro canvas with a ≤250ms crossfade as a fallback; rejected — the proto-sun was instead staged at the brand star's exact world position so one persistent canvas carries the whole film.
- The agent that wrote the master timeline + integration hit a session limit at its final report step, so it never ran its own verification. Picked the work up by running the verification it skipped (typecheck/lint/build, then headless beat-by-beat screenshots through a `?introT=` scrub hook). Two real runtime bugs surfaced that no static check caught:
  1. **`patch` is a reserved word in GLSL ES** — used as a variable in the planet shaders, so every planet silently failed to compile. In dev this cascaded into a fatal crash because Next's error overlay tried to `JSON.stringify` THREE's shader-error log (circular). Renamed to `blotch`.
  2. **`@react-three/postprocessing` + React 19 `ref`-as-prop** — its `wrapEffect` memoizes on `JSON.stringify(props)`, and under React 19 a forwarded `ref` lands in those props; once it resolved to the (circular) effect instance, the stringify threw and killed the tree. Fixed by constructing the effects imperatively and mounting them via `<primitive>`, which also gave direct instances to animate per-frame with zero re-renders.
- Self-critique pass against the brief flagged the [void] beat blazing from frame zero instead of emerging from black; added a `systemReveal` brightness ramp so the opening reads as deep space igniting into the system.
- Added a fully-synthesized Web Audio score (no sample files) wired to the same timeline beats, behind a muted-by-default "Sound" toggle. Verified headlessly by tapping the AudioContext output through an AnalyserNode and sampling peak amplitude over the 6.5s play — confirmed a clean dynamic arc (quiet drone → omen riser → impact hit → genesis swell → resolve fade) with the context "running" and zero console errors.

### Phase 3 — NL → Segment
- The AI never produces rules directly trusted by the system: `generateObject` fills a bounded schema, then the canonical `SegmentRulesSchema` (the same one the visual builder and API use) re-validates it. A hallucinated field is structurally impossible — it can't pass the shared zod whitelist — and an invalid shape triggers one retry-with-error then a graceful `rules: null` + helpful message. This is the "AI fails safely" story: structured output → zod whitelist → retry → graceful fallback.
- Override worth recording: the canonical segment schema is recursive (`z.lazy`), which the Gemini structured-output JSON-schema subset rejects. Rather than loosen validation, the *model-facing* schema was flattened to an explicit depth-3 shape while the *trusted* validation stayed on the canonical recursive schema — two schemas, one source of truth.
- Real finding to tell honestly in an interview: the provided Gemini key was billing-blocked (`429 prepayment credits depleted`). Because every AI output is validated and failures degrade gracefully, this surfaced as a calm "couldn't map that" message in the UI rather than a crash — exactly the safety property the design is meant to give.

<!-- Add entries per phase: what the AI proposed, what was rejected/overridden, and the reasoning. -->
