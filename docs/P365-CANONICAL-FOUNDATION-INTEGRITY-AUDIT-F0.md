# P365 Foundation Master — SSOT v0.1

**Status:** **ACTIVE MASTER SSOT — current state, audit findings, remediation roadmap, and foundation gates**  
**Audited ref:** CAP-001 implementation based on `main@f8fce4de6cb2dc112b45fc6188567b6ae00676db`
**Audit boundary:** Product contract → source qualification → provider → ingestion → normalization → canonical domain → temporal/provenance → quality/health → context → persistence/history → baseline → snapshot readiness → cross-asset readiness → expectation/repricing readiness → presentation/UI → deferred reasoning boundaries.

**Verification pass:** Re-verified 24 Sep 2026 from `main@57fad3a441721b0513a3d513a6a0244280df11a4`. FND-003A/B/C remain operational through Supabase `pg_cron` → authenticated Vercel ingestion endpoints → durable Supabase Market Memory. FND-002, FND-002Q, FND-009, FND-011B, and FND-018A are CLOSED / production-active at their approved boundaries; FND-010A and FND-011A remain production-active. FND-011B passed its final production gate with scheduled historical ingestion HTTP 200 and a Yahoo `GC=F` observation carrying `CME_GLOBEX_GOLD` with `quality=FRESH` inside the qualified open session. FND-009 passed its production gate after an authenticated manual refresh produced `POST /dashboard 200` followed by `GET /dashboard 200`, zero runtime errors, and new CoinGecko/Yahoo/FRED retrieval timestamps well inside their ordinary cache lifetimes, proving cadence-group invalidation rather than a route-only refresh.

## Documentation authority

This is the **single operational SSOT for foundation development**. It owns:

- current implementation state;
- verified foundation findings (`FND-001`…`FND-021`);
- current factual coverage/gaps;
- remediation priority and sequencing;
- foundation completion gates;
- checkpoint history.

Normative contracts remain separate only where they define stable rules rather than project status: `P365-ARCHITECTURE.md`, `P365-USER-DECISION-SUPPORT-CONTRACT.md`, `P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md`, `P365-CANONICAL-SEMANTIC-DIMENSIONS-COMPATIBILITY-v0.1.md`, `P365-MVP-BTC-XAU-EVIDENCE-MAP-v0.1.md`, `P365-DATA-REQUIREMENTS-MATRIX-v0.1.md`, `P365-MARKET-SNAPSHOT-CONTRACT-v0.1.md`, and Market Memory governance/implementation contracts. `AGENTS.md` remains repository governance.

Older status, roadmap, gap-analysis, and audit documents are removed rather than kept as competing sources of current truth. Historical decisions are summarized in the checkpoint history at the end of this document.

## 1. Executive verdict

**FOUNDATION HARDENING EXIT: PASS — PRODUCT INTELLIGENCE CHAIN STILL INCOMPLETE**

P365 has a credible canonical-data architecture and the active code generally respects the decision-support boundary. Durable historical continuity is operational. The generic foundation-hardening phase is complete enough to exit: the remaining major work—Expectation Baseline, Pricing Baseline, immutable Market Snapshot, repricing/transmission, and later Intelligence—is now product-layer construction rather than justification for continuing open-ended foundation hardening. The coarse legacy `MARKET / MACRO / ASSET / OTHER` classification is now preserved only as a compatibility field while approved current Observations receive additive market-domain/information-class semantics. The **MVP implementation boundary remains Macro + Crypto + Gold**; the broader ontology exists to avoid future semantic dead ends, not to expand MVP indiscriminately.

The current system can independently ingest and normalize selected factual Observations and Events, create evidence-backed Context, persist canonical records, query contract-compliant Observation/Event history from durable Market Memory, and compute factual, expectation, and pricing reference baselines at their approved boundaries. SNP-001, EVW-001 and CMP-001 are merged and production-deployed as immutable Snapshot, qualified event-window, and factual Snapshot-comparison capabilities. Production Snapshot rows remain empty because the governed runtime capture owner is not yet merged/activated. CAP-001 now implements that runtime owner on the branch: deterministic as-of reconstruction for PRE/T+5/T+15/T+30/T+60 using durable Event/Observation/EventResult history, fixed MVP BTC/ETH/DXY/Gold capture slots, explicit missing/stale quality, authenticated cron boundary, and idempotent slot detection. Repricing, transmission and causal interpretation remain unimplemented and prohibited.

### Foundation readiness by layer

| Layer | Status | Audit result |
|---|---|---|
| Product/user contract | PASS | Retail trader/investor decision-support boundary is explicit. |
| Architecture layering | PASS / PARTIAL | Main runtime path follows Provider → Ingestion → Normalization → Canonical → Persistence/UI. Some naming/contracts still reflect dashboard-first evolution. |
| Source qualification | PARTIAL | Several source documents are stale relative to actual Yahoo/Biquote/FRED coverage. |
| Provider result semantics | PASS | SUCCESS/EMPTY/ERROR/UNAVAILABLE and retrieval timestamps are explicit. |
| Canonical observations | PASS / PARTIAL | Future FRED/CoinGecko/Yahoo writes carry versioned measurement/revision identity and typed source-native provenance; Event/Evidence provenance remains separate. |
| Events / event results | PARTIAL | Biquote provides actual/forecast/previous/revision. Only `timeMode=exact` currently qualifies provider `time` for occurrence/release timestamps; broader production qualification remains trial-only. |
| Evidence | PASS / PARTIAL | Publication/retrieval separation exists; source-native identity/endpoint is not uniformly first-class. |
| Temporal semantics | PASS / PARTIAL | Observation availability is canonical `retrievedAt`, separate from storage `captured_at`; exact source release remains missing when providers do not supply it. Event/provider release qualification remains incomplete. |
| Freshness/quality | PASS / PARTIAL | FND-011A makes registry-backed FRED quality cadence-aware and deterministic at acquisition time. FND-011B adds qualified regular-session/provider-window semantics for CoinGecko/Yahoo; exact exchange holiday/early-close calendars remain unmodeled. |
| Context | PASS for grouping | Neutral grouping is evidence-backed and does not infer direction. |
| Market Memory persistence | PASS for current canonical boundary | Append-only durable storage is active and read-only production verification confirms retrievable macro Observation history. |
| Historical retrieval | PASS | FND-001 semantics are implemented against persisted canonical Observation payloads; read-only production verification found 29 contract-eligible FRED macro series with predecessor depth. |
| Historical continuity | PASS for FND-003 operational boundary | Independent Observation/Event ingestion is driven by production Supabase `pg_cron` and persists to durable Market Memory. Scheduler redesign remains outside FND-002. |
| Factual baseline | FULL PASS / PRODUCTION E2E VERIFIED | Active application orchestration reads predecessor candidates only from `HistoricalObservationRepository`, with strict measurement and retrieval/as-of bounds and no provider-window fallback; production dashboard execution verified 29 durable history reads. |
| Expectation baseline | **EXP-001 MERGED / PRODUCTION DEPLOYED / E2E DATA PROOF PENDING** | Provider-scoped point-in-time EventResult history and latest-qualified pre-release Expectation Baseline selection are deployed on `main`. `FORECAST`, `CONSENSUS`, and `OFFICIAL_PROJECTION` remain distinct; post-release snapshots are ineligible. Production runtime is healthy, but no qualified FND-019 `EVENT_RESULT.eventIdentityKey` row exists yet, so natural E2E baseline proof remains pending. |
| Pricing baseline | **PRC-001 MERGED / PRODUCTION DEPLOYED / CONTRACT + DURABLE INPUT VERIFIED** | Point-in-time provider-scoped selection is deployed for existing canonical `PRICING` Observations with `observedAt` + `retrievedAt` as-of protection and explicit caller age tolerance. Production durable history contains qualified BTC/ETH, DXY, Gold, rates/real-yield/inflation-compensation and other pricing inputs. No active runtime consumer calls the selector yet. OIS/Fed-funds/SOFR-futures policy-path pricing remains a separate source-coverage gap. |
| Historical baseline | MISSING | No approved methodology/query implementation. |
| Cross-asset baseline | **PARTIAL / SNP-001 + EVW-001 + CMP-001 PRODUCTION CAPABILITIES / CAP-001 RUNTIME OWNER IMPLEMENTED** | Immutable Snapshot persistence/query, qualified event windows, and factual Snapshot comparison are production-deployed. CAP-001 adds deterministic runtime materialization of PRE/T+5/T+15/T+30/T+60 reference sets from durable history for BTC/ETH/DXY/Gold plus expectation/pricing baseline lineage. Production scheduler activation and natural Snapshot evidence remain pending owner merge/activation; repricing semantics remain separate. |
| Market Snapshot | **SNP-001 PRODUCTION DEPLOYED / CAP-001 RUNTIME OWNER IMPLEMENTED — OWNER MERGE + ACTIVATION PENDING** | Immutable reference-only Snapshot construction/persistence is production-deployed. CAP-001 implements deterministic as-of event-window materialization on the branch, but production verification still has zero `SNAPSHOT` rows because the new `/api/cron/snapshot-capture` route is not yet merged or scheduled. |
| Cross-asset factual coverage | PARTIAL | Useful universe exists; MOVE remains absent and docs disagree on credit coverage. |
| Transmission reasoning | **CMP-001 MERGED / CAP-001 RUNTIME EVIDENCE GATE IN PROGRESS / REPRICING + TRANSMISSION STILL MISSING** | Factual Snapshot comparison is production-deployed. CAP-001 supplies the missing runtime Snapshot owner, but production PRE/POST evidence remains pending merge/scheduler activation. No thresholding, repricing classification, causal attribution, cross-asset transmission conclusion, State or Intelligence is implemented. |
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
Historical retrieval         DURABLE ADAPTER + PRODUCTION HISTORY VERIFIED
Factual baseline             REPOSITORY-BACKED FULL PASS / FND-002Q PRODUCTION E2E VERIFIED
Observation identity        FND-018A FULL PASS / CLOSED / PRODUCTION ACTIVE
Observation provenance      FND-010A PRODUCTION ACTIVE
Macro freshness             FND-011A PRODUCTION ACTIVE
Independent ingestion        OPERATIONAL (FND-003A/B/C)
Expectation baseline         EXP-001 MERGED / PRODUCTION DEPLOYED / E2E PENDING
Pricing baseline             PRC-001 MERGED / PRODUCTION DEPLOYED
Market Snapshot              SNP-001 MERGED / PRODUCTION DEPLOYED / RUNTIME CAPTURE PENDING
Event Window Policy           EVW-001 MERGED / PRODUCTION DEPLOYED
Snapshot Comparison           CMP-001 MERGED / PRODUCTION DEPLOYED / RUNTIME E2E PENDING
Runtime Snapshot Capture       CAP-001 IMPLEMENTATION PASS / PREVIEW VERIFIED
Transmission reasoning       MISSING
Financial-market ontology    DOCUMENTED / ADDITIVE RUNTIME COMPATIBILITY IMPLEMENTED
MVP Macro+Crypto+Gold       PARTIAL / ACTIVE TARGET
Broader multi-asset coverage  POST-MVP / ONTOLOGY-DEFINED
State / Regime / Risk        DEFERRED
Intelligence / Briefing      DEFERRED
```

### Current factual coverage

- **Macro:** FRED covers the approved monetary-policy, liquidity, inflation, labor, rates, broad-USD and growth foundation.
- **Crypto:** CoinGecko covers BTC/ETH spot, BTC/ETH market cap, total crypto market cap, total volume and BTC/ETH dominance. Stablecoin market cap and a defined basic-volatility metric remain open.
- **Cross-asset:** S&P 500, Nasdaq, Russell 2000, US 2Y, US 10Y, 10Y real yield, DXY, broad USD, Gold futures, WTI, VIX and IG/HY credit spreads are available. DXY and broad USD remain separate instruments. MOVE remains open.
- **Economic events:** Forex Factory provides a weekly scheduled calendar, Federal Reserve provides official FOMC date anchors, and Biquote trial data provides structured schedules/results for verified US, China and Japan examples. Biquote remains trial-only; response-window completeness and release-time qualification remain open.
- **Event risk window (presentation only):** the overview lists HIGH-importance canonical Events from 30 minutes ago to 24 hours ahead, grouped by scheduled minute, as schedule facts only (no direction, no advice). Federal Reserve dates are date anchors and are shown without a countdown. The Forex Factory list is capped at the nearest `ECONOMIC_CALENDAR_LIMIT` events of any impact, so the panel states when events beyond its last loaded event are unknown; absence in the panel is not evidence of absence. Qualified cross-provider Events can now carry FND-019 identity/reconciliation; production activation proof remains under a separate read-only watch.
- **Semantic breadth:** the FRED registry contains 33 series and current Yahoo/CoinGecko market metrics now receive additive `Observation.semantics` during normalization. Legacy `ObservationDomain` remains unchanged for history compatibility; old Market Memory rows can resolve approved semantics from stable `seriesId`/`metricId` without rewrite.
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
  ├──→ HistoricalObservationRepository → point-in-time Factual Baseline
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

FND-003A now establishes the scheduler-agnostic Observation worker boundary:

```text
Authenticated external caller
  ↓ explicit mode + providers
/api/cron/historical-ingestion
  ↓ FRESH acquisition (no Next.js data cache)
selected CoinGecko / Gold / DXY / Russell / FRED adapter only
  ↓ existing canonical normalization
append-only Observation + Evidence persistence
```

`providers` is mandatory. `BACKFILL` is explicitly limited to FRED with valid inclusive date bounds; current-state CoinGecko/Yahoo adapters must not be represented as historical backfill sources. No Vercel cron schedule is installed by this checkpoint.

FND-003B establishes a separate scheduler-agnostic event boundary:

```text
Authenticated external caller
  ↓ explicit providers + jurisdictions
/api/cron/event-ingestion
  ↓ FRESH acquisition (no Next.js data cache)
selected Forex Factory / Biquote / Federal Reserve adapter only
  ↓ explicit native-code → canonical jurisdiction mapping
append-only Event + Evidence + EconomicEventResult persistence
```

Runtime jurisdictions are deliberately restricted to `US`, `CHINA`, and `JAPAN`. Forex Factory mappings are `USD/CNY/JPY`; Biquote mappings are `US/CN/JP`; unknown codes do not default to an approved jurisdiction. `Event.jurisdiction` is optional for backward compatibility with legacy rows. The independent Forex Factory/Federal Reserve paths do not inherit the six-event dashboard cap, while dashboard calls retain cached defaults. Biquote requests up to its current approved limit and explicitly reports when that limit is reached, so a bounded provider response is not represented as proven calendar completeness.

Live read-only verification on 20 Sep 2026 found representative Biquote coverage for US inflation/labor/growth/FOMC, China GDP/industrial production/retail sales/official and Caixin PMI/CPI/PPI/M2/new loans, and Japan BoJ policy events/CPI/GDP/industrial production/retail sales/PMI/Tankan/wages/labor. China trade, aggregate financing, LPR, MLF and RRR families were not verified in the inspected window. Some China and BoJ records use provider `timeMode=tentative`; `tentative`, `date`, `notime`, missing, and otherwise unqualified modes retain the provider time only as the existing calendar anchor/provenance and are not promoted to exact `occurredAt`/`releasedAt`. Actual/result values remain durable when exact release time is unknown. Forex Factory's current weekly feed contained `USD`, `CNY` and `JPY` records but is not evidence of complete family coverage.

FND-003C initially added a GitHub Actions external trial-clock candidate with staggered provider-specific lanes:

```text
market-fast     02,07,...,57 UTC  → coingecko,gold,dxy FORWARD
event-fast      04,09,...,59 UTC  → Biquote HIGH, US/CHINA/JAPAN, rolling ±6h, limit 20
fred            minute 31 hourly  → fred FORWARD
event-calendar  minute 41 / 6h    → forex-factory,federal-reserve
```

The repository retains the GitHub Actions workflow only as a manual `workflow_dispatch` fallback. Its four recurring `schedule` triggers are retired because production scheduling is fully owned by Supabase `pg_cron`; keeping both clocks active would duplicate provider/API calls and consume GitHub Actions capacity unnecessarily. Supabase `pg_cron` remains the sole automatic ingestion scheduler and invokes the same authenticated Vercel endpoints into durable Market Memory.

Biquote polling is deliberately bounded because existing durable data shows retrieval-capture amplification: recent dashboard batches fetched 50 Biquote rows at a time, and one sampled 50-row Event batch contained 1 HIGH, 5 MEDIUM and 44 LOW events. Repeating an unbounded 50-row capture every five minutes could create up to 14,400 Evidence captures/day before considering other record types. The FND-003C fast lane therefore requests only HIGH events in a rolling 12-hour window with a hard limit of 20. This makes the theoretical Evidence ceiling 5,760/day if every run hits the cap, while actual post-merge volume must still be measured. Event/EventResult semantic dedupe remains separate from Evidence retrieval-capture semantics.

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

When actual exists and Biquote supplies `timeMode=exact`, normalization may assign provider `record.time` to canonical `occurredAt` and `releasedAt`. For `tentative`, `date`, `notime`, missing, or otherwise unqualified modes, the clock component is not promoted into an exact occurrence/release timestamp; actual, forecast, previous and revision values remain durable without one. Biquote remains trial/partially qualified, and FND-008 remains open for broader provider release-time qualification before production-grade surprise timing is claimed.

### Federal Reserve — PASS for schedule / PARTIAL for event completion

Official FOMC schedule is kept as a date anchor. It correctly does not fabricate a decision release time. FND-003B can persist these schedule facts independently; exact decision-result/publication ingestion remains missing from the official-source path.

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

FND-010A adds optional versioned `Observation.provenance` for future qualified writes. It records a credential-free provider resource plus applicable native series/instrument/symbol and provider observation/vintage dates. `sourceId` remains the only canonical provider identity. Existing `metadata.seriesId`, `metricId`, `symbol`, `unit`, and `frequency` remain for history/baseline compatibility; legacy rows without provenance remain valid.

### Event — PASS / PARTIAL

Schedule, occurrence, release and retrieval concepts are distinct. New FND-003B Events carry optional canonical jurisdiction when determinable; legacy Events remain valid without it. Source-native event identity is not uniformly first-class.

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
- P365-known-at availability in Observation `retrievedAt`;
- Market Memory write time separately in database `captured_at`;
- news publication separately from retrieval;
- event schedule separately from retrieval;
- missing FRED release time as missing.

FND-010A makes current Observation source-native provenance typed without inventing source availability. FRED `observationDate` and `vintageDate` remain provenance only; neither is promoted to `releasedAt`. `retrievedAtOnOrBefore` answers what P365 had acquired by cutoff T, not when a provider first published the fact.

Remaining gaps:
- exact source-release availability remains unknown where the provider does not supply it;
- Event/Evidence structured provenance remains outside FND-010A;
- FND-011A macro freshness is cadence-aware but is not an exact provider release-calendar model;
- FND-011B models regular weekly Yahoo/CoinGecko market sessions but intentionally does not claim exact exchange holiday or early-close calendars.

## 7. Quality, health and cache audit

### PASS

Provider result states preserve failure semantics. Canonical quality distinguishes FRESH/STALE/PARTIAL/UNKNOWN. Cache cadence is separated from canonical freshness.

FND-011A evaluates registry-backed FRED quality using the Observation's canonical `retrievedAt`, never the normalization wall clock. DAILY and WEEKLY retain their conservative observation-date anchor. MONTHLY tolerance begins at the end of the observation month; QUARTERLY tolerance begins at the end of the observation quarter. The monthly tolerance is series-qualified: `FEDFUNDS`, `CPIAUCSL`, `CPILFESL`, `UNRATE`, `PAYEMS`, and `SAHMREALTIME` use 45 days; the later-publishing `M2SL`, `PCEPI`, `PCEPILFE`, `JTSJOL`, and `JTSQUR` use 65 days. These references and tolerances are quality-policy boundaries only; they do not create `releasedAt`, an exact publication time, or an inferred release calendar.

The policy is grounded in official cadence evidence rather than hard-coded release dates: the [BLS CPI schedule](https://www.bls.gov/schedule/news_release/cpi.htm) and [Employment Situation schedule](https://www.bls.gov/schedule/news_release/empsit.htm) publish the following month; the [BLS September 2026 schedule](https://www.bls.gov/schedule/2026/09_sched.htm) shows July JOLTS on 1 September and August JOLTS on 29 September; the [BEA release schedule](https://www.bea.gov/news/schedule/full) places Personal Income and Outlays late in the following month; and the [Federal Reserve H.6 page](https://www.federalreserve.gov/releases/h6/) identifies its normal fourth-Tuesday monthly cadence. The runtime records only the conservative tolerance, not a synthetic next-release timestamp.

A 21 Sep 2026 production read-only re-audit of the latest 33 contract-eligible FRED series found stored quality of DAILY 14 FRESH / 2 STALE, WEEKLY 4 FRESH / 1 STALE, MONTHLY 0 FRESH / 11 STALE, and QUARTERLY 0 FRESH / 1 STALE. Applying the corrected registry policy to the same `observedAt`/`retrievedAt` contexts projects all 11 monthly series and Q2 `GDPC1` as FRESH; `DCOILWTICO`, `DTWEXBGS`, and `CCSA` remain genuinely stale under the unchanged conservative DAILY/WEEKLY policy. Production rows are not rewritten. After owner merge/deployment, runtime normalization uses the new policy; only new measurements or factual revisions append a new quality-bearing row, while unchanged revision identities continue to dedupe as required by FND-018A.

FND-002Q locks the durable-history interpretation boundary. Existing predecessor rows retain their immutable stored `quality`, and `HistoricalObservationRepository` returns them unchanged. The factual-baseline layer now distinguishes current-observation freshness from historical-predecessor fitness: a semantically compatible, strictly earlier, point-in-time-available predecessor with stored `STALE` quality remains usable because STALE is a cadence/recency classification, not evidence that the historical fact is invalid. `UNKNOWN` and `PARTIAL` predecessors remain insufficient. No read-time cadence recomputation, quality rewrite, backfill, or repository-policy change is introduced.

FND-011B separates continuous markets from sessioned/provider-window markets and evaluates both against canonical `retrievedAt` rather than the normalization wall clock. CoinGecko is explicitly `CONTINUOUS_24_7`, so its 15-minute realtime threshold continues to age on weekends. Yahoo instruments are mapped to qualified regular windows: COMEX Gold (`GC=F`) uses the CME Globex Sunday-Friday 18:00-17:00 ET schedule with the daily 17:00-18:00 maintenance break; ICE USDX (`DX-Y.NYB`) uses the ICE Sunday 18:00 ET open plus weekday 20:00-17:00 ET electronic session. Yahoo `^RUT` is the Russell 2000 cash-index observation: underlying US exchange closes are 16:00 ET, while production Yahoo observations can carry a final provider timestamp around 16:30 ET, so P365 uses a bounded 09:30-16:31 ET provider freshness window without representing that extension as an official LSEG market-close or publication schedule. The policy is DST-aware through `America/New_York` and stops time outside the qualified window from consuming the 15-minute freshness budget. It does not fabricate exchange holiday status or early-close timestamps.

Production history demonstrates the defect this corrects: on Sunday 20 Sep at 13:14 UTC, Yahoo still returned Friday 18 Sep closes for `GC=F`, `^RUT`, and `DX-Y.NYB`; the old wall-clock policy stored all three as STALE although their qualified freshness windows were closed. After the Sunday reopen, GC and DXY began updating again around 22:01 UTC and became FRESH, while Russell remained on its Friday cash close. FND-011B preserves that distinction deterministically. Official schedule qualification is used for CME Gold and ICE USDX. Russell uses the underlying US cash-session boundary plus the observed Yahoo post-close timestamp behavior as an explicitly provider-qualified window; it is not presented as an official LSEG publication schedule. Exact holiday/early-close calendars remain outside this checkpoint.


### PARTIAL

ProviderHealth maps SUCCESS to HEALTHY regardless of canonical item quality, with a special FRED override when all normalized macro facts are stale. That means health and data quality are related but not uniformly composed across providers.

FND-009 corrects the confirmed manual-refresh defect. Dashboard-cached providers now share one authoritative invalidation topology in `lib/data/cache-policy.ts`: the retained legacy `p365-dashboard` tag plus cadence groups `p365-fast`, `p365-medium`, and `p365-slow`. The **Muat ulang manual** Server Action iterates that complete set rather than invalidating only the legacy tag. This preserves provider-specific cache cadence while making explicit user refresh semantics truthful again. Production verification remains gated on owner merge/deployment; independent ingestion continues to use `cache: "no-store"` and is unaffected.

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
4. FND-018A future Observation writes separate FND-001 logical series identity from measurement identity and revision identity. Measurement identity is `domain + seriesKey + normalized observedAt`; a SHA-256 revision fingerprint additionally covers source provenance, canonicalized factual value, unit and frequency while deliberately excluding `retrievedAt`.
5. Compatibility boundary: future v1 revision IDs intentionally differ from legacy weak-hash IDs. The first post-merge retrieval of an unchanged legacy fact can therefore append one semantically equivalent v1 row. Legacy rows and IDs are never rewritten, old `Context.observationIds` and `FactualBaseline` references remain resolvable, history reads both formats, and subsequent identical v1 refetches dedupe. This bounded transition risk is preferred over silently losing future corrections.
6. A read-only production audit found one confirmed FRED correction (`CCSA`, measurement `2026-08-29`, values `1774000` then `1769000`) already preserved because the legacy FRED ID included value. A second apparent FRED difference was numeric formatting only. No stored CoinGecko/Yahoo correction was observed; for those providers this checkpoint addresses a structural correctness risk because their legacy IDs could collapse a changed value at the same timestamp.
7. Dashboard read remains one ingestion/persistence trigger, but FND-003A adds an authenticated independent Observation endpoint that can be invoked without rendering the dashboard.
8. FND-003A supports explicit provider selection, cache-bypassing forward acquisition, and FRED-only bounded backfill that follows provider pagination until range exhaustion is proven. FND-003B adds explicit provider/jurisdiction selection, fresh Event acquisition and append-only Event/Evidence/EventResult writes for US/China/Japan. `CRON_SECRET` fails closed. FND-003C is operational through production Supabase `pg_cron`; scheduler changes are not part of FND-002.
9. The active factual macro baseline reads durable Observation history through `HistoricalObservationRepository`. A read-only production check found 29 FRED macro series with 7–11 distinct contract-eligible measurements each; no production data was mutated.
10. New Observation canonical IDs are revision-specific, so Observation revisions do not share an ID and `findById` ambiguity is not introduced by FND-018A. The generic repository still uses `limit=1` without explicit ordering for other record families; that non-Observation follow-up remains outside this checkpoint.
11. FND-018A production activation is verified: v1 rows are present for FRED/CoinGecko/Yahoo, legacy and v1 history coexist, and a read-only audit found zero duplicate v1 canonical revision/effective-time groups.
12. Pre-FND-010A production provenance was metadata-only. Post-merge activation at 10:02 UTC wrote 10 structured-provenance Observations (8 CoinGecko, 2 Yahoo), all identity v1, with zero duplicate canonical IDs and zero runtime errors. Unchanged FRED revisions may correctly dedupe against existing v1 rows, so no destructive backfill is used to force a FRED provenance example. The owner dashboard smoke remains pending.

Market Memory therefore has durable storage, independently maintained continuity, semantic Observation history retrieval, active additive revision identity, and production-active structured Observation provenance. FND-002 repository ownership and FND-018A are closed. FND-011A does not rewrite legacy history; new measurements/revisions carry cadence-aware quality and unchanged factual identities retain idempotent dedupe. FND-002Q likewise leaves legacy quality authoritative on each Observation while interpreting stored STALE predecessors as historically usable only at the factual-baseline layer.

## 10. Baseline audit

### Factual baseline — FULL PASS / PRODUCTION E2E VERIFIED

The selector checks:
- domain;
- source;
- series;
- unit;
- frequency;
- temporal ordering;
- current freshness;
- historical predecessor factual fitness.

It exposes MISSING/INCOMPATIBLE/STALE/UNKNOWN instead of fabricating a delta.

The normalization layer now emits canonical current macro facts without building a baseline. Application orchestration selects the deterministic current fact for each semantic series, queries `HistoricalObservationRepository` with a strict bound before the current measurement plus `retrievedAtOnOrBefore <= current.retrievedAt`, and delegates compatible predecessor selection to the pure domain selector.

Provider-window history is never passed as a baseline candidate. Empty or incompatible repository history stays `MISSING`/`INCOMPATIBLE`; repository read failure becomes explicit `UNKNOWN` with no fabricated fallback. Same-measurement revisions are excluded, later-retrieved corrections cannot leak into an earlier point-in-time context, and same-period revision ties use retrieval time plus canonical ID for deterministic selection. Descriptive subject changes do not break semantic-series compatibility.

Production verification after PR #49 merge returned `/dashboard` HTTP 200 and recorded 29 service-role `HistoricalObservationRepository` reads against durable Market Memory. FND-018A regression coverage preserves the strict predecessor rule: a correction sharing the current measurement cannot become a previous-period baseline.

FND-002Q makes quality asymmetric without changing selection. Current `FRESH` is required for a VALID baseline; current `STALE` yields STALE; current `UNKNOWN`/`PARTIAL` yields UNKNOWN. A selected predecessor may be `FRESH` or `STALE`, because historical age does not invalidate a factual comparison. Predecessor `UNKNOWN`/`PARTIAL` remains fail-safe UNKNOWN. Additive `currentObservationQuality`, `baselineObservationQuality`, and `qualityPolicy = current-freshness-historical-fitness-v1` fields preserve auditability when a VALID baseline references a stored STALE predecessor.

A production read-only re-audit found 33 FRED series with a strict point-in-time predecessor: 18 predecessors stored FRESH, 15 stored STALE, and none UNKNOWN/PARTIAL. All 15 STALE predecessors become eligible historical facts under FND-002Q, but only one audited series (`ICSA`) currently combines a FRESH current observation with a STALE predecessor and would therefore become VALID immediately. The other 14 still have STALE current observations and remain STALE; usability of the predecessor does not override current freshness. Representative immutable STALE predecessors include CPI July, GDP Q1, lagged monthly families, and continued claims. No production row was mutated.

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
| FND-001 | **REMEDIATED** | Semantic historical Observation query contract and durable Supabase adapter implement logical-series identity, optional source provenance, effective-time/as-of bounds, deterministic revision ordering, and bounded results. Production history depth was verified read-only for 29 FRED macro series. |
| FND-002 | **FULL PASS / CLOSED / PRODUCTION E2E VERIFIED** | Active factual macro baseline candidates come only from `HistoricalObservationRepository`; production `/dashboard` completed with 29 service-role history reads, and point-in-time/no-fallback behavior remains regression-covered. |
| FND-002Q | **FULL PASS / CLOSED / PRODUCTION E2E VERIFIED** | Historical factual predecessor fitness is separated from current freshness. Stored STALE predecessors remain immutable but usable when compatibility, strict earlier measurement, and point-in-time availability hold; UNKNOWN/PARTIAL remain fail-safe. |
| FND-003 | **REMEDIATED OPERATIONALLY** | Production Supabase `pg_cron` invokes authenticated Vercel Observation/Event ingestion endpoints and durable Market Memory contains continuing canonical writes. GitHub scheduler redesign is not reopened by FND-002. |
| FND-004 | **HIGH / INITIAL REMEDIATION PR #36 / REGRESSION CORRECTED IN THIS CHECKPOINT** | Historical broad-ASSET mixing was removed in PR #36, but its `crypto.*` prefix excluded CoinGecko BTC/ETH asset-level metrics. The corrected selector now uses qualified CoinGecko provenance plus non-empty canonical `metricId`, with focused runtime-builder regression coverage. |
| FND-005 | **HIGH / REMEDIATED IN PR #36** | Historical finding: documentation SSOT materially drifted from code. Consolidation made this file authoritative and retired competing current-state documents. |
| FND-006 | **SNP-001 REMEDIATED / PRODUCTION DEPLOYED** | Immutable point-in-time Snapshot capture, append-only persistence and historical retrieval are production-deployed. No runtime capture owner exists yet, so durable Snapshot rows remain empty until the event-window capture lifecycle is activated. |
| FND-007 | **PRC-001 BASELINE CONTRACT REMEDIATED / POLICY-PATH COVERAGE PARTIAL** | Canonical point-in-time Pricing Baseline is merged and production-deployed for approved `PRICING` observations. OIS/Fed-funds/SOFR-futures implied policy-path coverage remains missing, so policy-probability repricing claims are still prohibited. |
| FND-008 | MEDIUM | FND-003B now gates Biquote `time` → `releasedAt`/`occurredAt` promotion on `timeMode=exact`; broader provider release-time semantics and production qualification remain open. |
| FND-009 | **CLOSED / PRODUCTION ACTIVE** | Manual refresh invalidates the authoritative complete dashboard cache-tag set: retained legacy `p365-dashboard` plus `p365-fast`, `p365-medium`, and `p365-slow`. Production E2E verified an authenticated refresh at 02:10:36 UTC with `POST /dashboard 200` → `GET /dashboard 200`, zero runtime errors, and new CoinGecko/Yahoo/FRED retrieval timestamps before their normal cache TTLs expired. |
| FND-010 | **OBSERVATION PORTION REMEDIATED BY FND-010A / REMAINDER OPEN** | Future qualified FRED/CoinGecko/Yahoo Observations carry typed source-native resource/identity/date provenance while retaining legacy metadata. Exact provider release time is not fabricated. Event/Evidence provenance and broader provider qualification remain separate. |
| FND-011 | **FND-011A PRODUCTION ACTIVE / FND-011B CLOSED / PRODUCTION ACTIVE** | FRED cadence freshness remains acquisition-time deterministic. FND-011B production activation is verified: scheduled historical ingestion returned HTTP 200 and a Yahoo `GC=F` observation inside the qualified CME Globex Gold window persisted `freshnessCalendar=CME_GLOBEX_GOLD` with `quality=FRESH`. Exact holiday/early-close calendars remain an explicit future qualification boundary rather than fabricated runtime state. |
| FND-012 | MEDIUM | Non-crypto Yahoo adapter reuses `CryptoMarketObservationInput`. |
| FND-013 | MEDIUM | MOVE remains absent from target cross-asset universe. |
| FND-014 | **EXP-001 BASELINE CONTRACT REMEDIATED / E2E DATA PROOF PENDING** | Provider-scoped point-in-time Expectation Baseline is merged and production-deployed; natural qualified `eventIdentityKey` EventResult history is still accruing, so production E2E proof remains pending. |
| FND-015 | MEDIUM | Foundation-critical coverage remains incomplete, although FND-003A/B now have focused runner, auth, normalization, cache-policy, idempotency and failure-isolation regression tests. |
| FND-016 | LOW | UI still has English/raw-status governance leakage. |
| FND-017 | **REMEDIATED IN PR #65 / OWNER MERGE PENDING** | Upgrades the Next.js 15 maintenance line to `15.5.26`, aligns `eslint-config-next` to `15.5.26`, moves stable `typedRoutes` out of `experimental`, and overrides vulnerable transitive PostCSS/Sharp versions to `8.5.28`/`0.35.4`. Verified resolver output reports `npm audit` 0 vulnerabilities; lint and production build pass. |
| FND-018 | **OBSERVATION FND-018A FULL PASS / CLOSED / REMAINDER OPEN** | Production-active Observation writes use SHA-256 versioned measurement/revision identity: identical factual refetches dedupe, changed values survive as distinct immutable revisions, and `retrievedAt` remains availability rather than revision content. Legacy rows remain readable without rewrite. Event/Evidence and other record-family lineage remain separate. |
| FND-019 | **IMPLEMENTATION PASS — PREVIEW VERIFIED / PRODUCTION ACTIVATION PENDING OWNER MERGE** | Additive Event identity v1 defines a conservative provider-independent reconciliation key from qualified jurisdiction + exact scheduled instant + deterministic semantic event key. Provider-specific `Event.id`, Evidence and source lineage remain unchanged; `EconomicEventResult` carries the provider-independent event key; dashboard aggregation reconciles qualified duplicates deterministically while unqualified/`OTHER`/non-exact events remain separate. Regression coverage includes verified production-shaped pairs (`Crude Oil Inventories` ↔ `EIA Crude Oil Stocks Change`; Barr speech role wording) and a same-timestamp non-match (`EIA Crude Oil Imports Change`). Vercel preview build is READY/SUCCESS. |
| FND-020 | **REMEDIATED** | Additive semantic dimensions preserve legacy `ObservationDomain` and FND-001 history identity. FND-018A changes only future Observation revision IDs; legacy canonical IDs/rows remain immutable and readable without destructive backfill. |
| FND-021 | **HIGH / MVP COVERAGE GAP** | The approved MVP is **Macro + Crypto + Gold**. Current Macro remains materially US/Fed-centric and incomplete in policy expectations/pricing; Crypto lacks several qualified structural inputs such as stablecoin/ETF-flow/derivatives; Gold exists as pricing but lacks a complete historical/baseline/flow-positioning chain. Full Equity, broad Credit, broad Commodities beyond Gold and other multi-asset domains are post-MVP unless used as supporting evidence. |
| FND-022 | **REMEDIATED IN PR / OWNER MERGE PENDING** | Dashboard rendering no longer persists normalized canonical records or EventResults; durable ingestion ownership remains exclusively with authenticated cron workers. The four direct Supabase Market Memory/EventResult fetches plus the HistoricalObservation query used by dashboard factual baselines now fail bounded after 10 seconds via `AbortSignal.timeout`, preventing a slow Supabase request from hanging the render or worker path indefinitely. |
| CAP-001A | **CORRECTION IN PR / OWNER MERGE PENDING** | Production CAP run at 2026-09-24T12:26:00Z returned `candidateEvents=0` even though durable Market Memory contained a valid HIGH Initial Jobless Claims Event scheduled for 12:30Z and retrieved at 06:34Z. The Supabase HistoricalEvent adapter encoded JSON equality filters as quoted PostgREST values (`eq."..."`); CAP-001A switches Event identity/importance filters to raw `eq.<value>` form, adds a 10-second read timeout, and updates the production-shaped regression. CAP reconstruction lookback remains 90 minutes, so missed PRE/T+5 slots can be recovered after merge without changing semantic target timestamps. |

## 19. Repair order

The dependency order is rebaselined after the 20 Sep financial-market-universe audit:

```text
A. Documentation SSOT + Financial Market Ontology rebaseline
   ↓
B. Additive canonical semantic-dimensions compatibility contract
   ↓
C1. FND-003A provider-selective fresh Observation worker + bounded FRED backfill
   ↓
C2. FND-003B independent Event/FOMC ingestion
   ↓
C3. FND-003C external intraday cadence + production activation proof
   ↓
D. FND-002 Repository-backed Factual Baseline
   ↓
E1. FND-018A Canonical Observation identity/revision lineage
   ↓
E2. FND-010A Structured Observation provenance/availability
   ↓
E3. FND-011A FRED/Macro cadence-aware freshness
   ↓
E4. FND-002Q Historical Factual Baseline Quality Compatibility
   ↓
E5. FND-011B market-hours freshness in a separate checkpoint
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

### MVP product-completion gate

Before P365 expands another market into a first-class product domain, the **Macro + Crypto + Gold** vertical slice must be able to answer, with auditable evidence and point-in-time semantics:

1. what materially changed in Macro;
2. what the correct factual/expectation/pricing baseline was;
3. whether an event produced surprise and/or repricing;
4. how rates, real yields, USD and liquidity/funding changed;
5. how Crypto responded;
6. how Gold responded;
7. what qualified flow/positioning/structure evidence confirms or contradicts the move;
8. whether the condition is unusual against a defined historical baseline;
9. what material catalyst or invalidation should be monitored next.

Until this gate is met, additional first-class Equity, broad Credit, broad Commodity, or other multi-asset expansion is post-MVP. Existing observations from those domains may still serve as supporting evidence.

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
| 20 Sep 2026 | MVP user/value boundary refinement | Primary MVP user narrowed to a self-directed Crypto + Gold trader with Macro as the explanatory layer; scope expansion is now gated on completing an auditable Macro → Crypto/Gold intelligence vertical slice. |
| 20 Sep 2026 | BTC + XAU Evidence & Relationship Map v0.1 | Defined the normative shared Macro driver stack, BTC-specific flow/derivatives evidence, Gold-specific flow/positioning evidence, relationship-statistic contract, event-window evidence model, and readiness gate without adding providers or runtime reasoning. |
| 20 Sep 2026 | Additive canonical semantic dimensions | Added optional versioned semantic dimensions to canonical Observation writes, explicit mappings for all active FRED/Yahoo/CoinGecko series, and legacy read-time resolution without rewriting Market Memory or changing FND-001 history identity. |
| 20 Sep 2026 | FND-003A intraday ingestion control | Added a fail-closed authenticated scheduler-agnostic Observation worker with mandatory provider selection, explicit FORWARD/BACKFILL modes, fresh no-cache acquisition, per-provider reporting/failure isolation, and exhaustive FRED-only bounded backfill. Pagination/range completeness and Bearer authorization are covered by focused regression tests. Event ingestion, scheduler activation and production proof remain separate checkpoints. |
| 20 Sep 2026 | FND-003B multi-jurisdiction Event ingestion | Added a fail-closed provider-selective Event/EventResult worker for the US + China + Japan MVP, explicit native jurisdiction mappings, fresh acquisition, uncapped durable Forex Factory/FOMC windows, append-only Biquote result snapshots and provider-failure isolation. Biquote remains trial-only; provider-window and China/Japan family gaps stay explicit. FND-019 reconciliation and FND-003C scheduling/production activation remain open. |
| 20 Sep 2026 | FND-003C external cadence implementation | Initially prepared staggered GitHub Actions lanes and bounded Biquote polling; the subsequent production activation uses Supabase `pg_cron` instead of reopening that workflow design. |
| 20 Sep 2026 | FND-003C production activation | Production external cadence moved to Supabase `pg_cron`, invoking authenticated Vercel ingestion endpoints and persisting canonical records to durable Supabase Market Memory. |
| 24 Sep 2026 | FND-003C GitHub schedule retirement | Production audit found the legacy `.github/workflows/p365-ingestion.yml` schedule still firing after the Supabase migration, duplicating market-fast, event-fast, FRED, and event-calendar lanes. The recurring GitHub `schedule` triggers were removed; `workflow_dispatch` remains as a manual fallback. Supabase `pg_cron` is the sole automatic scheduler. |
| 24 Sep 2026 | FND-017 Next.js security maintenance upgrade | Upgraded Next.js and `eslint-config-next` to the 15.5.26 maintenance line, migrated `typedRoutes` to its stable top-level config, and pinned patched transitive PostCSS 8.5.28 plus Sharp 0.35.4. GitHub verification regenerated the npm lockfile, returned `npm audit` with zero vulnerabilities, and passed lint/build. |
| 24 Sep 2026 | FND-022 dashboard persistence ownership + Supabase timeouts | Removed Market Memory/EventResult writes from `getDashboardData()` so page renders cannot duplicate the Supabase cron ingestion clock. Added 10-second abort bounds to direct Market Memory/EventResult Supabase reads/writes and the HistoricalObservation read used by repository-backed dashboard factual baselines. Independent cron workers remain the only durable ingestion owners. |
| 24 Sep 2026 | CAP-001A Event-history PostgREST filter correction | Production natural PRE capture exposed a repository bug: CAP candidate selection returned zero HIGH Events while a valid qualified Jobless Claims Event existed in durable Market Memory. Corrected HistoricalEvent JSON equality filters to raw PostgREST `eq` values, added a 10-second Supabase read bound, and retained 90-minute deterministic reconstruction for missed slots. |
| 20 Sep 2026 | FND-002 repository-backed factual baseline | Replaced active current-provider-window baseline ownership with application-layer `HistoricalObservationRepository` queries, strict point-in-time predecessor bounds, deterministic revision selection, and explicit no-fallback outage behavior. Production `/dashboard` E2E subsequently passed with 29 service-role history reads. |
| 20 Sep 2026 | FND-018A Observation identity/revision lineage | Added versioned SHA-256 measurement/revision identity for FRED/CoinGecko/Yahoo Observations, normalized factual values and Observation dedupe timestamps, preserved legacy history without rewrite, and retained point-in-time availability semantics. Post-merge production activation verified v1 writes, legacy coexistence, zero duplicate v1 revision groups, dashboard HTTP 200, and 29 history reads. |
| 20 Sep 2026 | FND-010A structured Observation provenance | Added optional typed provider resource/native identity/date provenance for future FRED/CoinGecko/Yahoo Observations, strict current-write invariants, credential-free resource validation, and an explicit P365 retrieval-vs-source-release-vs-storage-time boundary. Production activation wrote 10 structured-provenance identity-v1 rows without duplicates/runtime errors; FRED may remain deduped when factual revisions are unchanged. |
| 21 Sep 2026 | FND-011A FRED/Macro cadence-aware freshness | Replaced wall-clock, period-start age checks in FRED normalization with acquisition-time cadence policy: MONTHLY/QUARTERLY use period end plus series-qualified registry tolerance (45 days for standard monthly families; 65 days for M2/PCE/JOLTS), DAILY/WEEKLY preserve existing anchors, invalid/future contexts are not fresh, and no release timestamp is fabricated. Historical predecessor interpretation is handled separately by FND-002Q; FND-011B market-hours semantics remains open. |
| 21 Sep 2026 | FND-002Q Historical Factual Baseline Quality Compatibility | Separated current-observation freshness from historical-predecessor fitness. Stored STALE predecessors remain immutable and traceable but may support a VALID factual comparison when current is FRESH; UNKNOWN/PARTIAL remain insufficient and point-in-time repository bounds remain unchanged. |
| 23 Sep 2026 | FND-011B market-hours freshness | Added acquisition-time session/provider-window-aware freshness for Yahoo GC/DXY/Russell and explicit continuous 24/7 freshness for CoinGecko. Closed-window wall-clock time no longer makes the latest legitimate Yahoo quote stale; exact holiday/early-close calendars remain intentionally unclaimed. |
| 24 Sep 2026 | FND-011B final audit correction | Removed an unsupported implication that Russell's 16:31 boundary is an official LSEG publication schedule, aligned elapsed-time chunks to exact minute boundaries, failed safe when a sessioned observedAt falls outside its qualified window, protected persisted freshness-calendar audit metadata from loose metadata override, and synchronized FND-002Q/FND-010A/FND-011A SSOT status with merged production reality. |
| 24 Sep 2026 | FND-009 manual cache invalidation | Centralized the complete dashboard invalidation tag set and made the manual-refresh Server Action invalidate legacy plus fast/medium/slow cadence groups. Production E2E passed after owner merge: authenticated manual refresh returned 200, produced no runtime errors, and forced new CoinGecko/Yahoo/FRED retrievals before their ordinary TTLs expired. |
| 24 Sep 2026 | FND-011B production activation | Scheduled historical ingestion remained HTTP 200 and durable Yahoo Gold inside the qualified open session persisted `CME_GLOBEX_GOLD` with `quality=FRESH`; FND-011B is CLOSED / PRODUCTION ACTIVE. |
| 24 Sep 2026 | Foundation Exit Gate | PASS for the generic hardening phase. Canonical identity, provenance, freshness, append-only history, repository-backed factual baseline, independent ingestion, and truthful manual invalidation are sufficient to stop broad foundation remediation. Remaining FND-008/FND-010 remainder/FND-012/FND-013/FND-015/FND-016/FND-017 are bounded debt unless a concrete downstream checkpoint depends on them. FND-019 is promoted as the first bounded prerequisite for the Expectation Baseline lifecycle because duplicate provider-specific Events must not create duplicate expectation ownership. FND-021 coverage gaps are completed demand-first inside the Macro + Crypto + Gold vertical slice rather than by breadth-first provider expansion. |
| 24 Sep 2026 | FND-019 Event identity/reconciliation | Added backward-compatible Event identity v1 without rewriting provider-specific canonical IDs. Qualified exact events reconcile by jurisdiction, schedule instant and semantic key; Biquote EventResult snapshots carry the same provider-independent identity key for future Expectation Baseline ownership. Dashboard reconciliation prefers Biquote deterministically when duplicate Events share identity, preserves all provider Evidence, and fails safe by leaving OTHER/non-exact/unmatched events distinct. |
| 24 Sep 2026 | EXP-001 Point-in-Time Expectation Baseline | Added provider-scoped EventResult history by provider-independent `eventIdentityKey`, canonical `retrievedAt` availability bounds, and deterministic latest pre-release expectation selection. `FORECAST`, `CONSENSUS`, and `OFFICIAL_PROJECTION` remain distinct; missing unit/period is PARTIAL; post-release snapshots are ineligible. No surprise, pricing, snapshot, transmission, or reasoning output is introduced. |
| 24 Sep 2026 | PRC-001 Point-in-Time Canonical Pricing Baseline | Added repository-backed selection for existing canonical `PRICING` Observations with explicit series/provider ownership, `observedAt` + `retrievedAt` as-of protection, caller-owned age tolerance, preserved quality/unit/semantic provenance, and no hidden fallback. This establishes a pricing-reference contract for qualified rates/FX/Gold/Crypto/etc. observations without claiming missing OIS/policy-futures probabilities or implementing repricing/transmission. |
| 24 Sep 2026 | SNP-001 Immutable Market Snapshot | Added deterministic reference-only Market Snapshot v1 with explicit scope requirements, point-in-time no-lookahead checks, provider-duplicate Event rejection, baseline lineage validation, explicit COMPLETE/PARTIAL/STALE/UNKNOWN quality, append-only `SNAPSHOT` persistence using existing Market Memory schema, native lineage columns, and historical scope/time retrieval. Snapshot values remain authoritative in canonical facts/baselines; automatic capture triggers, comparison, repricing, transmission, State and Intelligence remain out of scope. |
| 24 Sep 2026 | EVW-001 Qualified Event Window & Snapshot Capture Policy | Added provider-independent qualification for HIGH exact point-events using Event identity, with qualified release time overriding schedule when available; excluded unqualified/date-anchor/duration-like events; defined PRE/T+5/T+15/T+30/T+60 targets with ±2.5 minute capture tolerance; required matching Snapshot scope and primary Event reference; preserved degraded Snapshot quality rather than fabricating validity; and added contamination detection for distinct qualified HIGH events between baseline and evaluated captures. FND-019 reconciliation is reused before plan creation. No automatic scheduler, Snapshot comparison, repricing or transmission logic is activated. |
| 24 Sep 2026 | CMP-001 Point-in-Time Snapshot Comparison | Added deterministic reference-safe comparison for compatible immutable Snapshots. Canonical Observation values are resolved by ID, revalidated against frozen Snapshot source/evidence/quality/semantic slots and capture cutoffs, and compared only when unit/frequency compatibility is sufficient. Output preserves raw before/after values, absolute/percent deltas, added/removed/incompatible/unknown slots, structural Event/Baseline lineage changes, missing canonical resolutions, Snapshot quality, event-window role/timing, and contamination status. No repricing threshold, causal attribution, transmission conclusion, State, Regime, Risk or Intelligence is introduced. |
| 24 Sep 2026 | CAP-001 Event-Window Runtime Snapshot Capture | Added a durable HistoricalEventRepository plus an authenticated `/api/cron/snapshot-capture` runtime owner. The runner selects the latest Event revision per provider before FND-019 reconciliation, reconstructs due EVW-001 PRE/T+5/T+15/T+30/T+60 slots at deterministic target timestamps, constrains every Observation/EventResult to availability at or before each target, materializes fixed BTC/ETH/DXY/Gold pricing slots plus expectation lineage, preserves missing/stale/unknown quality, and detects already-materialized slots idempotently. During CAP-001 audit, legacy pg_cron job `capture-snapshot-schedule` was proven orphaned: it called Supabase Edge Function `bright-responder`, which writes to removed table `public.market_snapshots`, had no P365 repo consumer, and returned repeated HTTP 500 responses. The orphaned cron job was unscheduled successfully on 24 Sep 2026. The Edge Function remains deployed but inert because the available Supabase connector exposes no delete-function operation; it must not be reused for CAP-001. Production activation must use a distinct authenticated P365 snapshot-capture scheduler. No repricing/transmission logic is activated. |

## Foundation Exit Gate — 24 Sep 2026

**Verdict: PASS for foundation hardening.**

This gate does **not** mean P365 is feature-complete and does not authorize State/Regime/Risk/Intelligence. It means the platform has enough verified factual infrastructure to stop open-ended hardening and move into the next product dependency chain.

| Exit criterion | Result | Evidence / boundary |
|---|---|---|
| Canonical factual contracts are stable enough for downstream references | PASS | Observation/Event/Evidence/Context contracts are active; additive semantics preserve legacy history compatibility. |
| Durable point-in-time history exists | PASS | Append-only Market Memory and `HistoricalObservationRepository` are production-verified. |
| Factual predecessor baseline is repository-backed | PASS | FND-002 + FND-002Q are closed and production E2E verified. |
| Future Observation identity/revision semantics are deterministic | PASS | FND-018A is closed / production-active. |
| Current Observation provenance is traceable | PASS at current Observation boundary | FND-010A is production-active; Event/Evidence provenance remains bounded debt until a downstream consumer requires it. |
| Freshness semantics are fit for current Macro/Crypto/Gold facts | PASS at qualified boundary | FND-011A and FND-011B are production-active; no fabricated holiday/early-close or release timestamps are introduced. |
| Independent acquisition does not depend on dashboard traffic | PASS | Supabase `pg_cron` drives authenticated Vercel Observation/Event ingestion. |
| Explicit manual refresh is truthful | PASS | FND-009 production E2E proves cadence-tagged providers are fetched again inside their ordinary TTLs. |
| Higher-order reasoning remains gated | PASS | State/Regime/Risk/Intelligence are still deferred. |

### Debt classification after exit

**Blocking the immediate next lifecycle**

- **FND-019 Event identity/reconciliation** — resolve before expectation ownership is treated as provider-independent. The same real release can currently exist as separate Forex Factory and Biquote Events.

**Allowed to remain bounded while product-layer work proceeds**

- **FND-008** broader release-time qualification: only exact-qualified event times may participate in exact-timing surprise/repricing workflows until expanded.
- **FND-010 remainder** Event/Evidence structured provenance: add when the consuming lifecycle needs stronger traceability.
- **FND-012** Yahoo input type naming/shape debt.
- **FND-013** MOVE coverage gap.
- **FND-015** broader test governance.
- **FND-016** presentation-language/status debt.
- **FND-017** dependency security remediation is addressed by PR #65; owner merge/production deployment remain the only pending gates.

**Demand-driven MVP completion**

- **FND-021** is not a mandate to maximize provider breadth before building the intelligence chain. Add Macro/Crypto/Gold observations only when a defined Expectation, Pricing, Snapshot, Repricing, or Transmission question requires them and source qualification is adequate.

### Post-exit rule

Do not reopen generic foundation work merely because a theoretical improvement exists. A new foundation correction after this gate requires one of:

1. a reproduced correctness defect in production;
2. a security/reliability defect;
3. a concrete downstream contract that cannot be implemented safely without it.

Otherwise continue the product dependency chain:

```text
FND-019 Event reconciliation
  ↓
Expectation Baseline
  ↓
Pricing Baseline
  ↓
Market Snapshot
  ↓
Repricing / Transmission
  ↓
Demand-driven Macro + Crypto + Gold evidence completion
  ↓
Derived State / Risk / Regime
  ↓
Intelligence / Briefing
```

## Active remediation sequence

```text
1. Documentation consolidation / SSOT                     ← PR #36
2. FND-004 Context taxonomy repair                        ← corrected
3. FND-001 Historical Observation repository contract     ← PR #37
4. Durable history query adapter                          ← PR #39; production E2E verified
5. Financial Market Ontology & Data Foundation v0.1       ← PR #42 merged
6. Additive semantic-dimensions compatibility contract    ← merged before PR #45
7. FND-003A selective fresh Observation worker             ← PR #45 merged
8. FND-003B independent US/China/Japan Event ingestion     ← PR #46 merged
9. FND-003C external cadence + production verification     ← operational via Supabase pg_cron
10. FND-002 Repository-backed Factual Baseline             ← FULL PASS / CLOSED
11. FND-018A Observation identity/revision lineage         ← FULL PASS / CLOSED / production active
12. FND-010A Structured Observation provenance             ← production active
13. FND-011A FRED/Macro cadence-aware freshness             ← production active
14. FND-002Q Historical Baseline Quality Compatibility      ← FULL PASS / CLOSED / production E2E verified
15. FND-011B market-hours freshness                         ← CLOSED / PRODUCTION ACTIVE
16. FND-009 Manual cache invalidation                       ← CLOSED / PRODUCTION ACTIVE
17. Foundation Exit Gate                                   ← PASS; stop open-ended hardening
18. FND-019 Event identity/reconciliation                   ← merged; production activation watch pending
19. EXP-001 Point-in-Time Expectation Baseline               ← merged / production deployed; E2E data proof pending
20. PRC-001 Point-in-Time Canonical Pricing Baseline           ← merged / production deployed; contract + durable input verified
21. SNP-001 Immutable Market Snapshot                            ← merged / production deployed; runtime capture pending
22. EVW-001 Qualified Event Window & Snapshot Capture Policy      ← merged / production deployed; runtime capture pending
22A. CMP-001 Point-in-Time Snapshot Comparison                     ← merged / production deployed; runtime E2E pending
22A.1 CAP-001 Event-Window Runtime Snapshot Capture                 ← implementation PASS; owner merge + scheduler activation pending
22B. Repricing / cross-asset transmission                           ← blocked on CAP-001 production Snapshot evidence
23. MVP Macro + Crypto + Gold evidence completion           ← demand-driven by the vertical slice, not breadth-first expansion
24. Secondary positioning / flows enrichment inside Macro + Crypto + Gold
25. Derived State → Risk/Regime → Intelligence → Briefing only after gates pass
```

One logical remediation = one PR = one verification checkpoint. This sequence may only change when a verified dependency requires it; changes must be recorded here.

## 22. Final audit conclusion

P365 should **not** restart its architecture and should **not** add a reasoning engine yet.

The correct strategy is to preserve the pipeline already present while broadening its semantics deliberately:

> **freeze the broad ontology for future compatibility, keep MVP delivery constrained to Macro + Crypto + Gold, add semantic dimensions without rewriting history, then complete those three scopes before broader first-class market expansion.**

Once those gates pass, the existing factual data becomes a defensible base for the retail trader/investor decision-support workflow defined by P365.
