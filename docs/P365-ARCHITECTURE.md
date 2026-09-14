# P365 Architecture v0.1

## Product boundary

P365 is a private market-intelligence dashboard. The current product collects macro news, crypto news, crypto market observations, and economic-calendar events and prepares them for progressively richer context and intelligence layers.

The current implementation scope is **Macro + Crypto**. The domain contracts remain market-agnostic so other markets can be added later without changing the core model.

## Core domain

- Observation: a fact or measurable item observed from a source.
- Event: a time-bound occurrence, scheduled or unscheduled.
- Context: a relationship between observations/events that gives them meaning.
- State: an interpreted condition at a point in time, with confidence and evidence.
- Risk: uncertainty or adverse-condition context that matters to decision support.
- Intelligence: evidence-based interpretation with explicit confirmation, contradiction, invalidation, and monitoring criteria.

## Supporting concepts

- Source: origin of data.
- News: a source format, not intelligence by itself.
- Briefing: presentation/application output derived from intelligence.

Regime, sentiment, liquidity, and capital-flow models are intentionally deferred until their definitions and evidence requirements are established.

## Data flow

```text
Provider
  ↓
Ingestion
  ↓
Normalization
  ↓
Canonical Observation / Event / Evidence
  ↓
Context
  ↓
State / Risk
  ↓
Intelligence
  ↓
Briefing
  ↓
UI
```

## Canonical Observation Pipeline v0.1

`lib/data/crypto-market.ts` provides a structured BTC/USD and ETH/USD spot-rate observation source through Alpha Vantage's exchange-rate endpoint.

The pipeline creates two linked domain objects:

1. `Observation` — the measurable value, timestamp, domain, and source.
2. `Evidence` — the captured source record backing that observation.

The observation is therefore never created from a news headline or from an interpretation. Its `value` remains a raw observed measurement represented as a string at the domain boundary.

### Current coverage

- Crypto: BTC/USD spot rate — supported when Alpha Vantage is configured and returns a valid rate.
- Crypto: ETH/USD spot rate — supported under the same condition.
- Macro: structured macro observations — **not yet available** from the current provider set; macro news remains Evidence only.
- Economic calendar: Event only; it is not converted into an Observation.

This limitation is intentional. P365 must not fabricate macro observations from narrative news or calendar metadata.

## Intelligence Contract v0.1

The Intelligence layer is currently a **semantic contract and validation layer**, not an autonomous market-interpretation engine.

Each Intelligence object must provide:

`WHAT → WHY → CONFIRMS → CONTRADICTS → INVALIDATES → MONITOR → CONFIDENCE → EVIDENCE`

`lib/domain/contracts.ts` validates that WHAT and WHY are present, evidence exists, confirmation/contradiction references are valid and non-duplicated, and invalidation/monitor criteria are non-empty.

Domain-specific rules are still required before P365 can automatically generate Regime, liquidity, capital-flow, sentiment, or other market interpretations.

See `docs/P365-INTELLIGENCE-CONTRACT.md` for the full contract.

## Invariants

1. Intelligence must have evidence.
2. Observation must not contain interpretation.
3. Provider failure must not be represented as an ordinary empty result at the domain layer.
4. State requires timestamp and confidence.
5. Briefing must not invent new facts.
6. Context must be traceable to observations/events.
7. UI must not own domain reasoning.
8. Provider-specific response shapes must not leak into the domain layer.
9. Every canonical observation produced by the current market pipeline has linked Evidence.
10. News is not silently promoted into Observation.
11. Intelligence must remain traceable to canonical evidence and explicit reasoning fields.

## v0.1 implementation

The existing provider functions remain the ingestion boundary. `lib/domain/` provides canonical domain types and normalization helpers without forcing a UI rewrite.

Current canonical outputs exposed by `getDashboardData()`:

- `observations`
- `events`
- `evidence`
- `providerHealth`

Existing `macroNews`, `cryptoNews`, and `calendarEvents` are preserved for UI compatibility.

## Roadmap: connecting Context → State → Risk → Intelligence (staged)

As of `ca32418`, `lib/domain/context.ts`, `state.ts`, `risk.ts`, `intelligence.ts`, and
`contracts.ts` are implemented but **not wired to `getDashboardData()` or the UI**. Only
`Evidence`, `Observation`, and `ProviderHealth` (via `normalize.ts`) are live. This is
intentional — connecting the rest requires real domain rules, not just plumbing, and
should happen in small, reviewable steps instead of all at once.

**Process rule:** one stage below = one PR = one deploy = one checkpoint with the human
before starting the next stage. Do not implement multiple stages in a single pass, and do
not self-merge — leave the PR for explicit review.

1. **Context** — group related Evidence/Observation/Event into a `Context` per topic
   (e.g. "BTC price action", "Fed policy outlook"). Wire `createContext`-style logic into
   `getDashboardData()`, render as a simple list (replacing the current static "Interpretasi
   belum tersedia" copy is out of scope for this stage — only show contexts, not states).
2. **State** — define the actual confidence rules (what makes a State `CONFIRMED` vs
   `LEANING` vs `PENDING`) for at least one concrete case (e.g. BTC short-term trend from
   price observations). Wire into one panel only.
3. **Risk** — derive Risk statements from State + upcoming high-impact calendar events.
4. **Intelligence** — synthesize Context + State + Risk into the WHAT/WHY/CONFIRMS/
   CONTRADICTS/INVALIDATES/MONITOR structure, replacing the static placeholder panel.

Each stage should ship with its own tests/manual verification and a short note on what
domain rule was chosen and why, since these are judgment calls, not mechanical refactors.

