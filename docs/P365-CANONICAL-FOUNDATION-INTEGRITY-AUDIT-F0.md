# P365 Foundation Master — SSOT v0.1

**Status:** **ACTIVE MASTER SSOT — current state, audit findings, remediation roadmap, and foundation gates**  
**Audited ref:** `main@b2275e7dc7424db157bc15193eda2d4033df088e`  
**Audit boundary:** Product contract → source qualification → provider → ingestion → normalization → canonical domain → temporal/provenance → quality/health → context → persistence/history → baseline → snapshot readiness → cross-asset readiness → expectation/repricing readiness → presentation/UI → deferred reasoning boundaries.

**Verification pass:** Re-verified 20 Sep 2026 against the exact current main SHA, repository-wide code search, canonical/domain/provider/repository/application paths, governance docs, current data registry, Market Memory contracts, and the financial-market ontology rebaseline.

## Documentation authority

This is the **single operational SSOT for foundation development**. It owns:

- current implementation state;
- verified F0 findings (`FND-001`…`FND-019`);
- current factual coverage/gaps;
- remediation priority and sequencing;
- foundation completion gates;
- checkpoint history.

Normative contracts remain separate only where they define stable rules rather than project status: `P365-ARCHITECTURE.md`, `P365-USER-DECISION-SUPPORT-CONTRACT.md`, `P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md`, `P365-DATA-REQUIREMENTS-MATRIX-v0.1.md`, `P365-MARKET-SNAPSHOT-CONTRACT-v0.1.md`, and Market Memory governance/implementation contracts. `AGENTS.md` remains repository governance.

Older status, roadmap, gap-analysis, and audit documents are removed rather than kept as competing sources of current truth. Historical decisions are summarized in the checkpoint history at the end of this document.

## 1. Executive verdict

**CHANGES REQUIRED**

P365 has a credible canonical-data architecture and the active code generally respects the decision-support boundary. Two foundation concerns now dominate: **historical continuity** and **semantic breadth**. The runtime pipeline does not need to be restarted, but the current coarse `MARKET / MACRO / ASSET / OTHER` ontology is insufficient for the broader product ontology. The **MVP implementation boundary remains Macro + Crypto + Gold**; the broader ontology exists to avoid future semantic dead ends, not to expand MVP indiscriminately.

The current system can ingest and normalize factual data, create evidence-backed Context, persist canonical records, query contract-compliant Observation history from durable Market Memory, and compute a factual macro baseline from the provider's current retrieval window. It cannot yet guarantee historical continuity because independent ingestion/backfill remains missing, the baseline is not repository-backed, and it cannot yet perform temporally valid event repricing/transmission analysis.

### Foundation readiness by layer

| Layer | Status | Audit result |
|---|---|---|
| Product/user contract | PASS | Retail trader/investor decision-support boundary is explicit. |
| Architecture layering | PASS / PARTIAL | Main runtime path follows Provider → Ingestion → Normalization → Canonical → Persistence/UI. Some naming/contracts still reflect dashboard-first evolution. |
| Source qualification | PARTIAL | Several source documents are stale relative to actual Yahoo/Biquote/FRED coverage. |
| Provider result semantics | PASS | SUCCESS/EMPTY/ERROR/UNAVAILABLE and retrieval timestamps are explicit. |
| Canonical observations | PASS / PARTIAL | Current factual families canonicalize cleanly; provenance is still partly free-form metadata. |
| Events / event results | PARTIAL | Biquote provides actual/forecast/previous/revision, but release semantics rely on provider `time` and production qualification remains trial-only. |
| Evidence | PASS / PARTIAL | Publication/retrieval separation exists; source-native identity/endpoint is not uniformly first-class. |
| Temporal semantics | PASS / PARTIAL | Major overloads have been corrected; exact release/availability semantics remain incomplete for macro/event families. |
| Freshness/quality | PARTIAL | Typed families and per-series macro windows exist, but quality is observation-age centric and does not yet model publication cadence/market-hours uniformly. |
| Context | PASS for grouping | Neutral grouping is evidence-backed and does not infer direction. |
| Market Memory persistence | PARTIAL | Append-only durable adapter exists; operational readiness depends on deployment configuration and ingestion invocation. |
| Historical retrieval | CONTRACT + DURABLE ADAPTER IMPLEMENTED / PRODUCTION E2E PENDING | FND-001 semantics are implemented against persisted canonical Observation payloads. Production REST E2E still requires the server-only deployment credential; independent ingestion/backfill remains FND-003. |
| Historical continuity | **HIGH GAP** | Persistence is triggered by dashboard reads; no independent collection/backfill ownership is defined. |
| Factual baseline | PASS in isolation / PARTIAL E2E | Selector is defensively implemented, but active baseline input is current-fetch history, not repository history. |
| Expectation baseline | MISSING | Event forecast exists as EventResult data, but no baseline contract/selection lifecycle exists. |
| Pricing baseline | MISSING | No canonical market-implied pricing layer. |
| Historical baseline | MISSING | No approved methodology/query implementation. |
| Cross-asset baseline | MISSING | No immutable pre-event reference set. |
| Market Snapshot | MISSING implementation | Contract exists; capture/storage/comparison do not. |
| Cross-asset factual coverage | PARTIAL | Useful universe exists; MOVE remains absent and docs disagree on credit coverage. |
| Transmission reasoning | MISSING | Correctly not implemented. |
| State/Regime/Risk/Intelligence | DEFERRED / PASS boundary | Builder files exist but are not active pipeline owners. |
| Market Briefing | DEFERRED | Correctly not fabricated. |
| UI/presentation | PASS / PARTIAL | UI mostly presents canonical facts and explicit pending states; several English/internal labels remain presentation debt. |
| Documentation SSOT | REMEDIATED IN PR #36 | Consolidation completed; this master file is the current operational SSOT. Historical drift remains recorded as FND-005 below. |
| Test/build governance | PARTIAL | Cache test exists, but foundation contracts lack broad automated tests; package has no explicit test script. |


## Current implementation snapshot

```text
Product/user contract        COMPLETE
Canonical provider pipeline  IMPLEMENTED / PARTIAL HARDENING
Macro factual foundation     IMPLEMENTED
Crypto factual foundation    PARTIAL
Cross-asset factual data     PARTIAL
Economic event results       TRIAL / PARTIAL
Context                      IMPLEMENTED / FND-004 REGRESSION CORRECTED
Durable Market Memory        FOUNDATION IMPLEMENTED
Historical retrieval         CONTRACT + DURABLE ADAPTER IMPLEMENTED / PRODUCTION E2E PENDING
Factual baseline             IMPLEMENTED / NOT REPOSITORY-BACKED (FND-002)
Independent ingestion        MISSING (FND-003)
Expectation baseline         MISSING lifecycle
Pricing baseline             MISSING
Market Snapshot              DESIGN ONLY
Transmission reasoning       MISSING
Financial-market ontology    DOCUMENTED / RUNTIME COMPATIBILITY PENDING
MVP Macro+Crypto+Gold       PARTIAL / ACTIVE TARGET
Broader multi-asset coverage  POST-MVP / ONTOLOGY-DEFINED
State / Regime / Risk        DEFERRED
Intelligence / Briefing      DEFERRED
```

### Current factual coverage

- **Macro:** FRED covers the approved monetary-policy, liquidity, inflation, labor, rates, broad-USD and growth foundation.
- **Crypto:** CoinGecko covers BTC/ETH spot, BTC/ETH market cap, total crypto market cap, total volume and BTC/ETH dominance. Stablecoin market cap and a defined basic-volatility metric remain open.
- **Cross-asset:** S&P 500, Nasdaq, Russell 2000, US 2Y, US 10Y, 10Y real yield, DXY, broad USD, Gold futures, WTI, VIX and IG/HY credit spreads are available. DXY and broad USD remain separate instruments. MOVE remains open.
- **Economic events:** Forex Factory provides scheduled-calendar awareness, Federal Reserve official FOMC date anchors, and Biquote trial structured event results. Production qualification/release semantics remain open.
- **Semantic breadth:** the FRED registry now contains 33 series, including SOFR, IORB, continued claims, JOLTS, quits, Sahm Rule, 10Y breakeven, 10Y-2Y and IG/HY OAS. Current `ObservationDomain` still collapses policy, funding, rates, FX, credit, equity, volatility and commodity semantics into coarse `MACRO`/`ASSET` categories.
- **MVP coverage gaps:** Macro still lacks complete global-policy/expectation/pricing coverage; Crypto lacks qualified stablecoin/ETF-flow/derivatives coverage; Gold has pricing but not a complete durable-history/baseline/flow-positioning reasoning chain.
- **Post-MVP ontology gaps:** full Equity, broad Credit, broad Commodities beyond Gold, broader volatility/derivatives, EM and other multi-asset domains remain intentionally outside first-class MVP scope unless used as supporting evidence.
- **Evidence:** Alpha Vantage and CoinDesk news remain Evidence and are not promoted into Observation/Intelligence.

## 2. End-to-end runtime path

Current active path:

```text
External providers
  ↓
lib/data/*
  ↓ ProviderResult<T>
lib/ingestion/dashboard-ingestion.ts
  ↓
lib/normalization/dashboard-normalization.ts
  ↓
Observation / Event / Evidence / EconomicEventResult / Context
  ├──→ Factual Baseline from current normalized FRED window
  ├──→ Supabase Market Memory persistence
  └──→ application/dashboard-query.ts
          ↓
      app/dashboard
```

Target foundation path before higher-order reasoning:

```text
Qualified Provider
  ↓
Ingestion
  ↓
Normalization
  ↓
Canonical facts + provenance
  ↓
Independent append-only historical persistence
  ↓
Semantic historical repositories
  ↓
Baseline / immutable Snapshot
  ↓
Comparable temporal reference sets
  ↓
Surprise / Repricing / Transmission
  ↓
State / Intelligence / Briefing
```

## 3. Product and governance audit

### PASS

The product boundary is now explicit: P365 serves a self-directed retail trader/investor by improving market understanding while leaving the decision to the user.

The active dashboard does not emit BUY/SELL, position sizing, price predictions, automatic regime labels, or portfolio actions.

`state.ts`, `risk.ts`, and `intelligence.ts` remain outside the active pipeline. Their existence is not authorization to activate them.

### Required governance correction

Future implementation acceptance must use both:

1. **architecture integrity**; and
2. **decision-support value**.

A technically valid feature that merely adds another metric/card without improving a defined reasoning question should not advance the product.

## 4. Provider and source audit

### FRED — PASS / PARTIAL

Strengths:
- registered semantic identity, unit, frequency and cadence;
- multiple valid observations fetched;
- future/invalid observations rejected;
- `vintageDate` retained where available;
- no fabricated `releasedAt`.

Gap:
- FRED release/availability time is unknown in the current endpoint path;
- `previousValue` duplicates information now also available as a canonical prior Observation. It must remain non-authoritative provenance only until cleaned up.

### CoinGecko — PASS / PARTIAL

Canonical factual coverage includes BTC/ETH spot, BTC/ETH market cap, total crypto market cap, total volume, BTC dominance and ETH dominance.

Gaps:
- stablecoin market cap missing;
- defined crypto volatility missing;
- breadth universe/metric missing;
- current endpoint is current-state oriented and does not itself establish durable historical continuity.

### Yahoo Finance — PARTIAL / qualified trial factual source

Gold futures, Russell 2000 and DXY are canonicalized with provider observation timestamps and previous-close metadata.

Gaps:
- the adapter reuses `CryptoMarketObservationInput` for non-crypto assets. This is an architectural naming/type smell, not currently a semantic leak into the canonical domain;
- Yahoo chart endpoint is unofficial/unauthenticated. Source qualification and long-term reliability need an explicit production decision;
- `previousClose` must not become a hidden canonical historical baseline.

### Forex Factory — PARTIAL

Useful for scheduled event awareness. It is not sufficient for expectation/surprise reasoning.

### Biquote — PARTIAL / trial

Useful foundation for `EconomicEventResult`: actual, forecast, previous, revised previous, revision, unit, period and evidence lineage.

Important limitation: when actual exists, normalization assigns provider `record.time` to `occurredAt` and `releasedAt`. This is valid only if Biquote's `time` is contractually the release/result time. That semantic must be verified before production-grade surprise timing is claimed.

### Federal Reserve — PASS for schedule / PARTIAL for event completion

Official FOMC schedule is kept as a date anchor. It correctly does not fabricate a decision release time. Event-result/publication ingestion remains missing.

### News — PASS role

Alpha Vantage and CoinDesk remain Evidence. They are not silently promoted to factual observations.

## 5. Canonical contract audit

### Observation — PASS / PARTIAL

Strong fields:
- canonical id;
- domain/subject/value;
- `observedAt`;
- `retrievedAt`;
- source;
- quality;
- evidence lineage.

Gap: important provider identity, unit, endpoint, series ID and observation-date semantics remain mostly inside `metadata`. This is acceptable for the current checkpoint but should be hardened before many additional provider families are added.

### Event — PASS / PARTIAL

Schedule, occurrence, release and retrieval concepts are distinct. Source-native event identity is not uniformly first-class.

### Evidence — PASS / PARTIAL

`publishedAt`, `releasedAt`, `retrievedAt`, and backward-compatible `capturedAt` are distinct.

Gap: `capturedAt` and `retrievedAt` are currently aliases in most normalization paths. This is acceptable for compatibility but should not evolve into two independent meanings without a contract revision.

### EconomicEventResult — PASS / PARTIAL

The domain object correctly distinguishes factual actual, expectation type, previous/revised previous and release/retrieval time.

Gap: it is persisted through a separate repository implementation but is not part of the generic canonical repository bundle. This split is workable but should be deliberately documented rather than accidental.

## 6. Temporal and provenance audit

The old temporal problems documented in `P365-TEMPORAL-PROVENANCE-CONTRACT-v0.1.md` are partly obsolete.

Current code now correctly keeps:
- FRED observation date in `observedAt`;
- retrieval separately;
- news publication separately from retrieval;
- event schedule separately from retrieval;
- missing FRED release time as missing.

Remaining gaps:
- provider-specific release semantics require verification;
- historical availability (“what P365 could have known at T”) is not reconstructable solely from observation date;
- macro freshness uses observation age with per-series tolerances, not a full release-calendar-aware model;
- market freshness does not explicitly encode market-open/closed semantics.

## 7. Quality, health and cache audit

### PASS

Provider result states preserve failure semantics. Canonical quality distinguishes FRESH/STALE/PARTIAL/UNKNOWN. Cache cadence is separated from canonical freshness.

### PARTIAL

ProviderHealth maps SUCCESS to HEALTHY regardless of canonical item quality, with a special FRED override when all normalized macro facts are stale. That means health and data quality are related but not uniformly composed across providers.

Manual refresh currently invalidates only `p365-dashboard`. Repository-wide verification confirms FRED, CoinGecko, CoinDesk and Yahoo use cadence-group tags (`p365-fast` / `p365-medium` / `p365-slow`) instead. Forex Factory, Biquote and FOMC still use `p365-dashboard`, while Alpha Vantage uses it directly. Therefore the button labelled **Muat ulang manual** does **not** invalidate the entire provider set and can return cached data for cadence-migrated providers. This is a **confirmed functional cache invalidation defect**, not merely a topology risk.

## 8. Context audit

Current Context is a neutral grouping layer and correctly references canonical observation/event IDs.

**Historical FND-004 defect:** the original `buildDashboardContexts` grouped the broad `ASSET` domain, mixing Yahoo/FRED cross-assets into `CRYPTO_MARKET` while omitting CoinGecko global metrics.

PR #36 replaced that broad-domain selector with qualified CoinGecko provenance plus a `crypto.*` metric prefix. Independent re-audit after FND-001 found a regression in that remediation: CoinGecko asset-level metrics such as `btc.spot.usd`, `eth.spot.usd`, and their market-cap metrics do not use the `crypto.*` prefix and were therefore excluded.

**Current correction:** `CRYPTO_MARKET` selects canonical observations with CoinGecko market provenance and a non-empty machine `metricId`, across both `ASSET` and `MARKET` domains. This includes the complete current CoinGecko factual family while continuing to exclude Yahoo and FRED cross-assets. Context remains neutral grouping only.

**Severity: HIGH / CORRECTED IN THIS CHECKPOINT.**

### Ontology rebaseline

The FND-004 corrections are valid for the current implementation but also exposed a deeper limitation: provider-qualified Context selection is compensating for a coarse canonical domain model. `btc.spot.usd` and `crypto.total_market_cap.usd` are both CRYPTO semantics even though the legacy runtime places them in different `ObservationDomain` buckets.

The new financial-market ontology therefore defines market domain and information class as independent semantic dimensions, plus jurisdiction/instrument/participant/tenor where relevant. This is a **documentation contract only** in this checkpoint. Existing Market Memory rows must not be rewritten; runtime migration must be additive and independently tested.

## 9. Persistence and Market Memory audit

### PASS foundation

- server-only credentials;
- append-only insert behavior;
- deterministic dedupe key;
- canonical payload retained;
- persistence failure does not crash dashboard.

### HIGH gaps

1. The historical Observation repository contract separates provider-independent semantic-series identity from optional source provenance and defines effective-time/as-of bounds, deterministic ordering, and a bounded result size.
2. The durable Supabase adapter implements that contract for persisted canonical Observation rows: FRED uses `payload.metadata.seriesId`; CoinGecko/Yahoo use `payload.metadata.metricId`; `effective_at` is the indexed effective-time filter; the retrieval cutoff uses canonical `payload.retrievedAt`, never `captured_at`.
3. Legacy Observation rows that predate canonical `retrievedAt` cannot participate in contract-compliant history/as-of queries and are excluded rather than assigned a fabricated availability time. Current writes retain `retrievedAt` in the immutable JSONB payload.
4. The existing append-only dedupe strategy retains corrections when their canonical IDs differ, including current FRED value revisions. FND-018 remains open for record families whose canonical ID strategy may not distinguish every future correction/revision case.
5. Dashboard read is also the ingestion/persistence trigger.
6. No scheduled ingestion/backfill owner is defined.
7. Baseline does not read Market Memory.
8. `findById` uses `limit=1` without an explicit order. Canonical IDs are intended to be stable enough for a unique logical record, but revisions/version semantics should not depend on unspecified row order.

Market Memory therefore has durable storage plus semantic Observation history retrieval, but is not yet a complete historical reasoning subsystem until FND-003 supplies independent continuity/backfill and FND-002 moves factual baseline selection onto repository history. Production Supabase REST E2E remains pending until the deployment environment supplies the server-only key.

## 10. Baseline audit

### Factual baseline — PASS domain algorithm

The selector checks:
- domain;
- subject;
- source;
- series;
- unit;
- frequency;
- temporal ordering;
- quality.

It exposes MISSING/INCOMPATIBLE/STALE/UNKNOWN instead of fabricating a delta.

### E2E limitation — HIGH

`buildMacroFactualBaselines(macroObservations)` consumes only observations normalized in the current provider request. It does not query durable history.

Consequences:
- baseline validity depends on provider response depth;
- historical continuity is not owned by P365;
- provider history can masquerade as application history;
- Market Memory is not yet the factual-baseline source.

### Other baseline classes

Expectation, Pricing, Historical, Cross-Asset and Positioning baseline implementations remain absent. This is correct for sequencing, but Phase 2 must not be labeled complete.

## 11. Snapshot audit

Contract: **GOOD DESIGN FOUNDATION.**

Implementation: **MISSING.**

No immutable Snapshot type, repository, capture trigger, pre/post-event policy, compatibility checker, or snapshot comparison exists.

Before implementation, exact capture semantics must be defined per event/use case. A universal T±N window should not be invented.

## 12. Cross-asset factual audit

Actual code is ahead of several documents.

Implemented/available:
- S&P 500 — FRED;
- Nasdaq — FRED;
- Russell 2000 — Yahoo;
- US 2Y — FRED;
- US 10Y — FRED;
- 10Y real yield — FRED;
- DXY — Yahoo;
- broad USD — FRED, correctly distinct from DXY;
- Gold futures — Yahoo;
- WTI — FRED;
- VIX — FRED;
- IG/HY credit spreads — FRED.

Still missing from target universe:
- MOVE.

Therefore older documents that still say equities/DXY/gold/oil/VIX/credit are missing are stale and should not be used as current implementation truth.

## 13. Expectation, repricing and transmission readiness

### Expectation

Biquote supplies forecast data, but a canonical **Expectation Baseline lifecycle** does not exist. A provider forecast field alone is not enough to establish the correct pre-release expectation snapshot.

### Repricing

No canonical market-implied pricing layer exists. Therefore P365 cannot distinguish:
- factual surprise;
- expectation surprise;
- pricing surprise.

### Transmission

Cross-asset facts exist, but there is no synchronized pre/post-event observation set or comparison contract. Therefore “asset X confirmed event Y” is not yet a valid system conclusion.

## 14. UI / presentation audit

The UI correctly exposes:
- factual observations;
- baseline deltas;
- provider/data status;
- neutral Context;
- evidence;
- explicit “no conclusion yet” states.

It does not currently manufacture State/Regime/Intelligence.

Presentation debt:
- user-facing UI still mixes Indonesian with English phrases such as “Market data from CoinGecko”, “Why this context matters”, “Select a context”, “FACTUAL ONLY”, and other internal labels;
- raw provider status is still rendered in at least the Crypto provider line (`coinGeckoHealth?.status`);
- Evidence relative time uses `capturedAt`, which currently aliases retrieval time and is acceptable but should eventually use the explicit intended presentation timestamp.

These are not foundation blockers, but they violate the repo's Indonesian UI governance and should be handled in a dedicated UI cleanup PR after structural blockers.

## 15. Documentation integrity audit

**CHANGES REQUIRED — HIGH.**

Several documents contain historical findings that are now false if read as current state.

Examples:
- `P365-DATA-GAP-ANALYSIS-v0.1.md` says DXY/equities/gold/oil/VIX/credit and some temporal fixes are missing, while current code implements them.
- `P365-DATA-SOURCE-ARCHITECTURE-v0.1.md` still marks cross-asset source selection as missing and its “immediate next checkpoint” as CoinGecko adapter, which is already implemented.
- `P365-TEMPORAL-PROVENANCE-CONTRACT-v0.1.md` current-repository-audit section describes old timestamp mappings that have since been fixed.
- `P365-CURRENT-STATE-v0.1.md` is dated 16 Sep and lags Biquote/Yahoo/heatmap/product-contract changes.
- `P365-ROADMAP-v0.1.md` is closer to code, but still has stale priority wording (“authoritative DXY” remains listed although DXY is implemented), and cache checkpoint status text conflicts with existing `cache-policy.ts`.

Recommendation: preserve historical audit documents as historical checkpoints, but add a prominent **SUPERSEDED / historical checkpoint** banner where appropriate and establish one current-state SSOT.

## 16. Security / dependency audit boundary

`package.json` still uses `next ^15.3.6`, while the roadmap records a known security issue for that line. Dependency remediation should be a separate isolated PR with build/runtime regression verification.

No secret is present in the audited source paths. Supabase write credentials are server-side environment variables.

## 17. Automated verification gap

Foundation-critical logic has limited visible automated test coverage.

At minimum future checkpoints should add tests for:
- canonical timestamp mapping;
- context scope classification;
- factual baseline compatibility;
- historical repository ordering/missing behavior;
- cache invalidation groups;
- event-result expectation/release semantics;
- persistence dedupe behavior at adapter boundaries.

Do not compensate for missing tests with broader architectural rewrites.

## 18. Severity-ranked findings

| ID | Severity | Finding |
|---|---|---|
| FND-001 | **HIGH / CONTRACT + DURABLE ADAPTER REMEDIATED** | Semantic historical Observation query contract and durable Supabase adapter now implement provider-independent logical-series identity separately from optional source provenance, inclusive effective-time bounds, canonical retrieval/as-of cutoff, deterministic revision ordering, and bounded results. Production REST E2E is pending deployment credentials; FND-002/FND-003 remain separate. |
| FND-002 | **HIGH** | Baseline uses current provider retrieval window instead of durable canonical history. |
| FND-003 | **HIGH** | Historical ingestion/persistence depends on dashboard access; no independent cadence/backfill owner. |
| FND-004 | **HIGH / INITIAL REMEDIATION PR #36 / REGRESSION CORRECTED IN THIS CHECKPOINT** | Historical broad-ASSET mixing was removed in PR #36, but its `crypto.*` prefix excluded CoinGecko BTC/ETH asset-level metrics. The corrected selector now uses qualified CoinGecko provenance plus non-empty canonical `metricId`, with focused runtime-builder regression coverage. |
| FND-005 | **HIGH / REMEDIATED IN PR #36** | Historical finding: documentation SSOT materially drifted from code. Consolidation made this file authoritative and retired competing current-state documents. |
| FND-006 | **HIGH** | Market Snapshot implementation absent; blocks valid pre/post-event reasoning. |
| FND-007 | **HIGH** | No Pricing baseline/market-implied layer; pricing surprise/repricing conclusions are not allowed. |
| FND-008 | MEDIUM | Biquote `time` → releasedAt/occurredAt semantic requires provider qualification. |
| FND-009 | **HIGH** | Confirmed manual-refresh defect: `p365-dashboard` invalidation does not clear cadence-tagged FRED/CoinGecko/CoinDesk/Yahoo fetches. |
| FND-010 | MEDIUM | Canonical provenance identity remains partly free-form metadata. |
| FND-011 | MEDIUM | Freshness is not fully release-calendar/market-hours aware. |
| FND-012 | MEDIUM | Non-crypto Yahoo adapter reuses `CryptoMarketObservationInput`. |
| FND-013 | MEDIUM | MOVE remains absent from target cross-asset universe. |
| FND-014 | MEDIUM | Expectation data exists at trial event-result level but has no baseline lifecycle. |
| FND-015 | MEDIUM | Foundation-critical automated tests are sparse. |
| FND-016 | LOW | UI still has English/raw-status governance leakage. |
| FND-017 | MEDIUM | Known Next.js dependency security remediation remains open per roadmap. |
| FND-018 | MEDIUM | Canonical ID strategy is hash-derived from mutable values/timestamps for several record families; correction/revision identity and lineage policy must be locked before history becomes authoritative. |
| FND-019 | MEDIUM | Current Event aggregation can represent the same real economic event from Forex Factory and Biquote as separate canonical Events; provider-independent event identity/reconciliation is not yet defined. |
| FND-020 | **HIGH** | Canonical `ObservationDomain = MARKET | MACRO | ASSET | OTHER` is too coarse for the global multi-asset product boundary. Current data already spans policy, liquidity/funding, fiscal, rates, FX, equity, credit, commodity, volatility and crypto semantics. An additive semantic-dimensions compatibility contract is required before broad provider expansion. |
| FND-021 | **HIGH / MVP COVERAGE GAP** | The approved MVP is **Macro + Crypto + Gold**. Current Macro remains materially US/Fed-centric and incomplete in policy expectations/pricing; Crypto lacks several qualified structural inputs such as stablecoin/ETF-flow/derivatives; Gold exists as pricing but lacks a complete historical/baseline/flow-positioning chain. Full Equity, broad Credit, broad Commodities beyond Gold and other multi-asset domains are post-MVP unless used as supporting evidence. |

## 19. Repair order

The dependency order is rebaselined after the 20 Sep financial-market-universe audit:

```text
A. Documentation SSOT + Financial Market Ontology rebaseline
   ↓
B. Additive canonical semantic-dimensions compatibility contract
   ↓
C. FND-003 Independent ingestion/history ownership + backfill policy
   ↓
D. FND-002 Repository-backed Factual Baseline
   ↓
E. Temporal/provenance/freshness + FND-018 identity/lineage hardening
   ↓
F. FND-009 cache invalidation + remaining current-foundation defects
   ↓
G. Complete the approved MVP universe — Macro + Crypto + Gold — in isolated domain/provider checkpoints
   ↓
H. Expectation Baseline lifecycle
   ↓
I. Pricing Baseline / market-implied data
   ↓
J. Market Snapshot implementation
   ↓
K. Event-window repricing / cross-asset transmission contract
   ↓
L. Secondary positioning / flow enrichment inside Macro + Crypto + Gold
   ↓
M. Only after gates: Derived State → Risk/Regime → Intelligence → Briefing
```

Ontology compatibility must not be combined with provider expansion. Existing durable history must remain reconstructable throughout migration.

## 20. Foundation completion gate

Do not call the foundation complete until:

- the additive financial-market semantic model can classify active facts without rewriting historical Market Memory;
- market domain and information class are independently representable for future canonical data;
- every active canonical source has documented identity/semantics/time/unit/provenance/quality;
- historical observations are queryable from P365-owned durable history;
- ingestion continuity does not depend on dashboard page views;
- factual baseline uses canonical historical observations rather than provider convenience fields;
- Context scopes cannot mix unrelated domains;
- source health/freshness/cache behavior is deterministic;
- current-state documentation agrees with code;
- remaining required factual gaps are explicitly implemented or consciously deferred;
- expectation and pricing remain distinct;
- immutable pre/post snapshots exist before transmission/repricing reasoning;
- tests cover the foundation invariants;
- build/lint pass for every implementation checkpoint.

## 21. Pre-merge verification of this audit PR

The audit PR itself was re-checked before merge:

- base is exactly `main@85b82b2e1827e77ba36af571e2396d8fbadebb68`;
- branch is 2 commits ahead and 0 behind;
- diff contains exactly one added documentation file; no runtime/source file is modified;
- PR is mergeable and GitHub reports a clean merge state;
- Vercel status on the audit head is successful/READY;
- there are no submitted code reviews or unresolved review threads at verification time.

Because this PR is documentation-only, the meaningful acceptance criterion is **audit accuracy and scope integrity**, not runtime behavior change. Runtime/build verification remains mandatory on each remediation PR.

## Checkpoint history

| Date | Checkpoint | Result |
|---|---|---|
| 16 Sep 2026 | Canonical/domain/data foundation | Provider → normalization → canonical Observation/Event/Evidence foundation established. |
| 17 Sep 2026 | Factual baseline + Market Memory foundation | FRED multi-observation baseline and durable append-only Supabase storage established; historical semantic retrieval still missing. |
| 17 Sep 2026 | Cross-asset/provider expansion | Yahoo Gold/Russell/DXY and broader cross-asset dashboard coverage integrated; DXY kept distinct from broad USD. |
| 17 Sep 2026 | Cache cadence migration | Fast/medium/slow cache groups implemented; manual invalidation defect remains FND-009. |
| 18 Sep 2026 | Retail trader/investor decision-support contract | Product value gate documented without introducing advisory/execution behavior. |
| 18 Sep 2026 | F0 end-to-end audit | 19 foundation findings established; higher-order reasoning remains blocked pending foundation remediation. |
| 18 Sep 2026 | Documentation consolidation | This file becomes the single operational foundation SSOT; redundant current-state/audit/roadmap docs retired. |
| 18 Sep 2026 | FND-004 Context taxonomy repair | CRYPTO_MARKET selection changed from broad ASSET-domain grouping to qualified CoinGecko `crypto.*` taxonomy; cross-assets excluded and global crypto metrics included. |
| 18 Sep 2026 | FND-001 Historical Observation repository contract | Added a provider-agnostic semantic history query contract and verified in-memory reference behavior; durable query adapter intentionally remains pending. |
| 18 Sep 2026 | FND-004 Context taxonomy regression correction | Independent re-audit found the PR #36 prefix selector excluded CoinGecko asset-level metrics; corrected to qualified CoinGecko provenance plus canonical metric identity, retaining cross-asset exclusion. |
| 18 Sep 2026 | Durable Historical Observation Query Adapter | Wired FND-001 to append-only Supabase Market Memory using semantic JSONB identity, effective-time bounds, canonical retrieval cutoff, deterministic revision ordering, and focused parity tests. Production REST E2E remains pending server-only deployment credentials; FND-002/FND-003 remain open. |
| 20 Sep 2026 | Financial Market Ontology & Data Foundation rebaseline | External benchmark + current-main read-only audit broadened the canonical ontology for future compatibility while preserving the implementation MVP as **Macro + Crypto + Gold**; documented domain/information-class axes, current-data mapping, gaps, compatibility rules, and revised dependency sequence without changing runtime code. |

## Active remediation sequence

```text
1. Documentation consolidation / SSOT                     ← PR #36
2. FND-004 Context taxonomy repair                        ← corrected
3. FND-001 Historical Observation repository contract     ← PR #37
4. Durable history query adapter                          ← PR #39; production E2E pending
5. Financial Market Ontology & Data Foundation v0.1       ← current documentation checkpoint
6. Additive semantic-dimensions compatibility contract    ← next after owner merge
7. FND-003 Independent ingestion/backfill ownership       ← pending
8. FND-002 Repository-backed Factual Baseline             ← pending
9. Temporal/provenance/freshness + ID lineage hardening
10. FND-009 Manual cache invalidation + current gaps
11. MVP market-universe completion: Macro + Crypto + Gold, one domain/provider checkpoint at a time
12. Expectation Baseline lifecycle
13. Pricing Baseline / market-implied layer
14. Market Snapshot implementation
15. Event-window cross-asset repricing/transmission
16. Secondary positioning / flows enrichment inside Macro + Crypto + Gold
17. Derived State → Risk/Regime → Intelligence → Briefing only after gates pass
```

One logical remediation = one PR = one verification checkpoint. This sequence may only change when a verified dependency requires it; changes must be recorded here.

## 22. Final audit conclusion

P365 should **not** restart its architecture and should **not** add a reasoning engine yet.

The correct strategy is to preserve the pipeline already present while broadening its semantics deliberately:

> **freeze the broad ontology for future compatibility, keep MVP delivery constrained to Macro + Crypto + Gold, add semantic dimensions without rewriting history, then complete those three scopes before broader first-class market expansion.**

Once those gates pass, the existing factual data becomes a defensible base for the retail trader/investor decision-support workflow defined by P365.
