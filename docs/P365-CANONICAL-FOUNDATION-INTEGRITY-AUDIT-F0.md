# P365 Foundation Master — SSOT v0.1

**Status:** **ACTIVE MASTER SSOT — current state, audit findings, remediation roadmap, and foundation gates**  
**Audited ref:** `main@c7226fcf215a1d27ab2837835361a763a1501ec6` after EVR-001 merge
**Audit boundary:** Product contract → source qualification → provider → ingestion → normalization → canonical domain → temporal/provenance → quality/health → context → persistence/history → baseline → snapshot readiness → cross-asset readiness → expectation/repricing readiness → presentation/UI → deferred reasoning boundaries.

**Verification pass:** Repository state re-verified 28 Sep 2026 from `main@9613893e697552cdcaa7015a551ed0867e1f1ef1`. Production scheduling is owned exclusively by Supabase `pg_cron`; recurring GitHub Actions ingestion schedules are retired. FND-002, FND-002Q, FND-009, FND-011B, FND-017, FND-018A, FND-019, FND-022 and CAP-001A/B/C are closed / production-active at their approved boundaries. CAP-001D is merged and production-ready as a manual authenticated targeted historical Snapshot repair path. The natural **Durable Goods Orders** event on 25 Sep 2026 produced COMPLETE PRE/T+5/T+15/T+30/T+60 Snapshots with four Observation refs, VALID Biquote FORECAST Expectation lineage, VALID BTC/ETH/DXY/Gold Pricing baselines, and no missing requirements. This closes the CAP natural-production evidence gate. RPR-001 is merged and production-ready at PR #74 / `bb36fa81be57b8a11603c28e739e5bd2745c7d7a`. TRN-001 is merged at PR #75 / `7a8a3bc60467b1a59a15a48496115adc806b5a51` as a read-only explicit-methodology cross-asset response-coherence contract. SUR-001 is merged at PR #76 / `9613893e697552cdcaa7015a551ed0867e1f1ef1` and adds point-in-time factual actual-vs-expectation measurement without materiality, causality, State/Regime/Intelligence, or trading semantics. EVR-001 is merged at PR #77 / `c7226fcf215a1d27ab2837835361a763a1501ec6` and binds SUR-001, RPR-001 and TRN-001 into one read-only event-response evidence chain at a shared post-event knowledge cutoff. REL-001 is merged at PR #78 / `92d9a9d010e6d6b0b7a880a3822be5ef3ae83199` as read-only, point-in-time historical relationship evidence. HIST-001A is merged and freezes the historical-distribution methodology. HIST-001B is merged at PR #131 as the read-only repository-backed historical-distribution runtime. HIST-001C is merged at PR #132 and binds qualified PRE→post event-window moves to same-series HIST-001B distributions. HIST-001D is merged at PR #133 and freezes the first intraday magnitude calibration for BTC, DXY and Gold. HIST-001E is the terminal HIST checkpoint for the current MVP sequence: it binds calibrated historical context to EVR-001 under one shared Event/window/CMP/knowledge lineage without State/Regime/Risk/Intelligence or trading semantics.

## Documentation authority

This is the **single operational SSOT for foundation development**. It owns:

- current implementation state;
- verified foundation findings (`FND-001`…`FND-021`);
- current factual coverage/gaps;
- remediation priority and sequencing;
- foundation completion gates;
- checkpoint history.

Normative contracts remain separate only where they define stable rules rather than project status: `P365-ARCHITECTURE.md`, `P365-USER-DECISION-SUPPORT-CONTRACT.md`, `P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md`, `P365-CANONICAL-SEMANTIC-DIMENSIONS-COMPATIBILITY-v0.1.md`, `P365-MVP-BTC-XAU-EVIDENCE-MAP-v0.1.md`, `P365-DATA-REQUIREMENTS-MATRIX-v0.1.md`, `P365-MARKET-SNAPSHOT-CONTRACT-v0.1.md`, `P365-EVENT-REPRICING-CONTRACT-v0.1.md`, `P365-CROSS-ASSET-TRANSMISSION-CONTRACT-v0.1.md`, `P365-HISTORICAL-BASELINE-CONTRACT-v0.1.md`, `P365-CONTINUOUS-MARKET-MOVE-DETECTION-CONTRACT-v0.1.md`, `P365-MOVE-EVIDENCE-INVESTIGATION-CONTRACT-v0.1.md`, `P365-BTC-DERIVATIVES-PROVIDER-QUALIFICATION-v0.1.md`, `P365-BTC-SPOT-FLOW-SOURCE-QUALIFICATION-v0.1.md`, `P365-BTC-ORDER-BOOK-LIQUIDITY-SOURCE-QUALIFICATION-v0.1.md`, `P365-BTC-PERP-ORDER-BOOK-LIQUIDITY-SOURCE-QUALIFICATION-v0.1.md`, `P365-UNSCHEDULED-NEWS-CATALYST-SOURCE-QUALIFICATION-v0.1.md`, `P365-ASIA-FX-TRANSMISSION-EVIDENCE-CONTRACT-v0.1.md`, `P365-INTRADAY-US-RATES-SOURCE-QUALIFICATION-v0.1.md`, `P365-TWELVE-DATA-US-RATES-QUALIFICATION-v0.1.md`, `P365-MASSIVE-US-RATES-PROXY-QUALIFICATION-v0.1.md`, `P365-EVIDENCE-COVERAGE-MATRIX-v0.1.md`, and Market Memory governance/implementation contracts. `AGENTS.md` remains repository governance.

Older status, roadmap, gap-analysis, and audit documents are removed rather than kept as competing sources of current truth. Historical decisions are summarized in the checkpoint history at the end of this document.

## 1. Executive verdict

**FOUNDATION HARDENING EXIT: PASS — PRODUCT INTELLIGENCE CHAIN STILL INCOMPLETE**

P365 has a credible canonical-data architecture and the active code generally respects the decision-support boundary. Durable historical continuity is operational. The generic foundation-hardening phase is complete enough to exit: Expectation Baseline, Pricing Baseline, immutable Market Snapshot, governed capture, comparison, and RPR-001 repricing are now implemented at their approved boundaries; TRN-001 cross-asset response coherence is merged; SUR-001 factual event surprise is merged; the remaining product-layer work centers on EVR-001 integrated event-response evidence, demand-driven relationship evidence, and later Intelligence rather than open-ended foundation hardening. The coarse legacy `MARKET / MACRO / ASSET / OTHER` classification is now preserved only as a compatibility field while approved current Observations receive additive market-domain/information-class semantics. The **MVP implementation boundary remains Macro + Crypto + Gold**; the broader ontology exists to avoid future semantic dead ends, not to expand MVP indiscriminately.

The current system independently ingests and normalizes selected factual Observations and Events, persists canonical records to durable Market Memory, queries point-in-time Observation/Event/EventResult/Snapshot history, and computes factual, expectation, and pricing baselines at approved boundaries. SNP-001, EVW-001, CMP-001 and CAP-001 are merged and production-active. Natural Durable Goods Orders production evidence on 25 Sep 2026 proves the complete governed capture chain: PRE/T+5/T+15/T+30/T+60 were materialized as COMPLETE immutable Snapshots with four BTC/ETH/DXY/Gold Observation refs, VALID pre-release Biquote FORECAST expectation lineage, VALID Pricing baselines, and zero missing requirements. CAP-001A/B corrected history-filter defects discovered by Initial Jobless Claims; CAP-001C adds append-only Snapshot supersession; CAP-001D adds explicit authenticated repair for historical slots that have aged out of the recurring 90-minute discovery window. RPR-001 is merged and production-ready as threshold-governed market-response classification without production threshold defaults or causal attribution. TRN-001 is merged at PR #75 and adds explicit-methodology cross-asset response-coherence testing while preserving `causalAttribution=NOT_EVALUATED`. SUR-001 is merged at PR #76 / `9613893e697552cdcaa7015a551ed0867e1f1ef1` and closes the factual actual-vs-pre-release-expectation gap with explicit point-in-time availability. EVR-001 and REL-001 are merged. HIST-001A now defines the next bounded evidence gap: point-in-time historical distribution context for determining where a current level or change sits relative to its own prior history, without causal or directional interpretation.

### Product-direction finding — 2 Oct 2026: event-centric trigger gap

**Finding:** the current product composition is too dependent on scheduled Event identity as the trigger for higher-value intraday analysis. The Event pipeline remains valid, but it is insufficient as the sole analysis entry point for the P365 intraday objective.

A reproduced production case on 2 Oct 2026 exposed the gap:

- durable Market Memory already contained roughly five-minute BTC spot observations throughout the move;
- BTC was `85,239` at `2026-10-02T03:30:30Z` (`10:30:30 WIB`) and `86,752` at `2026-10-02T04:30:30Z` (`11:30:30 WIB`);
- that is a factual change of approximately `+1.775%` over 60 minutes;
- versus `84,912` at `2026-10-02T02:30:20Z` (`09:30:20 WIB`), the same `86,752` observation was approximately `+2.167%` over about 120 minutes;
- the canonical data therefore observed the move, but no continuous market-move detector promoted it into an analysis target;
- because the active Briefing / confirmation chain is predominantly Event -> Surprise -> Repricing -> Confirmation, a meaningful move without a qualifying scheduled-event trigger can pass through Market Memory without being investigated as a first-class market development.

This is a **product-layer trigger gap**, not evidence that canonical ingestion failed.

Effective product correction:

```text
MARKET DATA
   |
   +--> scheduled Event trigger --------+
   |                                    |
   +--> material market Move trigger ---+
                                        v
                              evidence investigation
                                        |
                         support / contradiction / unknown
```

The system must become market-first rather than calendar-first: a material BTC or Gold move must be able to initiate investigation even when no qualifying scheduled Event exists. Event evidence remains one possible explanatory evidence class, not a mandatory parent identity for every market analysis.

**Sequencing correction:** pause additional event-centric enrichment as the default next step. `MOVE-001A` is merged in PR #151 and freezes the continuous market-move detection contract. `MOVE-001B` is merged in PR #153 and freezes the first production-supported continuous horizons, pairing tolerance, rolling historical sample requirement, and P97.5 materiality policy. `MOVE-001C` is merged in PR #154 and implements the repository-backed read-only detector runtime. `MOVE-002A` is merged in PR #155 and freezes move-centered evidence roles. `CRYPTO-STRUCT-001A` now compares cross-exchange and venue-native derivatives providers before any runtime selection. CryptoQuant is the preferred cross-exchange candidate; Coinalyze is the free validation/fallback candidate; CoinGlass is the richest feature benchmark but has cost and durable-storage terms constraints; Binance remains venue-native fallback rather than market-wide default. This correction does not activate State / Regime / Risk / Intelligence and does not authorize causal claims or trading signals.

CRYPTO-STRUCT-001B now adds a read-only, CRON_SECRET-protected qualification diagnostic that exercises the merged Coinalyze adapter against a bounded deterministic BTC-perpetual sample, reports universe/quota/timestamp evidence, and performs sample OI/funding aggregation without any durable write. Live execution remains blocked until `COINALYZE_API_KEY` is configured; timestamp bucket anchor, liquidation L/S canonical mapping and durable-use rights remain explicit unresolved gates.

Final Coinalyze live proof returned `READY_FOR_SEMANTIC_REVIEW`: 26 eligible BTC perpetual contracts across 16 exchange codes; four-family 5m demand 104 symbol-calls versus documented 200/5m theoretical capacity; OI 4/5 sampled, funding 5/5, liquidation sparse/empty, OHLCV 5/5. The runtime now accepts live `expire_at=null` only for perpetuals, treats omitted history as explicit partial coverage, freezes provider `t` as interval start and `l/s` as long/short liquidation from official OpenAPI, excludes currently forming 5m buckets from canonical eligibility, labels funding in percent units, and honors one bounded 429 Retry-After retry. No durable write occurred. `DURABLE_PRIVATE_STORAGE_USE` remains the only source-governance blocker before CRYPTO-STRUCT-001C.

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
| Expectation baseline | **EXP-001 FULL PASS / PRODUCTION E2E VERIFIED** | Durable Goods Orders on 25 Sep 2026 produced a provider-independent Event identity with Biquote `FORECAST` EventResult lineage selected as `VALID` in every PRE/T+ slot. `FORECAST`, `CONSENSUS`, and `OFFICIAL_PROJECTION` remain distinct and post-release lookahead remains prohibited. |
| Event surprise | **SUR-001 MERGED / PR #76 / `9613893e697552cdcaa7015a551ed0867e1f1ef1`** | Reuses EXP-001 strict pre-release expectation ownership and durable EventResult history. Actual selection is constrained to the same Event identity/source and `releaseAt <= retrievedAt <= asOf`; VALID output is raw actual-minus-expectation arithmetic only, with no materiality, causality, State/Regime/Intelligence, or trading semantics. |
| Pricing baseline | **PRC-001 FULL PASS AT CURRENT MVP CAPTURE BOUNDARY / PRODUCTION E2E VERIFIED** | CAP-001 actively consumes provider-scoped point-in-time Pricing baselines. Durable Goods Orders natural production evidence shows BTC, ETH, DXY and Gold Pricing baselines `VALID` across PRE/T+5/T+15/T+30/T+60 with `observedAt` + `retrievedAt` cutoffs preserved. OIS/Fed-funds/SOFR-futures policy-path pricing remains a separate coverage gap. |
| Historical baseline | **HIST-001A-D MERGED / HIST-001E EVENT-RESPONSE INTEGRATION IMPLEMENTED / OWNER MERGE PENDING** | Historical distribution runtime, event-window integration and calibrated v1 magnitude policy are merged. HIST-001E binds HIST-001C context to EVR-001 only when Event identity, Event Window, post role, CMP comparison ID and post-event knowledge cutoff match. The calibrated wrapper applies the frozen 36-hour / minimum-30 / `ABSOLUTE_PERCENT_CHANGE` BTC-DXY-Gold policy. No dashboard query, percentile label, causality, abnormality conclusion or higher-order interpretation is introduced. |
| Continuous market move detection | **MOVE-001A MERGED / PR #151 — MOVE-001B MERGED / PR #153 — MOVE-001C MERGED / PR #154** | BTC/Gold have an approved move-driven entry path plus the frozen 15/30/60/120-minute, ±60s, 36h / minimum-120 / rolling P97.5 runtime. The read-only detector preserves point-in-time revision filtering, deterministic pairing, runtime percentile_cont-compatible thresholds, explicit fail-closed states, and exact lineage. No scheduler, persistence, UI, causality, State/Regime/Risk/Intelligence or trading semantics are activated. |
| Move-centered evidence investigation | **MOVE-002A/B MERGED BOUNDARY / MOVE-002C SPOT-FLOW + MOVE-002D GDELT REPLAY IMPLEMENTED** | The deterministic MATERIAL_MOVE bundle consumes durable Binance BTCUSDT 5m spot-flow and durable GDELT BTC/Gold rolling-15m NEWS Evidence through `HistoricalEvidenceRepository` under the same MOVE `asOf`. GDELT coverage is calculated from source-native feed windows; zero-candidate snapshots remain valid absence evidence and provider-dated candidates are bounded to the MOVE window. Coinalyze derivatives remain `INSUFFICIENT_DATA`; ORDER-BOOK-001C now provides compact durable spot/perp book-history runtime but production sampling and MOVE replay are still inactive, so historical order-book evidence remains incomplete. Intraday rates remain `MISSING_HIGH_VALUE_EVIDENCE` under FREE_ONLY. `evidenceCompleteness=EVIDENCE_INCOMPLETE` and `causalAttribution=NOT_EVALUATED` remain unchanged. |
| MVP evidence coverage matrix | **PROPOSED / PR #156** | Free-first mixed-provider priorities are now explicit. P0 new gaps: BTC derivatives, spot-flow, order-book liquidity, unscheduled news/catalysts, and intraday rates/policy pricing. P1: basis/options, on-chain exchange/large-holder flows, stablecoin/DeFi liquidity expansion and Gold ETF flows. P2: mempool/network context and broad sentiment/attention. Existing BTC/ETH/Gold/DXY, scheduled events, ETF flow, stablecoin supply and Gold CFTC remain active. Derivatives providers do not become the overall P365 data architecture. |
| BTC spot trade flow | **SPOT-FLOW-001A/B/C PRODUCTION ACTIVE + MOVE-002C REPLAY IMPLEMENTED / BYBIT VERCEL-EGRESS UNAVAILABLE** | Binance Spot `BTCUSDT` completed 5m taker-flow windows persist through the existing `p365-market-fast` five-minute Supabase job (job id 2), with no duplicate scheduler. First natural run 34105 / HTTP request 34087 returned 200/SUCCESS and persisted exactly two completed windows; repeat request 34088 returned 200/SUCCESS while Market Memory remained 2 rows / 2 window keys / 2 Evidence IDs, proving idempotency. Retrieval cutoff proof returned 0 rows before `2026-10-04T12:27:02.170Z` and 2 at that timestamp. MOVE-002C now consumes this durable history under the MOVE `asOf`. Binance BACKFILL, market-wide aggregation, UI, causality and trading semantics remain inactive. Bybit remains unavailable from current Vercel egress. |
| BTC order-book liquidity | **ORDER-BOOK-001A LIVE / ORDER-BOOK-001C DURABLE SUMMARY RUNTIME IMPLEMENTED / ACTIVATION PENDING** | Reuses owner-approved Binance Spot. Public `/api/v3/depth` still provides current limited BTCUSDT depth with no exchange timestamp, so P365 uses `retrievedAt` as the qualified sample time and retains `lastUpdateId` as sequence lineage. ORDER-BOOK-001C can persist only the compact 5/10/25/50 bps geometry summary through authenticated FORWARD ingestion; raw 500-level books are not stored. No Supabase cron, BACKFILL, MOVE replay or causal attribution is activated. |
| BTC perpetual order-book liquidity | **ORDER-BOOK-001B HYPERLIQUID LIVE / ORDER-BOOK-001C DURABLE SUMMARY RUNTIME IMPLEMENTED / ACTIVATION PENDING / BINANCE FUTURES VERCEL-EGRESS UNAVAILABLE** | Hyperliquid public `l2Book` provides provider-native book time and top-20 BTC depth geometry. ORDER-BOOK-001C can persist the compact derived 5/10/25/50 bps geometry summary under provider-time effective semantics; raw levels are not stored. Binance USDⓈ-M remains unavailable from current Vercel egress (HTTP 451) and is not bypassed. No Supabase cron, BACKFILL, MOVE replay, cross-venue additive liquidity or causality is activated. |
| Unscheduled news / catalyst | **NEWS-001B/C/D PRODUCTION ACTIVE + MOVE-002D REPLAY IMPLEMENTED** | GDELT GAL remains the free-first source. NEWS-001C adds deterministic BTC+Gold NEWS Evidence snapshots with zero-candidate preservation; NEWS-001D activates forward acquisition on the existing `p365-market-fast` job. Idempotency and point-in-time readback are production-proven. MOVE-002D now consumes this durable history under the MOVE `asOf`. Pre-activation backfill, article-body/tone analysis, source ranking, UI and causal attribution remain inactive. |
| Asia FX transmission | **ASIA-MACRO-001A/001B PRODUCTION ACTIVE / DURABLE FORWARD / WEEKEND TEMPORAL FITNESS FAIL-CLOSED** | Provider-specific USDJPY and offshore USDCNH synchronous pricing now run through the existing Yahoo trial path with explicit FX/PRICING semantics, JAPAN/CHINA jurisdiction, provider quote timestamps and the regular 24/5 FX freshness window. The existing Supabase `p365-market-fast` five-minute job is the sole recurring owner and now includes `usdjpy,usdcnh`; durable FORWARD acquisition is proven. Existing US/CHINA/JAPAN scheduled Event ingestion is reused rather than duplicated. No Yahoo FX backfill, MOVE/UI wiring, causality or trading semantics are activated. |
| Intraday US rates transmission | **MACRO-RATES-001A/001B FREE-ONLY / PAID PATHS REJECTED / ZT+TN PROXY RISK-QUALIFIED ONLY / NO RUNTIME / REAL-YIELD INTRADAY UNRESOLVED** | Daily Treasury/FRED DGS2/DGS10/DFII10 remain authoritative background but cannot answer synchronous MOVE windows. Owner explicitly prohibited paid rates data for the current MVP, so Massive Business/CME Non-Display, Twelve Data paid fixed income and BrokerTec paid cash paths are not implementation options. Earlier Massive research proved ZT and ZN liquidity, but proxy-risk review found ZN's deliverable basket materially inside the 10Y point; CME TN Ultra 10-Year is closer to 10Y and bounded TNZ6 proof still returned 525 5m bars / 2,029,436 volume / 167,668 transactions. If a future free and legally compatible source qualifies, ZT+TN is the preferred proxy family. It remains FUTURE price evidence only: CTD/basis/repo, DV01 mismatch, roll, closed-market and stress-dislocation risks prohibit cash-yield/bp/curve substitution. Existing point-in-time roll/completed-bar rules remain frozen; no paid provider, rates runtime or scheduler is activated. |
| BTC crypto market structure | **CRYPTO-STRUCT-001A MERGED / PR #156 — CRYPTO-STRUCT-001B ACTIVE** | Deeper audit keeps CryptoQuant as the preferred market-wide candidate: official BTC Market Data supports `all_exchange` OI, funding, taker and liquidation plus minute/hour/day windows, with USD normalization for OI and taker volumes. Current pricing assigns minute market data to Professional, but endpoint/discovery docs still say API tokens require Professional/Premium, so entitlement must be proven live before runtime. CryptoQuant Terms permit internal non-commercial API use while retail Professional is personal-use/retail-only; future corporate/commercial use requires requalification. Coinalyze remains free validation/fallback with 1m/5m data and short 1500–2000-point intraday retention; CoinGlass remains feature-rich but durable Market Memory is blocked without written storage consent; Binance remains venue-native fallback. A bounded Coinalyze provider adapter and pure aggregation scaffold are now implemented in PR #156: future-market discovery, 5m OI/funding/liquidation/OHLCV acquisition, strict schema/order checks, 20-symbol batching, existing ProviderResult error semantics, USD conversion for OI/liquidation, exact-bucket OI sum and OI-weighted funding, partial-coverage lineage, and unresolved provider L/S liquidation fields. Vercel exact-head build is READY/HTTP 200. Canonical observedAt mapping, liquidation-side semantics, Observation normalization, Market Memory persistence and scheduler activation remain blocked on a real free API key. No production provider runtime is authorized yet. |
| Cross-asset baseline | **CAPTURE CHAIN FULL PASS / CMP-001 CONSUMED BY RPR/TRN** | Immutable Snapshot persistence/query and qualified event windows are production-active. Durable Goods Orders naturally materialized COMPLETE PRE/T+5/T+15/T+30/T+60 BTC/ETH/DXY/Gold reference sets with expectation/pricing lineage. CMP-001 is deployed and is consumed by the merged RPR-001 → TRN-001 read-only chain. |
| Market Snapshot | **SNP-001 + CAP-001 FULL PASS / NATURAL PRODUCTION E2E VERIFIED** | Supabase `pg_cron` drives the authenticated CAP runtime owner. Durable Goods Orders produced all five governed event-window Snapshot roles as COMPLETE with valid point-in-time lineage and no missing requirements. Append-only correction/supersession and targeted historical repair are available through CAP-001C/D. |
| Cross-asset factual coverage | PARTIAL | Useful universe exists; MOVE remains absent and docs disagree on credit coverage. |
| Transmission reasoning | **TRN-001 MERGED / PR #75 / `7a8a3bc60467b1a59a15a48496115adc806b5a51`** | TRN-001 consumes RPR-001 and evaluates only explicit versioned driver→response relationship rules. Both sides must independently satisfy RPR thresholds; degraded/missing inputs fail closed, contamination is preserved, no static cross-asset rule is hardcoded, and causal attribution remains `NOT_EVALUATED`. |
| Integrated event response | **EVR-001 MERGED / PR #77 / `c7226fcf215a1d27ab2837835361a763a1501ec6`** | Read-only integration of SUR-001 + CMP/RPR/TRN at one Event identity, Event Window and post-event `knowledgeAt = after.capturedAt`. No aggregate market interpretation, threshold default, relationship assumption, persistence owner, State/Regime/Intelligence, UI, or trading logic. |
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
Expectation baseline         EXP-001 FULL PASS / NATURAL PRODUCTION E2E VERIFIED
Pricing baseline             PRC-001 PRODUCTION E2E VERIFIED FOR BTC/ETH/DXY/GOLD
Market Snapshot              SNP-001 + CAP-001 NATURAL PRODUCTION E2E VERIFIED
Event Window Policy           EVW-001 PRODUCTION E2E VERIFIED
Snapshot Comparison           CMP-001 DEPLOYED / CONSUMED BY RPR-001 → TRN-001
Runtime Snapshot Capture       CAP-001 A/B/C CLOSED / NATURAL E2E PASS / D REPAIR READY
Event Surprise             SUR-001 MERGED / PR #76
Event Response Evidence     EVR-001 MERGED / PR #77\nHistorical Relationship     REL-001 MERGED / PR #78\nHistorical Baseline         HIST-001A-D MERGED / HIST-001E EVENT-RESPONSE INTEGRATION IMPLEMENTED / OWNER MERGE PENDING
Repricing / Transmission    RPR-001 + TRN-001 MERGED
Financial-market ontology    DOCUMENTED / ADDITIVE RUNTIME COMPATIBILITY IMPLEMENTED
MVP Macro+Crypto+Gold       PARTIAL / ACTIVE TARGET
BTC ETF flow runtime        IMPLEMENTED / LIVE ENTITLEMENT + ACTIVATION PENDING
Broader multi-asset coverage  POST-MVP / ONTOLOGY-DEFINED
State / Regime / Risk        DEFERRED
Intelligence / Briefing      DEFERRED
```

### Current factual coverage

- **Macro:** FRED covers the approved monetary-policy, liquidity, inflation, labor, rates, broad-USD and growth foundation.
- **Crypto:** CoinGecko covers BTC/ETH spot, BTC/ETH market cap, total crypto market cap, total volume and BTC/ETH dominance. USD stablecoin market cap has a frozen evidence contract and a production-active bounded DefiLlama factual runtime for durable ingestion plus point-in-time latest/1D/1W/4W reads. Production verification established 35 durable rows across 35 distinct effective dates and unchanged-fact FORWARD idempotency. Its source verdict remains **QUALIFIED_CANDIDATE — INTERNAL/NON-COMMERCIAL MVP**. US spot BTC ETF daily net flow now has a bounded SoSoValue factual runtime under `SOSOVALUE_ETF_FLOW_MATURITY_V0_1`, exact `MARKET / CRYPTO / FLOW / US / ETF / BTC` semantics, FND-018A revisions, and a repository-only five-session point-in-time read model. Live entitlement and production activation remain pending. A defined basic-volatility metric remains open.
- **Cross-asset:** S&P 500, Nasdaq, Russell 2000, US 2Y, US 10Y, 10Y real yield, DXY, broad USD, Gold futures, WTI, VIX and IG/HY credit spreads are available. DXY and broad USD remain separate instruments. MOVE remains open.
- **Economic events:** Forex Factory provides a weekly scheduled calendar, Federal Reserve provides official FOMC date anchors, and Biquote trial data provides structured schedules/results for verified US, China and Japan examples. Biquote remains trial-only; response-window completeness and release-time qualification remain open.
- **Event risk window (presentation only):** the overview lists HIGH-importance canonical Events from 30 minutes ago to 24 hours ahead, grouped by scheduled minute, as schedule facts only (no direction, no advice). Federal Reserve dates are date anchors and are shown without a countdown. The Forex Factory list is capped at the nearest `ECONOMIC_CALENDAR_LIMIT` events of any impact, so the panel states when events beyond its last loaded event are unknown; absence in the panel is not evidence of absence. Qualified cross-provider Events carry FND-019 identity/reconciliation in production. Durable Goods Orders on 25 Sep 2026 verified the same provider-independent identity across Biquote/Forex Factory schedule rows, with Biquote EventResult lineage consumed by CAP.
- **Semantic breadth:** the FRED registry contains 33 series and current Yahoo/CoinGecko market metrics now receive additive `Observation.semantics` during normalization. Legacy `ObservationDomain` remains unchanged for history compatibility; old Market Memory rows can resolve approved semantics from stable `seriesId`/`metricId` without rewrite.
- **MVP coverage gaps:** Macro still lacks complete global-policy/expectation/pricing coverage; Crypto stablecoin status is **PRODUCTION-ACTIVE — INTERNAL/NON-COMMERCIAL MVP**, with UI and reasoning still absent. BTC ETF flow status is **RUNTIME IMPLEMENTED / LIVE ENTITLEMENT & PRODUCTION ACTIVATION PENDING**: SoSoValue is limited to official authenticated API use for the internal/non-commercial MVP, the newest provider trading date remains non-canonical, acquisition freshness remains `UNKNOWN`, and effective-dated universe methodology remains unresolved. No scheduler, live production rows, UI, or reasoning exists. Crypto derivatives coverage remains missing. Gold has pricing but not a complete durable-history/baseline/flow-positioning reasoning chain.
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

Stablecoin acquisition is owned by the active standalone `p365-stablecoin` job at `17 1,13 * * *` (01:17 and 13:17 UTC), targeting `/api/cron/historical-ingestion` with `mode=FORWARD&providers=defillama`. It is intentionally separate from the five-minute `p365-market-fast` lane because the source cadence is daily. Configuration, explicit production invocation, bounded backfill, and unchanged-fact FORWARD idempotency are verified; a naturally elapsed permanent scheduled execution is not claimed by CRYPTO-LIQ-001C.

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
- USD stablecoin market cap is production-active through the separately qualified DefiLlama `peggedUSD` factual series; UI and reasoning integration remain absent;
- defined crypto volatility missing;
- breadth universe/metric missing;
- current endpoint is current-state oriented and does not itself establish durable historical continuity.

### SoSoValue — PROVISIONAL PROVIDER APPROVED / INTERNAL-NON-COMMERCIAL MVP

The owner selects SoSoValue as the first BTC ETF flow provider for the internal/non-commercial MVP through its official authenticated `/etfs/summary-history?symbol=BTC&country_code=US` API and provider-native `total_net_inflow` aggregate.

Because the response exposes no provider-native finality flag, `SOSOVALUE_ETF_FLOW_MATURITY_V0_1` excludes the newest valid provider trading date from canonical persistence. A prior date becomes `MATURED_ELIGIBLE_UNDER_P365_POLICY` only when the same authenticated response contains a valid strictly later provider trading date. This is provider-sequence progression, not a guessed clock or a claim of provider-native `FINAL` status.

The owner accepts the unresolved API-data storage-licence risk only for this internal/non-commercial MVP. Public redistribution, external API exposure, dataset resale, and commercial use remain unauthorized. Historical aggregate-universe membership remains provider-owned and unversioned; P365 does not fabricate constituent history.

CRYPTO-FLOW-001B implements one FRESH/no-store authenticated request with `limit=50`, strict response/date/value validation, unconditional latest-row exclusion, an inclusive 28-calendar-day BACKFILL ceiling with same-response maturity witness and coverage proof, exact provenance/semantics, unchanged FND-018A correction lineage, and a bounded repository-only five-session point-in-time read model. Acquisition freshness is `UNKNOWN`; no session calendar or provider finality time is invented. No authorized key was available for a live smoke read, so status is **RUNTIME IMPLEMENTED / LIVE ENTITLEMENT & PRODUCTION ACTIVATION PENDING**. Scheduler, production backfill/writes, UI, and reasoning remain absent.

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

FND-009 closed the confirmed manual-refresh defect. Dashboard-cached providers share one authoritative invalidation topology in `lib/data/cache-policy.ts`: the retained legacy `p365-dashboard` tag plus cadence groups `p365-fast`, `p365-medium`, and `p365-slow`. The **Muat ulang manual** Server Action iterates that complete set rather than invalidating only the legacy tag. Production E2E verified fresh CoinGecko/Yahoo/FRED retrievals before ordinary TTL expiry. Independent ingestion continues to use `cache: "no-store"` and is unaffected.

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

EXP-001 is merged and natural-production verified. Pre-release EventResult history is selected point-in-time by provider-independent Event identity, with forecast/consensus/projection semantics preserved and post-release information excluded from the pre-event baseline.

### Repricing

PRC-001 provides qualified point-in-time pricing baselines, CMP-001 provides no-lookahead PRE→post factual comparison, and RPR-001 is merged / production-ready as an explicit-threshold market-response contract. RPR-001 still has no universal production threshold defaults and does not infer factual surprise or causality.

### Transmission

CAP-001 now provides synchronized governed PRE/T+5/T+15/T+30/T+60 event-window Snapshots, and CMP-001/RPR-001 provide the qualified comparison/repricing inputs needed downstream. Merged TRN-001 / PR #75 adds explicit versioned driver→response relationship rules and evaluates only threshold-qualified cross-asset response coherence. Static relationship assumptions and causal claims remain prohibited; degraded, unresolved, or contaminated evidence must fail closed.

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
| FND-006 | **SNP-001 + CAP-001 FULL PASS / PRODUCTION E2E VERIFIED** | Immutable point-in-time Snapshot capture, append-only persistence and historical retrieval are production-active. Durable Goods Orders naturally produced COMPLETE PRE/T+5/T+15/T+30/T+60 Snapshots with full current-MVP Observation/Baseline lineage. |
| FND-007 | **PRC-001 BASELINE CONTRACT REMEDIATED / POLICY-PATH COVERAGE PARTIAL** | Canonical point-in-time Pricing Baseline is merged and production-deployed for approved `PRICING` observations. OIS/Fed-funds/SOFR-futures implied policy-path coverage remains missing, so policy-probability repricing claims are still prohibited. |
| FND-008 | MEDIUM | FND-003B now gates Biquote `time` → `releasedAt`/`occurredAt` promotion on `timeMode=exact`; broader provider release-time semantics and production qualification remain open. |
| FND-009 | **CLOSED / PRODUCTION ACTIVE** | Manual refresh invalidates the authoritative complete dashboard cache-tag set: retained legacy `p365-dashboard` plus `p365-fast`, `p365-medium`, and `p365-slow`. Production E2E verified an authenticated refresh at 02:10:36 UTC with `POST /dashboard 200` → `GET /dashboard 200`, zero runtime errors, and new CoinGecko/Yahoo/FRED retrieval timestamps before their normal cache TTLs expired. |
| FND-010 | **OBSERVATION PORTION REMEDIATED BY FND-010A / REMAINDER OPEN** | Future qualified FRED/CoinGecko/Yahoo Observations carry typed source-native resource/identity/date provenance while retaining legacy metadata. Exact provider release time is not fabricated. Event/Evidence provenance and broader provider qualification remain separate. |
| FND-011 | **FND-011A PRODUCTION ACTIVE / FND-011B CLOSED / PRODUCTION ACTIVE** | FRED cadence freshness remains acquisition-time deterministic. FND-011B production activation is verified: scheduled historical ingestion returned HTTP 200 and a Yahoo `GC=F` observation inside the qualified CME Globex Gold window persisted `freshnessCalendar=CME_GLOBEX_GOLD` with `quality=FRESH`. Exact holiday/early-close calendars remain an explicit future qualification boundary rather than fabricated runtime state. |
| FND-012 | MEDIUM | Non-crypto Yahoo adapter reuses `CryptoMarketObservationInput`. |
| FND-013 | MEDIUM | MOVE remains absent from target cross-asset universe. |
| FND-014 | **EXP-001 FULL PASS / PRODUCTION E2E VERIFIED** | Durable Goods Orders natural production capture selected the qualified Biquote FORECAST EventResult through provider-independent `eventIdentityKey` as a VALID pre-release Expectation baseline across all governed slots. |
| FND-015 | MEDIUM | Foundation-critical coverage remains incomplete, although FND-003A/B now have focused runner, auth, normalization, cache-policy, idempotency and failure-isolation regression tests. |
| FND-016 | LOW | UI still has English/raw-status governance leakage. |
| FND-017 | **CLOSED / PRODUCTION-ACTIVE** | PR #65 is merged and deployed. Production resolves Next.js 15.5.26, `eslint-config-next` 15.5.26, PostCSS 8.5.28 and Sharp 0.35.4; verification reported `npm audit` 0 vulnerabilities, lint/build PASS, and no post-deploy runtime errors. |
| FND-018 | **OBSERVATION FND-018A FULL PASS / CLOSED / REMAINDER OPEN** | Production-active Observation writes use SHA-256 versioned measurement/revision identity: identical factual refetches dedupe, changed values survive as distinct immutable revisions, and `retrievedAt` remains availability rather than revision content. Legacy rows remain readable without rewrite. Event/Evidence and other record-family lineage remain separate. |
| FND-019 | **CLOSED / PRODUCTION-ACTIVE** | Provider-independent Event identity v1 is active in production. Durable Goods Orders carried the same identity across Biquote/Forex Factory schedule rows, and Biquote EventResult lineage used that identity in natural CAP capture. Provider-specific IDs/Evidence remain preserved; unqualified/non-exact events remain distinct. |
| FND-020 | **REMEDIATED** | Additive semantic dimensions preserve legacy `ObservationDomain` and FND-001 history identity. FND-018A changes only future Observation revision IDs; legacy canonical IDs/rows remain immutable and readable without destructive backfill. |
| FND-021 | **HIGH / MVP COVERAGE GAP** | The approved MVP is **Macro + Crypto + Gold**. Current Macro remains materially US/Fed-centric and incomplete in policy expectations/pricing. CRYPTO-LIQ-001A/B/C establish production-active stablecoin factual evidence while DefiLlama remains qualified only as **QUALIFIED_CANDIDATE — INTERNAL/NON-COMMERCIAL MVP**; stablecoin UI and reasoning remain absent. CRYPTO-FLOW-001A/001A.1 freeze `crypto.us_spot_btc_etf_net_flow.usd` as `MARKET / CRYPTO / FLOW / US / ETF / BTC` and approve SoSoValue provisionally for official authenticated API use inside the internal/non-commercial MVP. CRYPTO-FLOW-001B implements the bounded factual runtime, rolling correction recheck, maturity/coverage-safe BACKFILL, exact provenance/semantics, FND-018A revisions, and five-session point-in-time read model. Live entitlement and production activation remain pending; freshness remains `UNKNOWN`. API-data permission ambiguity and provider-owned unversioned universe methodology remain accepted/known limitations, not commercial or redistribution authorization. Farside remains reference-only and CoinGlass paid/not free-first. Derivatives inputs remain missing. Gold exists as pricing but lacks a complete historical/baseline/flow-positioning chain. Full Equity, broad Credit, broad Commodities beyond Gold and other multi-asset domains are post-MVP unless used as supporting evidence. |
| FND-022 | **CLOSED / PRODUCTION-ACTIVE** | PR #66 merged as `fa52e6d9729aca1327bee687bd67bc7206b8c5b0`; production deployment is READY. Dashboard rendering no longer persists normalized canonical records or EventResults; durable ingestion ownership remains exclusively with authenticated cron workers. The four direct Supabase Market Memory/EventResult fetches plus the HistoricalObservation query used by dashboard factual baselines fail bounded after 10 seconds via `AbortSignal.timeout`. |
| CAP-001A | **CLOSED / PRODUCTION-ACTIVE** | PR #67 merged as `3b374be8fc9db9e7855b0efc2dc0767d0c8f07f4`. The first production CAP run after deployment at 12:51Z moved from `candidateEvents=0` to `candidateEvents=1`, `qualifiedWindows=1` and reconstructed PRE/T+5/T+15. Event-history candidate filtering is therefore fixed. |
| CAP-001B | **CLOSED / PRODUCTION-ACTIVE** | PR #68 merged as `0e188867fc4b1388d207d0e502a6f2e9ef60afbe`. Production run at 13:36Z returned `candidateEvents=1`, `dueSlots=5`, `captured=0`, `alreadyCaptured=5`, proving Observation/EventResult/Snapshot history filters and exact-slot lookup are now functioning. Existing defective PARTIAL Snapshots remain immutable and require CAP-001C supersession. |
| CAP-001C | **CLOSED / PRODUCTION-ACTIVE** | PR #69 merged as `de57880958eecdc61d60ff992f3229d8ebd13205`; production deployment is READY. Append-only Snapshot correction/supersession is active. The first normal cron after deployment returned `EMPTY` because the Jobless Claims slots were already outside the intentionally bounded 90-minute discovery window; this is expected and does not invalidate the correction contract. |
| CAP-001D | **MERGED / PRODUCTION READY** | PR #71 merged as `55027a693aec1892926368c36c67e5eda4160b83`; exact Vercel production deployment is READY. The POST-only authenticated targeted repair path bypasses only the normal 90-minute discovery bound, never first-materializes missing historical slots, and reuses CAP-001C supersession/no-lookahead rules. Initial Jobless Claims historical defective rows remain available as repair evidence; targeted repair has not yet been invoked in production. |

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
| 24 Sep 2026 | CAP-001B remaining history-filter correction | After CAP-001A restored Event candidates, production reconstruction created PRE/T+5/T+15 as PARTIAL because Observation, EventResult and Snapshot history adapters still emitted quoted PostgREST scalar filters. CAP-001B converts those remaining filters to raw equality values and bounds EventResult/Snapshot history reads at 10 seconds. The already-written PARTIAL rows are retained append-only and require a separate explicit correction/supersession path rather than overwrite/delete. |
| 24 Sep 2026 | CAP-001C append-only Snapshot supersession | Introduces immutable correction chains for event-window Snapshots. Corrected rows never overwrite/delete predecessors; they append a new deterministic Snapshot with explicit supersession metadata. Only strictly improving reconstructions can supersede an active slot, and subsequent retries resolve the single active chain tip idempotently. |
| 25 Sep 2026 | CAP-001D targeted historical Snapshot repair | Adds an authenticated explicit Event-identity repair path for historical slots that have aged out of the 90-minute cron discovery window. It only repairs logical slots already present in durable Snapshot history, preserves original semantic target times, and reuses CAP-001C append-only supersession. No recurring scheduler is attached to the repair endpoint. |
| 25 Sep 2026 | Durable Goods natural CAP production proof | Biquote HIGH Durable Goods Orders at 12:30Z naturally produced PRE/T+5/T+15/T+30/T+60 Snapshots through the recurring production CAP scheduler. All five Snapshots are COMPLETE, reference four BTC/ETH/DXY/Gold Observations, carry VALID Pricing baselines and a VALID Biquote FORECAST Expectation baseline, and have no missing requirements. This closes the CAP natural-production evidence gate and authorizes RPR-001 as the next dependency checkpoint. |
| 26 Sep 2026 | CAP-001D production activation | PR #71 merged as `55027a693aec1892926368c36c67e5eda4160b83`; exact production deployment is READY. Historical repair remains manual/authenticated and is not attached to recurring cron. |
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
| 24 Sep 2026 | CAP-001 Event-Window Runtime Snapshot Capture | Added a durable HistoricalEventRepository plus an authenticated `/api/cron/snapshot-capture` runtime owner. The runner selects the latest Event revision per provider before FND-019 reconciliation, reconstructs due EVW-001 PRE/T+5/T+15/T+30/T+60 slots at deterministic target timestamps, constrains every Observation/EventResult to availability at or before each target, materializes fixed BTC/ETH/DXY/Gold pricing slots plus expectation lineage, preserves missing/stale/unknown quality, and detects already-materialized slots idempotently. During CAP-001 audit, legacy pg_cron job `capture-snapshot-schedule` was proven orphaned: it called Supabase Edge Function `bright-responder`, which writes to removed table `public.market_snapshots`, had no P365 repo consumer, and returned repeated HTTP 500 responses. The orphaned cron job was unscheduled successfully on 24 Sep 2026. The Edge Function remains deployed but inert because the available Supabase connector exposes no delete-function operation; it must not be reused for CAP-001. Production activation subsequently moved to the distinct authenticated `p365-snapshot-capture` Supabase `pg_cron` job. No repricing/transmission logic is activated. |
| 26 Sep 2026 | RPR-001 Event Repricing Contract | Added a read-only deterministic consumer of CMP-001 PRE→post-event comparisons with explicit positive per-observation thresholds, percent/absolute magnitude bases, mechanical UP/DOWN/FLAT direction, explicit unconfigured/unresolved coverage, contamination override, and `causalAttribution=NOT_EVALUATED`. No default market thresholds, factual-surprise inference, Transmission, State, Risk, Regime, Intelligence, persistence owner, or trading logic is activated. |
| 26 Sep 2026 | TRN-001 Cross-Asset Transmission Contract | Added a read-only deterministic consumer of RPR-001 with explicit versioned driver→response relationship methodology, threshold-qualified cross-asset edges, coherent/divergent/response-below-threshold evidence, fail-closed degraded/unresolved handling, contamination precedence, deterministic SHA-256 lineage, and `causalAttribution=NOT_EVALUATED`. No static cross-asset direction rule, historical-correlation calibration, provider expansion, persistence owner, State, Risk, Regime, Intelligence, or trading logic is activated. |
| 28 Sep 2026 | SUR-001 Point-in-Time Factual Event Surprise | Added a read-only deterministic consumer of EXP-001 plus durable EventResult history. Actual selection is provider/Event-identity scoped and bounded to `releaseAt <= retrievedAt <= asOf`; VALID surprise requires matching unit/period and preserves expected type, raw absolute difference, optional percent difference, Evidence lineage and `causalAttribution=NOT_EVALUATED`. Missing/partial/repository-failure states fail closed. No materiality threshold, repricing/transmission policy mutation, provider expansion, persistence owner, State, Risk, Regime, Intelligence, UI, or trading logic is activated. |
| 28 Sep 2026 | EVR-001 Integrated Event Response Evidence | Added a read-only deterministic evidence bundle that reuses SUR-001 and the existing CMP-001 → RPR-001 → TRN-001 chain. The bundle requires one provider-independent Event identity, shared Event Window/post role, exact RPR/TRN lineage, and `SUR.asOf == post Snapshot capturedAt`. It introduces no new interpretation, thresholds, relationship assumptions, persistence runtime, State, Risk, Regime, Intelligence, UI, or trading logic. |
| 29 Sep 2026 | CRYPTO-LIQ-001A USD Stablecoin Market Cap Contract & DefiLlama Qualification | Froze `crypto.usd_stablecoin_market_cap.usd` as a `MARKET / CRYPTO / OBSERVATION / GLOBAL` provider-native aggregate mapped only from `/stablecoincharts/all` → `totalCirculatingUSD.peggedUSD`. DefiLlama is **QUALIFIED_CANDIDATE — INTERNAL/NON-COMMERCIAL MVP** under the reviewed Terms boundary; runtime/provider integration, persistence, freshness qualification, backfill, read model and UI remain missing and gated to CRYPTO-LIQ-001B after owner merge. |
| 29 Sep 2026 | CRYPTO-LIQ-001B DefiLlama USD Stablecoin Market Cap Runtime | Added the dedicated `/stablecoincharts/all` provider path with strict `totalCirculatingUSD.peggedUSD` validation, FORWARD latest-only behavior, explicit DefiLlama-only bounded BACKFILL up to 35 inclusive calendar days, canonical MARKET Observation normalization, append-only FND-018A revision identity, exact provenance/semantics, daily UTC cadence freshness, and a four-point point-in-time latest/1D/1W/4W read model. Status is **RUNTIME IMPLEMENTED / PRODUCTION ACTIVATION PENDING**: no scheduler, production backfill, UI, Supabase change, reasoning, or public redistribution is included. |
| 30 Sep 2026 | CRYPTO-LIQ-001C Stablecoin Production Activation | Production deployment is `READY` at exact PR #103 merge SHA `5638872ad1a8a006593aa54b310a88a09db89873`. An authenticated bounded `2026-08-26` through `2026-09-29` backfill produced 35 durable Observations across 35 distinct effective dates; a subsequent authenticated FORWARD left the count at 35, proving unchanged-fact idempotency. The active standalone Supabase `pg_cron` job `p365-stablecoin` runs at `17 1,13 * * *`; a naturally elapsed permanent scheduled run is not claimed. The source verdict remains **QUALIFIED_CANDIDATE — INTERNAL/NON-COMMERCIAL MVP**; UI and reasoning remain absent. |
| 30 Sep 2026 | CRYPTO-FLOW-001A US Spot BTC ETF Daily Net Flow Contract & Source Qualification | Froze `crypto.us_spot_btc_etf_net_flow.usd` as provider-native `MARKET / CRYPTO / FLOW / US / ETF / BTC` factual evidence with explicit trading-date, partial/final, missing/zero, append-only revision, and effective-dated universe requirements. SoSoValue documents `GET /etfs/summary-history?symbol=BTC&country_code=US` → `total_net_inflow` in USD and sufficient one-month immediate history, but API-use/storage permission, aggregate finality, and historical universe semantics remain unresolved. Farside is reference-only with runtime automation/licensing unqualified; CoinGlass is technically suitable but paid and not free-first. Status is **CONTRACT DEFINED — PROVIDER QUALIFICATION OPEN**; runtime, credentials, persistence, scheduling, UI, and reasoning remain absent. |
| 30 Sep 2026 | CRYPTO-FLOW-001A.1 SoSoValue Provisional Maturity & Owner-Approved Runtime Boundary | Records the owner's selection of SoSoValue as the first BTC ETF flow provider for the internal/non-commercial MVP and accepts the unresolved API-data storage-licence risk only inside that boundary. Freezes `SOSOVALUE_ETF_FLOW_MATURITY_V0_1`: the newest valid provider trading date is always provisional/non-canonical, while an earlier date becomes `MATURED_ELIGIBLE_UNDER_P365_POLICY` only when the same authenticated response contains a valid strictly later provider date. Guessed wall-clock finality remains prohibited; recent history must be rechecked for append-only corrections under unchanged FND-018A identity. Historical universe membership remains provider-owned/unversioned, and public redistribution, external API exposure, resale, and commercial use remain unauthorized. Status becomes **CONTRACT FROZEN / PROVISIONAL PROVIDER APPROVED — RUNTIME ELIGIBLE**; CRYPTO-FLOW-001B may begin after owner merge but must prove live entitlement, schema, maturity/latest-row exclusion, rolling correction detection, provenance, point-in-time reads, server-only credentials, and quota safety. |
| 30 Sep 2026 | CRYPTO-FLOW-001B SoSoValue BTC ETF Flow Runtime & Durable History | Implements the server-only official `/etfs/summary-history?symbol=BTC&country_code=US&limit=50` provider path, strict schema/date/value validation, unconditional newest-row exclusion under `SOSOVALUE_ETF_FLOW_MATURITY_V0_1`, one-request rolling correction recheck, inclusive 28-calendar-day maturity/coverage-safe BACKFILL, exact `MARKET / CRYPTO / FLOW / US / ETF / BTC / USD` normalization and provenance, unchanged FND-018A idempotency/corrections, and a bounded repository-only five-session point-in-time read model. Acquisition quality remains `UNKNOWN`. No authorized key was available for a live smoke read, so status is **RUNTIME IMPLEMENTED / LIVE ENTITLEMENT & PRODUCTION ACTIVATION PENDING**. No scheduler, production write/backfill, UI, reasoning, Supabase change, or public/commercial redistribution is included. |
| 30 Sep 2026 | CRYPTO-FLOW-001C SoSoValue BTC ETF Flow Production Activation | PR #111 merged; production activation is verified. Authenticated live FORWARD ingestion persisted 20 maturity-eligible Observation dates while excluding the newest provider date. PR #110 corrected generic Observation-derived Evidence idempotency without changing FND-018A or rewriting append-only history; a subsequent authenticated FORWARD created zero additional SoSoValue rows. Active Supabase job `p365-sosovalue-etf-flow` runs at `27 1,13 * * *`. Status is **PRODUCTION-ACTIVE — INTERNAL/NON-COMMERCIAL MVP**; UI/reasoning remain absent. |
| 30 Sep 2026 | GOLD-FLOW-001A Gold ETF Flow & Holdings Contract / Source Qualification | Freezes paired global physically-backed Gold ETF evidence: `gold.global_physically_backed_etf_net_flow.usd` as `MARKET / COMMODITY / FLOW / GLOBAL / ETF / GOLD`, and `gold.global_physically_backed_etf_holdings.tonnes` as `MARKET / COMMODITY / INVENTORY / GLOBAL / ETF / GOLD`. World Gold Council/Goldhub is the strongest semantic global reference but current audited Terms do not authorize automated scraping/durable runtime; SPDR GLD provides qualified single-fund daily holdings reference but is not a global-flow substitute and its historical-data disclaimer restricts reproduction/redistribution. Status is **CONTRACT FROZEN / RUNTIME PROVIDER QUALIFICATION OPEN**; no provider/runtime/scheduler/backfill/UI/reasoning is added. |
| 30 Sep 2026 | GOLD-POS-001A CFTC Gold COT Positioning Contract / Source Qualification | Freezes CFTC Disaggregated Futures Only positioning for COMEX Gold CFTC code `088691` as weekly `MARKET / COMMODITY / POSITIONING / US / FUTURE / GOLD` raw long/short/spreading participant evidence, with total open interest retained separately. Managed Money, Producer/Merchant/Processor/User, Swap Dealer, Other Reportables and Non-reportable categories remain source-native; non-reportable is not renamed retail. Tuesday report/effective date is separated from Friday publication/retrieval availability, Futures Only is never mixed with Combined, and derived net/percentile/z-score remain deferred. CFTC PRE dataset `72hh-3qpy` provides official API access, long history and public-domain government data. Status is **CONTRACT FROZEN / CFTC SOURCE QUALIFIED CANDIDATE — RUNTIME OWNER APPROVAL PENDING**; no runtime/provider/scheduler/backfill/UI/reasoning is added. |
| 30 Sep 2026 | GOLD-POS-001B CFTC Gold COT Factual Runtime | Implements server-only CFTC PRE dataset `72hh-3qpy` for COMEX Gold contract code `088691` through the existing historical-ingestion owner. FORWARD rechecks 8 recent weekly reports; explicit single-provider BACKFILL is bounded to 370 inclusive calendar days. Fourteen raw contract-count series preserve participant long/short/spreading and open-interest facts with exact `COMMODITY / POSITIONING / US / FUTURE / GOLD` semantics, source field/contract provenance, FND-018A revisions, semantic Evidence dedupe, and `quality=UNKNOWN`; no release timestamp, net positioning, percentile/z-score, or daily interpolation is fabricated. Validation fails closed on wrong contract/report family, duplicate dates, malformed counts, schema drift, and out-of-range responses. Status is **RUNTIME IMPLEMENTED / LIVE PRE VERIFICATION & PRODUCTION ACTIVATION PENDING**; no production scheduler/backfill/UI/reasoning is activated. |
| 30 Sep 2026 | GOLD-POS-001C CFTC Gold COT Production Activation | Production exact main SHA `94fccaf11eaae232898e586d62af0b3e27b4f281` is READY. Live PRE verification over the latest 8 Gold reports confirmed 8/8 contract code `088691`, 8/8 `FutOnly`, 8 distinct report dates, all 14 target fields present, and 112/112 target values as non-negative integers. The only live schema correction was Managed Money spreading `m_money_positions_spread`. Production FORWARD persisted exactly 112 Observations + 112 Evidence across 14 series × 8 dates (2026-08-04 through 2026-09-22), all with correct COMMODITY/POSITIONING/US/FUTURE/GOLD semantics, CFTC dataset/contract provenance and `quality=UNKNOWN`. An unchanged rerun left durable counts at 112/112, proving idempotency. Active Supabase job `p365-cftc-gold-cot` (jobid 20) runs at `48 22 * * *`; daily post-release acquisition covers normal EDT/EST timing and holiday-delayed releases without fabricating release timestamps. Status is **PRODUCTION-ACTIVE**; no production backfill beyond FORWARD, derived net/percentile/z-score, UI, reasoning, State/Regime/Risk/Intelligence or trading signal is activated. |
| 1 Oct 2026 | MACRO-PRICING-001A US Policy-Implied Pricing Contract / Source Qualification | Freezes the missing US market-implied FOMC policy-path evidence as `RATES / PRICING / US`, distinct from factual EFFR/SOFR, Treasury yields, real yield, breakeven, official Dot Plot and survey expectations. Under current FND-018A identity, each provider-native meeting/target-rate probability bucket is uniquely keyed by FOMC meeting date + target-rate bounds while `observedAt` remains the qualified quote/as-of timestamp. CME FedWatch is the strongest audited semantic source: it publishes FOMC outcome probabilities implied by 30-Day Fed Funds futures, documents the probability-tree methodology, current/historical views and a dedicated FedWatch API. Current official CME website/data terms continue to prohibit unlicensed automated website extraction and software/archive use, while CME separately offers API access and non-display licensing for system-based research/analysis. New York Fed/FRED factual rates remain supporting sources, not substitutes for the policy path. Status is **CONTRACT FROZEN / CME FEDWATCH SEMANTICALLY QUALIFIED / RUNTIME LICENSING OPEN**; no runtime, API credential, scheduler, backfill, derived terminal-rate/cut-count metric, UI or reasoning is added. |
| 1 Oct 2026 | HIST-001A Point-in-Time Historical Baseline Contract | Defines single-series point-in-time historical distribution evidence using explicit LEVEL, ABSOLUTE_CHANGE, PERCENT_CHANGE or ABSOLUTE_PERCENT_CHANGE transforms; historical windows end strictly before the target, repository reads remain `retrievedAt <= asOf`, later-known revisions cannot leak backward, STALE historical facts retain FND-002Q fitness, change samples require exact matching horizons with no interpolation/fill, and VALID output exposes deterministic median plus empirical mid-rank percentile without labeling normal/unusual or introducing State/Regime/Risk/Intelligence/trading semantics. Status is **CONTRACT MERGED / PR #130 / HIST-001B MERGED / PR #131**. |
| 1 Oct 2026 | HIST-001B Repository-Backed Historical Baseline Runtime | Implements the HIST-001A contract as a read-only application/domain layer over `HistoricalObservationRepository`. Target observations must match canonical identity/source and be knowable by `asOf`; historical candidates are revalidated for identity, source, unit/frequency, retrieval cutoff and FND-002Q fitness. LEVEL and exact-horizon ABSOLUTE_CHANGE/PERCENT_CHANGE/ABSOLUTE_PERCENT_CHANGE samples retain exact Observation lineage; no interpolation/fill is allowed. VALID output exposes deterministic min/max/median and empirical mid-rank percentile. Repository failures, incompatible targets and incomplete bounded-history coverage fail closed. Status is **RUNTIME MERGED / PR #131**; no provider, persistence, scheduler, UI, State/Regime/Risk/Intelligence or trading logic is added. |
| 1 Oct 2026 | HIST-001C Event-Window Historical Move Context | Reuses qualified PRE→post CMP/EVW Snapshot pairs and HIST-001B to measure each explicitly requested event-window market move against a same-series historical distribution. The historical horizon is derived from the actual canonical before/after Observation timestamps rather than the event role label; the historical window ends strictly before PRE, the shared knowledge cutoff is the post Snapshot `capturedAt`, and caller-owned transformation/lookback/minimum-sample/methodology remain explicit. Requested-but-missing Observation slots remain explicit, CMP contamination identity is retained, and every resolved series embeds exact HIST-001B lineage. Status is **INTEGRATION MERGED / PR #132**; no UI, persistence, provider, abnormality threshold, State/Regime/Risk/Intelligence, causality or trading logic is added. |
| 1 Oct 2026 | HIST-001D Intraday Historical Baseline Calibration | Freezes the first explicit event-window magnitude calibration for `btc.spot.usd`, `dxy.index.usd` and `gold.futures.usd`: `ABSOLUTE_PERCENT_CHANGE`, 36-hour lookback, minimum 30 exact-horizon samples, methodology `intraday-event-magnitude-historical-context-v1`. Production audit of actual PRE→post horizons 10/20/35/65 minutes found 36-hour distinct endpoints below 500 for BTC/DXY/Gold (432/412/419) and exact pairs of 125–144 / 113–154 / 34–36 respectively. A 42-hour candidate was rejected because DXY/Gold were already near the 500-row bound. Status is **CALIBRATION MERGED / PR #133**; no UI, provider, persistence, scheduler, percentile label, State/Regime/Risk/Intelligence, causality or trading logic is added. |
| 2 Oct 2026 | HIST-001E Event-Response Historical Evidence Integration | Binds the existing EVR-001 SUR/RPR/TRN evidence chain to HIST-001C historical context while requiring identical provider-independent Event identity, Event Window, post-event role, CMP comparison ID and post-event knowledge cutoff; both chains retain `causalAttribution=NOT_EVALUATED`. A calibrated intraday wrapper applies the frozen HIST-001D BTC/DXY/Gold magnitude policy, while the generic builder retains explicit caller-owned series methodology. Status is **INTEGRATION IMPLEMENTED / OWNER MERGE PENDING / TERMINAL HIST CHECKPOINT FOR CURRENT MVP**. No dashboard critical-path query, persistence, provider, scheduler, UI, percentile label, State/Regime/Risk/Intelligence or trading logic is added. |

| 2 Oct 2026 | MOVE-001B Continuous-Horizon & Materiality Calibration | Production read-only calibration confirms roughly five-minute BTC/Gold cadence while rejecting observation-count horizon shortcuts. Freezes 15/30/60/120-minute elapsed horizons, explicit ±60s nearest-time pairing, 36-hour rolling ABSOLUTE_PERCENT_CHANGE history, minimum 120 eligible samples and empirical P97.5 materiality under `continuous-market-move-materiality-v1`. Current 36-hour samples remain above 400 for every target/horizon; P90/P95 were too broad across four horizons and P99 was less sensitive. The reproduced 2 Oct BTC move is above the complete pre-move sample at all four horizons. Status is **CALIBRATION PROPOSED / OWNER MERGE PENDING**; no detector runtime, persistence, provider, scheduler, UI, causality, State/Regime/Risk/Intelligence or trading logic is added. |

| 3 Oct 2026 | MOVE-001C Read-Only Continuous Move Detector Runtime | Implements a repository-backed evaluator for the frozen BTC/Gold MOVE-001B policy. Each explicit target end Observation is validated for calibrated series/source identity, point-in-time availability, historical fitness and latest-knowable revision. 15/30/60/120-minute target and historical pairs use deterministic nearest elapsed-time matching inside ±60s; history ends strictly before target start, later-known revisions are excluded, 500-row-bound and <120-sample conditions fail closed, and P97.5 is recalculated with percentile_cont-compatible linear interpolation rather than hardcoded percentages. Per-horizon output retains signed/magnitude move, direction, alignment error, threshold, empirical percentile and exact lineage with `causalAttribution=NOT_EVALUATED`. Status is **RUNTIME PROPOSED / OWNER MERGE PENDING**; no persistence, scheduler, UI, provider expansion, driver attribution, State/Regime/Risk/Intelligence or trading logic is added. |

| 3 Oct 2026 | MOVE-002A Move-Centered Evidence Investigation Contract / Coverage Audit | Freezes evidence roles after a material MOVE trigger: SYNCHRONOUS_MARKET, SLOW_BACKGROUND, SCHEDULED_CATALYST, UNSCHEDULED_CATALYST, CRYPTO_MARKET_STRUCTURE and INTRADAY_RATES_PRICING. Production synchronization audit supports ±120s for BTC/ETH/DXY/Gold factual fingerprints. The 2 Oct BTC case shows +1.7750% BTC / +1.1012% ETH / -0.0186% DXY / +0.3328% Gold over ~60m and +2.1669% / +1.2231% / -0.1049% / +0.7472% over ~120m, while the next major scheduled US labor release was ~8h later. Stablecoin and ETF flow are available only as slower background at that cutoff; FRED rates are not intraday; qualified BTC derivatives and durable NEWS evidence are absent. Status is **CONTRACT / COVERAGE AUDIT PROPOSED / OWNER MERGE PENDING**. This creates a concrete dependency for Binance derivatives source qualification without authorizing provider integration. |

| 3 Oct 2026 | CRYPTO-STRUCT-001A BTC Derivatives Provider Landscape & Source Qualification | Corrects the initial Binance-first framing before runtime. CryptoQuant directly supports `all_exchange` BTC perpetual OI, funding, taker buy/sell and liquidation evidence, with USD normalization for OI/taker and minute resolution on the current Professional tier; it is the preferred cross-exchange candidate, pending owner subscription/entitlement/live-shape and durable-use verification. CoinGlass supplies the broadest provider-native aggregate surface including OI-weighted funding, aggregated liquidations/taker and basis, but 5m requires Standard and current API Terms restrict bulk independent database construction without written consent. Coinalyze offers free 1m/5m per-market OI/funding/liquidation data at 40 calls/min with only 1500–2000 intraday points; any market-wide aggregate would be an explicit P365 derived methodology. Binance remains useful venue-native fallback, not a proxy for the whole market. Coin Metrics, Kaiko and Amberdata remain higher-cost/entitlement institutional references. Status is **PROVIDER LANDSCAPE / SOURCE QUALIFICATION PROPOSED / OWNER MERGE PENDING**; no provider runtime, purchase, credentials, writes, scheduler, UI, causality or trading logic is added. |

| 4 Oct 2026 | ASIA-MACRO-001A China/Japan FX Transmission Evidence | Reuses the existing Yahoo Finance trial market-data path to add `fx.usdjpy.jpy_per_usd` and `fx.usdcnh.cnh_per_usd` as synchronous FX/PRICING evidence for MOVE investigation. The pair identity remains explicit; JAPAN/CHINA jurisdiction represents the non-USD economy being monitored. A regular Sunday-17:00-ET to Friday-17:00-ET `GLOBAL_FX_24_5` freshness window is added, provider quote time remains distinct from retrieval time, and historical-ingestion gains bounded FORWARD lanes `usdjpy`/`usdcnh`. FND-003B already covers US/CHINA/JAPAN scheduled Events, so no duplicate BoJ/PBoC calendar path is introduced. Production cron, backfill, UI, MOVE wiring, causality and trading semantics remain inactive pending merge/live proof. |
| 4 Oct 2026 | ASIA-MACRO-001B China/Japan FX Production Activation | Owner-approved activation extended the existing Supabase `p365-market-fast` five-minute job from `coingecko,gold,dxy` to `coingecko,gold,dxy,usdjpy,usdcnh` using `cron.alter_job`; no duplicate scheduler was created. A controlled authenticated production invocation returned HTTP 200/SUCCESS and durably persisted one canonical Observation/Evidence for each Asia FX series. USDJPY remained `UNKNOWN` because Yahoo's weekend timestamp fell outside `GLOBAL_FX_24_5`; USDCNH remained `FRESH` under closed-weekend semantics. The next natural 23:47 UTC pg_cron run succeeded and included both lanes; repeated identical provider observations remained idempotent at one canonical row per series. Yahoo FX backfill, MOVE/UI wiring, JGB/CNY macro expansion, causality and trading semantics remain inactive. |



| 4 Oct 2026 | MACRO-RATES-001A Intraday US Rates Transmission Source Qualification | Documentation/source-qualification only. Treasury/FRED DGS2/DGS10/DFII10 remain authoritative daily background but fail synchronous 15/30/60/120m MOVE cadence. BrokerTec on-the-run U.S. Treasuries are the preferred direct nominal cash-market path if exact runtime schema and CME licensing are approved; CME 2YY/10Y Yield futures are the preferred explicit FUTURE proxy fallback and must never be relabeled cash yields. Twelve Data fixed income remains a bounded live-qualification candidate because upstream lineage, exact 10Y identity/timing and production rights are still unverified. GovPX is a strong realtime TIPS market source candidate, but no provider-native intraday constant-maturity 10Y real-yield series equivalent to DFII10 is qualified; real-yield intraday remains `MISSING_HIGH_VALUE_EVIDENCE`. Existing FedWatch policy-pricing licensing gate remains separate. No runtime/provider/dependency/cron/write/UI/causality/trading semantics activated. |

| 4 Oct 2026 | MACRO-RATES-001B Twelve Data Bounded Qualification | Qualification stopped at the access/entitlement gate before any provider runtime. Public Twelve Data docs prove `US2Y` fixed-income reference identity, generic 5m support and bar-open timestamp semantics. Current pricing separates Basic reference access from fixed-income market data (Pro individual / Venture business), current US demo/trial symbol is AAPL rather than a Treasury-yield symbol, and P365 Vercel environment has no `TWELVE_DATA_API_KEY`. Therefore US2Y/10Y 5m data, exact 10Y identity, latency/history/session behavior and upstream Treasury benchmark lineage remain unproven. Twelve Data remains ACCESS-GATED / NOT RUNTIME-APPROVED; no credential, purchase, provider code, scheduler, durable write or MOVE/UI wiring was activated. |
| 4 Oct 2026 | MACRO-RATES-001B continuation — Massive Treasury Futures Proxy Qualification | Owner instructed continuation in PR #166. Existing `MASSIVE_API_KEY` was used only in preview read-only qualification with zero durable writes. Massive verified CBOT `2YY`, `10Y`, `ZT`, and `ZN`; the bounded 5m proof found both active 2YY singles empty, 10YV6 usable, and materially denser standard Treasury futures: ZTZ6 527 bars / 3,050,214 volume / 174,869 transactions; ZNZ6 528 bars / 6,765,907 volume / 384,754 transactions. ZT/ZN remain `FUTURE` price evidence, not cash yields or basis-point observations. Public Massive individual terms and CME Non-Display policy now close the governance interpretation: current individual access does not authorize P365 recurring non-display research/analysis; a compliant Massive/CME business/non-display entitlement is required. The canonical roll methodology is frozen to prior completed-session volume, session-fixed ticker, forward-only roll, ties retain incumbent, and cross-contract comparisons fail as `ROLL_BOUNDARY`; 5m `observedAt = window_start + 5m` and no-trade intervals remain missing. No production adapter, scheduler, Market Memory write, MOVE wiring, or causal/trading semantics activated. |
| 4 Oct 2026 | MACRO-RATES-001B owner FREE-ONLY + Proxy Risk Review | Owner explicitly prohibited paid rates data and required proxy-risk review before any activation. Paid Massive/CME, Twelve Data and BrokerTec paths are therefore rejected for the current MVP. Tenor audit corrected the earlier ZT+ZN preference: CME ZN's deliverable basket is roughly 6.5–8y, while TN Ultra 10-Year is roughly 9y5m–10y and therefore more faithful to the 10Y macro point. A bounded read-only TNZ6 test returned 525 five-minute bars / 2,029,436 volume / 167,668 transactions, so tenor fidelity did not require accepting obvious illiquidity in the sampled session. If a free rights-compatible source later qualifies, ZT+TN is preferred; futures-price proxy evidence remains subject to CTD/basis/repo, DV01, roll, market-hours, stress-dislocation and causality risks and may never substitute for cash yields, bp changes, 2s10s curve magnitude, real yield or Fed-path pricing. No runtime/provider/scheduler/write activated. |

| 4 Oct 2026 | MOVE-002B Read-Only Move Evidence Bundle Runtime | Implements the first MOVE-002 runtime as a deterministic read-only application over HistoricalObservationRepository + HistoricalEventRepository. MATERIAL_MOVE is required; the investigation window is the union of material horizons and all evidence remains under the MOVE assessment `asOf`. Synchronous durable fingerprint uses ±120s nearest eligible points for BTC/ETH/DXY/Gold plus production-active USDJPY/USDCNH, with later-known revisions excluded. Scheduled Events are bounded to the move window and retrieved cutoff; BTC background composes stablecoin + matured ETF flow, Gold background composes CFTC positioning. Coinalyze derivatives, Binance spot flow, spot/perp order books and GDELT current feed are explicitly `INSUFFICIENT_DATA` for historical replay rather than live-fetched after the cutoff. Intraday rates remain `MISSING_HIGH_VALUE_EVIDENCE / FREE_ONLY_NO_APPROVED_RUNTIME`. Bundle writesPerformed=false, evidenceCompleteness remains EVIDENCE_INCOMPLETE, and causalAttribution remains NOT_EVALUATED. No provider, persistence, scheduler, UI, State/Regime/Risk/Intelligence or trading semantics activated. |

| 4 Oct 2026 | NEWS-001C Durable Unscheduled Catalyst History | Reuses the qualified GDELT GAL feed and existing Market Memory. One RSS fetch derives both BTC and Gold rolling-15m snapshots; each asset+feedLastBuildAt becomes deterministic canonical NEWS Evidence under `gdelt-gal-durable-snapshot-v1`, including zero-candidate snapshots so absence can later be distinguished from missing acquisition. Adds generic point-in-time Evidence history contract, in-memory implementation, Supabase adapter and dashboard repository export. Existing historical ingestion gains FORWARD-only `gdelt`; no fake BACKFILL is allowed. Production Supabase scheduler remains unchanged until owner merge, so this checkpoint is runtime-implemented but not production-active. No MOVE wiring, article scraping/tone/ranking, UI, causality or trading semantics activated. |

| 4 Oct 2026 | NEWS-001D Durable GDELT Production Activation | Extends the existing Supabase-owned `p365-market-fast` job in place (same job id 2, same five-minute cadence) from `coingecko,gold,dxy,usdjpy,usdcnh` to `coingecko,gold,dxy,usdjpy,usdcnh,gdelt`; no duplicate scheduler is created. Pre-activation durable GDELT rows were 0. Manual authenticated request 34068 returned HTTP 200/SUCCESS and wrote one BTC + one Gold NEWS Evidence snapshot for provider feed build 2026-10-04T11:47:00Z. BTC retained 3 matching candidates with COMPLETE coverage; Gold retained a valid zero-candidate COMPLETE snapshot. Immediate repeat request 34069 and first natural cron request 34070 at 11:57Z also returned HTTP 200/SUCCESS while Market Memory remained exactly 2 rows / 1 feed build / 2 assets, proving deterministic idempotency. Historical cutoff proof returned 0 rows before P365 retrieval and BTC+Gold after retrieval. Vercel runtime errors after activation were 0. Acquisition is forward-only; no pre-activation backfill, MOVE-002B historical-news wiring, article scraping/tone/ranking, causality or trading semantics are activated. |

| 4 Oct 2026 | NEWS-002A Catalyst Wire Source-Role Presentation | Adds a read-only Overview Catalyst Wire over evidence already available to P365: current CoinDesk/Alpha Vantage media items plus the latest durable GDELT BTC/Gold rolling-15m snapshots. A bounded official-origin domain map labels only explicit government/central-bank/regulator origins as SUMBER RESMI; ordinary direct news remains MEDIA and non-official GDELT candidates remain PENEMUAN. URL/title dedupe prefers the stronger source role for duplicate headlines without assigning a causal score. GDELT provider-date semantics remain publication-or-first-seen when supplied; missing provider dates use P365 retrieval time and are labeled as discovery rather than fabricated publication time. Discovery snapshots older than 30 minutes fail closed from the current wire. Dashboard read uses a two-hour, max-20 point-in-time Evidence query and performs no writes. No new provider, dependency, scheduler, canonical schema, article scraping, sentiment/tone, driver confirmation, State/Regime/Risk/Intelligence or trading semantics are introduced. |

| 5 Oct 2026 | NEWS-002A.1 GDELT Gold XAU False-Positive Hardening | Production Catalyst Wire exposed a real Gold-candidate false positive: a Vietnamese article URL containing `tin-xau` was lower-cased and the ordinary-language `xau` fragment was treated as ticker XAU. The Gold filter now accepts XAU/XAUUSD only as an explicit upper-case title token, while generic Gold still requires market context and bullion remains explicit. Focused regression coverage retains a legitimate `XAU/USD` headline while rejecting the reproduced non-market URL. No provider, persistence, scheduler, schema, UI, sentiment, causality, State/Regime/Risk/Intelligence or trading semantics are added. |

| 5 Oct 2026 | UI-TERMINAL-001B Premium Market Tape | Reworks only the Overview Market Tape presentation over existing P365 facts into six premium charcoal/gold terminal cards for BTC, Gold, DXY, US 10Y, matured BTC ETF flow and USD stablecoin supply. Responsive density is 6/3/2/1 columns without synthetic sparklines or fabricated metrics. BTC ETF maturity is explicitly labeled MATANG and its provider trading date remains visible; maturity is not represented as freshness. Provider inputs, canonical values, quality/freshness semantics, persistence, scheduler ownership, causality and downstream reasoning remain unchanged. |

| 5 Oct 2026 | UI-TERMINAL-001B.1 Mobile Market Tape Density | Post-merge visual audit found the premium tape became a long single-column stack at common 360–390px phone widths. The correction keeps a two-column tape down to 341px with tighter card typography/padding, falling back to one column only at 340px and below. Desktop/tablet layout, data, provider semantics, freshness/finality meaning, persistence and reasoning are unchanged. || 4 Oct 2026 | SPOT-FLOW-001C Durable Binance Spot-Flow Production Activation | Reuses existing Supabase `p365-market-fast` job id 2 at the unchanged five-minute cadence and appends `binance-spot` to the provider list; no duplicate scheduler is created. Pre-activation durable spot-flow rows were 0. First natural pg_cron run 34105 / pg_net request 34087 returned HTTP 200/SUCCESS and persisted two completed Binance BTCUSDT 5m Evidence windows (12:20Z and 12:25Z). Controlled repeat request 34088 also returned HTTP 200/SUCCESS while Market Memory remained exactly 2 rows / 2 window keys / 2 Evidence IDs, proving deterministic idempotency. Point-in-time cutoff returned 0 rows immediately before `12:27:02.170Z` and 2 at that retrieval timestamp. No post-activation Vercel error/fatal logs were observed in the verification window. Binance BACKFILL, Bybit persistence, MOVE-002B historical spot-flow consumption, market-wide aggregation, UI, causality and trading semantics remain inactive. |

| 4 Oct 2026 | MOVE-002C Durable BTC Spot-Flow Replay | Extends the read-only MATERIAL_MOVE evidence bundle to consume production-active Binance BTCUSDT completed 5m Evidence via `HistoricalEvidenceRepository`. The query remains bounded and point-in-time (`retrievedAt <= asOf`), derives expected 5m completion boundaries across the union MOVE window, exposes COMPLETE/PARTIAL/EMPTY coverage, retains per-window factual lineage/metrics, and selects the latest same-window revision knowable at the cutoff. A later-known correction is excluded by regression proof. No CVD aggregation, directional interpretation, provider call, persistence, scheduler, UI, hypothesis scoring or causal attribution is introduced. Because durable acquisition started 4 Oct, the reproduced 2 Oct MOVE remains correctly without spot-flow history rather than receiving fabricated backfill. |

| 4 Oct 2026 | MOVE-002D Durable GDELT Catalyst Replay | Extends the read-only MATERIAL_MOVE bundle to consume production-active GDELT BTC/Gold rolling-15m NEWS Evidence under the same point-in-time cutoff. Durable feed intervals are clipped/unioned against the MOVE window to expose COMPLETE/PARTIAL/EMPTY coverage; zero-candidate snapshots remain valid coverage evidence; provider-dated candidates outside the MOVE window are excluded, while missing provider dates remain explicitly TIMESTAMP_UNAVAILABLE. No fresh GDELT call, persistence, scheduler, fake backfill, article scraping/tone/ranking, hypothesis scoring, causal attribution or trading semantics are introduced. |

| 4 Oct 2026 | ORDER-BOOK-001C Durable BTC Order-Book Geometry History Runtime | Adds compact forward-only canonical Evidence builders for Binance Spot BTCUSDT and Hyperliquid BTC perpetual order-book geometry. Existing qualified current snapshots are reduced to best bid/ask, spread, 5/10/25/50 bps depth/imbalance/coverage and provider lineage; raw depth levels are not persisted. Binance Spot remains retrieval-time sampled because the REST source has no provider timestamp; Hyperliquid uses provider-native book time. Authenticated historical-ingestion accepts `binance-book` and `hyperliquid-book` in FORWARD mode only. No cron activation, BACKFILL, production write proof, MOVE replay, liquidity deterioration scoring, causal attribution or UI is introduced. |

| 5 Oct 2026 | HOUSEKEEP-001A Daily Storage Capacity Monitoring Runtime | Implements an activation-ready Supabase `pg_cron` SQL contract without production mutation before owner merge. It reuses the existing RLS-enabled `public.p365_operational_metrics` table and records one idempotent `STORAGE_CAPACITY` row per UTC day: database bytes, Market Memory total/heap/index bytes and row counts, Evidence/Observation counts, `cron.job_run_details` bytes, Free-plan 500 MiB planning ceiling, estimated headroom and utilization percentage. Read-only baseline at 12:55 UTC measured 269,388,947 database bytes (51.38% of the planning ceiling), 231,768,064 Market Memory bytes, 25,116,672 cron-history bytes and 254,899,053 bytes estimated headroom. EXPLAIN validation passed without executing the INSERT. No deletion, retention, VACUUM, REINDEX, alert threshold, order-book sampling or scheduler activation is authorized by this branch. ORDER-BOOK-001C activation is gated until monitoring is merged/activated and initial storage growth is observed. |

| 5 Oct 2026 | HOUSEKEEP-001A.1 Storage Metric-Type Constraint Correction | Post-merge activation of HOUSEKEEP-001A created `p365-storage-daily` but the first manual snapshot was rejected by `p365_operational_metrics_metric_type_check` with PostgreSQL error 23514 because production allowed only `CACHE_INVALIDATION` and `PROVIDER_FETCH`. The scheduler was immediately unscheduled; verification confirmed no `p365-storage-daily` job remained and zero `STORAGE_CAPACITY`/daily-storage rows were written. Correction broadens the existing check constraint additively to permit `STORAGE_CAPACITY` while retaining both existing values, then keeps scheduler activation behind owner merge. No Market Memory mutation, retention, delete, VACUUM, REINDEX, order-book activation or provider change is introduced. |

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

- **None at the generic foundation layer.** FND-019 and FND-017 are closed / production-active. SUR-001, RPR-001 and TRN-001 are merged; the active product-layer dependency is **EVR-001 Integrated Event Response Evidence Bundle**.

**Allowed to remain bounded while product-layer work proceeds**

- **FND-008** broader release-time qualification: only exact-qualified event times may participate in exact-timing surprise/repricing workflows until expanded.
- **FND-010 remainder** Event/Evidence structured provenance: add when the consuming lifecycle needs stronger traceability.
- **FND-012** Yahoo input type naming/shape debt.
- **FND-013** MOVE coverage gap.
- **FND-015** broader test governance.
- **FND-016** presentation-language/status debt.

**Demand-driven MVP completion**

- **FND-021** is not a mandate to maximize provider breadth before building the intelligence chain. Add Macro/Crypto/Gold observations only when a defined Expectation, Pricing, Snapshot, Repricing, or Transmission question requires them and source qualification is adequate.

### Post-exit rule

Do not reopen generic foundation work merely because a theoretical improvement exists. A new foundation correction after this gate requires one of:

1. a reproduced correctness defect in production;
2. a security/reliability defect;
3. a concrete downstream contract that cannot be implemented safely without it.

Otherwise continue the product dependency chain:

```text
Verified canonical facts + Event identity
  ↓
Verified Expectation + Pricing baselines
  ↓
Verified natural PRE/T+5/T+15/T+30/T+60 Snapshots
  ↓
SUR-001 Factual Event Surprise
  ↓
RPR-001 Event Repricing
  ↓
TRN-001 Cross-Asset Transmission
  ↓
EVR-001 Integrated Event Response Evidence
  ↓
Demand-driven Macro + Crypto + Gold evidence completion
  ↓
Derived State / Risk / Regime
  ↓
Intelligence / Briefing
```

## Active remediation sequence

```text
1. Documentation consolidation / SSOT                          ← PR #36 / CLOSED
2. FND-004 Context taxonomy repair                             ← CLOSED
3. FND-001 Historical Observation repository contract          ← PR #37 / CLOSED
4. Durable history query adapter                               ← PR #39 / production E2E verified
5. Financial Market Ontology & Data Foundation v0.1            ← PR #42 / CLOSED
6. Additive semantic-dimensions compatibility                  ← CLOSED
7. FND-003A selective fresh Observation worker                 ← PR #45 / production-active
8. FND-003B independent US/China/Japan Event ingestion         ← PR #46 / production-active
9. FND-003C production cadence                                 ← Supabase pg_cron sole automatic scheduler
10. FND-002 + FND-002Q Factual Baseline                        ← FULL PASS / production E2E verified
11. FND-018A Observation identity/revision lineage              ← FULL PASS / production-active
12. FND-010A Structured Observation provenance                 ← production-active at Observation boundary
13. FND-011A/B freshness semantics                             ← production-active
14. FND-009 Manual cache invalidation                          ← CLOSED / production-active
15. FND-017 Next.js dependency security                        ← CLOSED / production-active
16. Foundation Exit Gate                                       ← PASS
17. FND-019 Event identity/reconciliation                       ← CLOSED / production-active
18. EXP-001 Point-in-Time Expectation Baseline                  ← FULL PASS / natural E2E verified
19. PRC-001 Point-in-Time Pricing Baseline                      ← natural E2E verified for BTC/ETH/DXY/Gold
20. SNP-001 Immutable Market Snapshot                           ← FULL PASS / natural E2E verified
21. EVW-001 Qualified Event Window Policy                       ← FULL PASS / natural E2E verified
22. CMP-001 Point-in-Time Snapshot Comparison                   ← deployed; natural compatible inputs verified
22A. CAP-001 Runtime Snapshot Capture                           ← natural E2E PASS
22A.1 CAP-001A Event-history filter correction                 ← CLOSED / production-active
22A.2 CAP-001B remaining history-filter correction             ← CLOSED / production-active
22A.3 CAP-001C append-only Snapshot supersession               ← CLOSED / production-active
22A.4 CAP-001D targeted historical Snapshot repair             ← PR #71 / production READY
22B. RPR-001 Event Repricing Contract                           ← CLOSED / PR #74 / production READY
22C. TRN-001 Cross-Asset Transmission                          ← CLOSED / PR #75 / `7a8a3bc60467b1a59a15a48496115adc806b5a51`
22D. SUR-001 Point-in-Time Factual Event Surprise               ← CLOSED / PR #76 / `9613893e697552cdcaa7015a551ed0867e1f1ef1`
22E. EVR-001 Integrated Event Response Evidence                  ← CLOSED / PR #77
22F. REL-001 Historical Relationship Evidence                    ← CLOSED / PR #78
22G. HIST-001A Point-in-Time Historical Baseline Contract        ← CLOSED / PR #130
22H. HIST-001B Repository-Backed Historical Baseline Runtime     ← CLOSED / PR #131
22I. HIST-001C Event-Window Historical Move Context               ← CLOSED / PR #132
22J. HIST-001D Intraday Historical Baseline Calibration          ← CLOSED / PR #133
22K. HIST-001E Event-Response Historical Evidence Integration    ← terminal HIST checkpoint
23. MOVE-001A Continuous Market Move Detection Contract          ← CLOSED / PR #151
24. MOVE-001B Continuous-Horizon & Materiality Calibration       ← CLOSED / PR #153
25. MOVE-001C Read-Only Continuous Move Detector Runtime         ← CLOSED / PR #154
26. MOVE-002A Move-Centered Evidence Investigation Contract       ← CLOSED / PR #155
27. CRYPTO-STRUCT-001A BTC Derivatives Provider Qualification    ← CLOSED / PR #156
28. CRYPTO-STRUCT-001B Coinalyze Free Live Qualification          ← TECHNICAL PASS / live proof complete; durable-use governance gate remains
29. CRYPTO-STRUCT-001C Bounded Factual Runtime                     ← blocked on Coinalyze durable-use clarification
29A. SPOT-FLOW-001A BTC Spot Flow Read-Only Runtime                ← BINANCE LIVE PASS / Bybit Vercel-egress unavailable
29A1. SPOT-FLOW-001B BTC Spot Flow Durable History Runtime          ← IMPLEMENTED; FORWARD Evidence snapshots
29A2. SPOT-FLOW-001C BTC Spot Flow Production Activation             ← PRODUCTION ACTIVE on existing p365-market-fast; natural cron + idempotency + point-in-time readback proven
29B. ORDER-BOOK-001A BTC Spot Order-Book Current Snapshot Runtime   ← BINANCE LIVE PASS / historical move-window coverage missing
29C. ORDER-BOOK-001B BTC Perp Order-Book Current Snapshot Runtime   ← HYPERLIQUID LIVE PASS / Binance Futures Vercel-egress unavailable
29C1. ORDER-BOOK-001C Durable BTC Order-Book Geometry History Runtime ← IMPLEMENTED; compact FORWARD Evidence runtime / production activation pending
29D. NEWS-001B Unscheduled Catalyst Current Feed Runtime             ← GDELT GAL CURRENT-15M LIVE PASS
29D1. NEWS-001C Durable GAL Snapshot History Runtime                ← IMPLEMENTED; FORWARD NEWS Evidence history + replay repository
29D2. NEWS-001D Durable GAL Production Activation                  ← PRODUCTION ACTIVE on existing p365-market-fast; idempotency + natural cron + point-in-time readback proven
29D3. NEWS-002A Catalyst Wire Source-Role Presentation             ← IMPLEMENTED; existing CoinDesk/Alpha Vantage + durable GDELT only; no new provider/write/scoring
29D4. NEWS-002A.1 GDELT Gold candidate hardening                  ← CORRECTION IMPLEMENTED; reproduced XAU URL collision / owner merge pending
29E. ASIA-MACRO-001A Asia FX Transmission Runtime                    ← USDJPY/USDCNH technical live pass; weekend temporal fitness fail-closed
29F. ASIA-MACRO-001B Asia FX Production Activation                  ← existing p365-market-fast expanded; durable FORWARD rows + natural recurring run proven
30. MOVE-002B Read-Only Move Evidence Bundle Runtime              ← IMPLEMENTED; repository-only point-in-time bundle
30A. MOVE-002C Durable BTC Spot-Flow Replay                          ← IMPLEMENTED; HistoricalEvidence point-in-time consumption / no causal scoring
30B. MOVE-002D Durable GDELT Catalyst Replay                          ← IMPLEMENTED; BTC/Gold NEWS Evidence coverage + candidate replay / no causal scoring
31. MACRO-RATES-001A Intraday Rates/Pricing Source Qualification ← source-qualified; nominal runtime provider open; real-yield intraday unresolved
31A. MACRO-RATES-001B Rates Access & Proxy Qualification            ← OWNER FREE-ONLY; paid paths rejected; ZT+TN preferred only as risk-bounded future free proxy; no runtime approved
32. Derived State → Risk/Regime → Intelligence → Briefing        ← remains deferred
```

One logical remediation = one PR = one verification checkpoint. This sequence may only change when a verified dependency requires it; changes must be recorded here.

## Deferred operational backlog — Market Memory storage

The 4 Oct 2026 read-only storage audit is recorded in:

`docs/P365-MARKET-MEMORY-STORAGE-GROWTH-AUDIT-2026-10-04.md`

It records the verified Free-plan storage boundary, current database/Market Memory/cron
footprint, the legacy Observation-Evidence duplication defect already fixed by PR #110,
current post-fix idempotency, index-usage findings, runway scenarios, and the deferred
housekeeping sequence.

HOUSEKEEP-001A is merged, but its first post-merge activation proof exposed a blocking
schema-contract mismatch: `p365_operational_metrics_metric_type_check` permits only
`CACHE_INVALIDATION` and `PROVIDER_FETCH`, so `STORAGE_CAPACITY` was rejected with PostgreSQL
error `23514`. The newly created `p365-storage-daily` job was immediately unscheduled and no
monitoring row was written. HOUSEKEEP-001A.1 broadens that existing check constraint to include
`STORAGE_CAPACITY`; production activation remains paused until the correction is owner-merged.
The corrected SQL contract remains
`docs/P365-HOUSEKEEP-001A-STORAGE-MONITORING.sql`.

The 5 Oct 2026 read-only baseline is:

- database: 269,388,947 bytes (~257 MiB);
- Market Memory: 231,768,064 bytes (~221 MiB);
- `cron.job_run_details`: 25,116,672 bytes (~24 MiB);
- Free-plan database utilization: 51.38%;
- estimated remaining headroom: 254,899,053 bytes (~243 MiB).

The last 24-hour sample added 5,596 Market Memory rows and roughly 5.4 MiB of raw payload
before tuple/index overhead. Because ORDER-BOOK-001C would add two recurring snapshot lanes,
its production activation is now gated behind HOUSEKEEP-001A monitoring activation and an
initial measured growth sample.

Canonical Market Memory must not receive automatic age-based deletion. The operational order is
storage monitoring → operational `cron.job_run_details` retention decision → measured
order-book capacity decision → index review → owner capacity decision → formal hot/cold
archival design only if needed.

## 22. Final audit conclusion

P365 should **not** restart its architecture and should **not** add a reasoning engine yet.

The correct strategy is to preserve the pipeline already present while broadening its semantics deliberately:

> **freeze the broad ontology for future compatibility, keep MVP delivery constrained to Macro + Crypto + Gold, add semantic dimensions without rewriting history, then complete those three scopes before broader first-class market expansion.**

Once those gates pass, the existing factual data becomes a defensible base for the retail trader/investor decision-support workflow defined by P365.
