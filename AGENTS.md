# Agent Instructions for P365

Read `docs/P365-CANONICAL-FOUNDATION-INTEGRITY-AUDIT-F0.md` in full before doing anything else in this repo. It is the active operational SSOT for current implementation status, verified findings, sequencing, and foundation gates. For market-domain semantics and future data-universe classification, also read `docs/P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md`. Before changing canonical Observation classification, history compatibility, or semantic mappings, read `docs/P365-CANONICAL-SEMANTIC-DIMENSIONS-COMPATIBILITY-v0.1.md`. Do not assume a feature is missing or complete without checking the active SSOT and current code.

This file exists because unsupervised agent sessions on this repo have twice pushed 40-100+ commits directly to `main` without review, including: reverting reviewed fixes, adding an unrequested database dependency, restructuring the folder layout and reverting it in the same session, and repeatedly flipping the same UI element back and forth. Docs alone did not stop this. These rules are not suggestions.

## Hard rules

1. **Never push directly to `main`.** Work on a branch, open a PR, and stop. A human merges it. If you cannot open a PR in this environment, stop after committing to a branch and say so — do not fall back to pushing to `main`.
2. **Never self-merge.** Not even if CI passes, not even if the change looks small.
3. **One logical change = one PR.** Do not bundle a feature addition with a refactor with a UI tweak. If a task naturally splits into stages, stop after each stage and wait for review before starting the next.
4. **Do not activate deferred higher-order reasoning code** (`lib/domain/state.ts`, `risk.ts`, `intelligence.ts` and anything that would consume them) unless a human has explicitly asked for that specific checkpoint. The active SSOT and financial-market ontology keep Derived State → Intelligence → Briefing behind factual/history/baseline/snapshot gates. This includes not adding any trading signal, portfolio sizing, or trade execution logic under any framing.
5. **Do not add a new external dependency** (database, SaaS integration, paid API) without asking first, even if it seems like the obvious next step. Provider or infrastructure expansion must satisfy the active SSOT, source-qualification rules, and the financial-market ontology before implementation.
6. **Do not restructure existing folders/files** ("clean up the architecture", move things to `src/`, etc.) unless specifically asked. If the code is genuinely a mess, propose the restructure and wait for a yes.
7. **Reuse existing contracts, don't invent parallel ones.** `ProviderResult<T>` (`lib/data/types.ts`), `Observation`/`Event`/`Evidence`/`Context` (`lib/domain/types.ts`), and the provider file pattern in `lib/data/*.ts` (apiKey guard → fetch using the shared cadence-aware cache policy, or the explicitly retained legacy dashboard tag → diagnostic/error handling → typed result) are the established shape. Cache-tag ownership lives in `lib/data/cache-policy.ts`; do not invent provider-local invalidation tags. Match it.
8. **UI text is Indonesian.** Never interpolate a raw status enum (`PENDING`/`FRESH`/`PARTIAL`/`UNAVAILABLE`/etc.) directly into JSX — always go through a translated label map. This exact bug has regressed twice; the active SSOT records the remaining presentation debt.
9. **If something looks broken or half-finished when you start, don't "clean it up" as a drive-by.** Flag it in your PR description and let a human decide. What looks like dead code may be an intentional placeholder for a deferred phase (see Phase 0 status in the roadmap for an example).

## Stack, quick reference

Next.js 15 (App Router), TypeScript, React Server Components + Server Actions, deployed on Vercel. Durable Market Memory uses a server-side Supabase adapter; production E2E remains conditional on deployment credentials as recorded in the active SSOT. Current provider paths include FRED, Alpha Vantage, CoinGecko, CoinDesk, Forex Factory, Federal Reserve (FOMC calendar), Biquote trial event results, and Yahoo Finance trial market data. Build with `npm run build` before considering any runtime change done; it must pass with no new errors.

## Where things live

- `lib/data/` — provider fetchers (one file per external source)
- `lib/domain/` — canonical types, invariant contracts, and domain builders (Baseline, Context, State, Risk, Intelligence)
- `lib/ingestion/`, `lib/normalization/`, `lib/repositories/`, `lib/application/` — the pipeline boundary (Provider → Ingestion → Normalization → Repository → Application query)
- `lib/presentation/` — domain-to-UI display conversion
- `app/dashboard/` — the actual page, server actions, and the (large, single-file) view component
