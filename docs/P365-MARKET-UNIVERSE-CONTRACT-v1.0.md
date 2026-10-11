# P365 — Multi-Asset Market Universe Contract v1.0

**Decision:** 11 Oktober 2026 · PRODUCT-REBASELINE-001 / Issue #360  
**Status:** Target product coverage; NOT a runtime provider/ingestion authorization  
**Canonical reference:** User & Decision-Support Contract; Financial Market Ontology v0.1

## 1. What “multi-asset” means

P365 must present a coherent **Financial Market Overview** spanning major market families, and support market-specific deep analysis as data becomes qualified. A market may have a broad factual snapshot long before it qualifies for independent State/Regime reasoning.

Three independent dimensions must never be collapsed:
1. **Product scope:** what users should eventually analyze.
2. **Data coverage:** what sources, series and historical windows have actually been verified at as-of.
3. **Feature capability:** whether factual tape, comparable change, structure/state, regime or decision-support is qualified.

No label in this document asserts a live provider, valid license, complete history, or healthy production feed.

## 2. Target market families and initial representative universe

| Family | Representative target instruments/series | First market question | Qualification notes |
| --- | --- | --- | --- |
| **FX / USD** | ICE DXY; EUR/USD; USD/JPY; USD/CNH; broad USD indexes as distinct products | Apakah dolar menguat/melemah dan di pasangan mana? | DXY ≠ FRED trade-weighted USD; quote convention/session, fixings |
| **Rates & sovereign bonds** | U.S. 2Y / 10Y nominal and 10Y real yield; curve spread; future policy-rate products | Bagaimana level dan bentuk yield curve berubah? | Yield changes in bps; tenor/maturity and daily vs intraday separated |
| **Equities** | S&P 500, Nasdaq-100, Russell 2000; later sectors, equal-weight and breadth | Apakah indeks dan partisipasi pasar searah? | Index vs ETF vs future distinct; exchange sessions, corporate actions |
| **Commodities** | XAU/USD spot; COMEX GC futures; silver; WTI/Brent oil; copper | Apakah tren komoditas seragam atau divergen? | Spot/futures distinct; contract, expiry/roll, commodity-specific drivers |
| **Crypto** | BTC, ETH spot; qualified majors; futures universe listed on Binance eligible contracts | Bagaimana struktur spot, futures dan breadth crypto? | Venue/contract type, expiry, funding, spot vs derivative distinctions |
| **Credit / funding** | U.S. IG/HY OAS, benchmark credit spreads, SOFR/repo/funding measures | Apakah funding dan credit stress meningkat? | Low cadence and released lag; credit context ≠ intraday confirmation |
| **Volatility & derivatives** | VIX/term structure, realized vol, qualified crypto OI/funding/basis, gold COT | Apakah volatilitas dan posisi mendukung movement? | Implied vs realized; derivative venue/participant and data license |
| **Macro environmental context** | Growth, inflation, labor, policy/central bank, money, balance-sheet, liquidity, fiscal | Kondisi ekonomi/kebijakan apa yang membatasi atau mendukung pasar? | Konteks state/regime saja; vintage, lag, release date, methodology |

The list is a **representative product registry seed**, not an exhaustive qualified instrument registry. Adding family targets is a product decision; enabling an instrument/provider remains a separate gated issue.

Crypto futures: candidate discovery may cover all **eligible currently listed Binance Futures instruments**, subject to active listing/market metadata, quote currency, contract kind, venue, entitlement, quota, rate limits, data quality and storage cost; “all listed” does **not** mean automatic historical 5-minute ingestion of all contracts.

Macro geographies should include United States, China, Japan and relevant other regions when justified by cross-market effects; geographic scope does not authorize collecting every economic release.

## 3. Coverage and readiness taxonomy

| Status | Meaning | Allowed UI claim |
| --- | --- | --- |
| TARGET | Named in product universe, no qualified source guarantee | “Cakupan direncanakan” |
| INVENTORIED | Existing provider/series found; identity, authorization or cadence may remain unresolved | “Sedang diverifikasi” |
| FACTUAL_QUALIFIED | Source, identity, time, quality and latest/history basis validated | Factual values with provenance, effective/available times |
| COMPARABLE_QUALIFIED | Qualified predecessor, window/session, unit and as-of align for a specific comparison | Deltas/cross-market comparisons **for qualified horizons only** |
| STATE_QUALIFIED | State methodology, history, thresholds and replay/calibration independently accepted | Horizon-specific derived Market State |
| REGIME_QUALIFIED | Transition/persistence, out-of-sample and stability accepted | Market Regime with uncertainty and methodology |

**OUTAGE/STALE/PARTIAL/UNKNOWN** are *operational/data quality states*, independent of the progression above. A previously qualified instrument can be temporarily unsuitable for comparison. No promotion is automatic from a data point or Vercel build.

For each active instrument record: canonical family; underlying/instrument type; native ticker/source identity; venue; quote/base currency; country/exchange; units and scale; session/holiday/roll rules; observed/released/retrieved times; freshness target vs verified actual latency; history availability; source entitlement; provider cost/quota; quality, source-health and gap status; supported horizons; corresponding issue and acceptance evidence.

## 4. First-class market activation gate

A market/instrument is first-class only when its owner-specific checkpoint proves:

1. **Identity:** no ticker ambiguity; spot/future/index/ETF, currency, venue, adjustments and units typed.
2. **Source:** provenance, stable source-native identity, permitted license/entitlement, quota and cost are documented. Free-first; no paid assumption.
3. **Time:** effective and availability chronology, market calendar/session, stale/closed classification and point-in-time cutoff are tested.
4. **History:** durable qualified samples at adequate horizon, revision/dedupe lineage and verified gaps; no hidden interpolation.
5. **Comparison:** predecessor and baseline qualifications for each displayed delta; non-comparable series never fused.
6. **User value:** concrete market question answered with qualified factual evidence in an existing or approved UI surface; no just-for-coverage card.
7. **Operational:** read-only dashboard, bounded latency/storage/retention design, no secret exposure, no duplicate cron.
8. **Review:** focused tests, base/head regression, owner-reviewed PR and post-merge production evidence.

**State and regime** require additional methodology, bias checks, calibration, hold-out replay and accuracy/stability assessment; passing factual activation is not permission to render derived regime labels.

## 5. Activation order: breadth first, depth by evidence

**Breadth baseline:** expose qualified factual coverage and explicit gaps across at least **FX, rates, equities, commodities, crypto, and credit/volatility** from existing sources where available. An unavailable family must show a gap, not invented values. A screen with six empty category headings **does not pass** the trader value test.

**Depth pilots:** build and validate multi-horizon state/structure first on BTC and Gold where history and market definitions can be verified; test the same state contract on at least one **non-BTC/Gold** market before treating it as general multi-asset reasoning. Further families follow their individual readiness gates.

**Macro layer:** a supporting cross-market backdrop. FRED daily/weekly/monthly or central-bank policy facts remain contextual at native cadence even when the traded market uses 5-minute data. No fabricated “intraday macro”.

**Market-family priority is not provider prioritization.** No automatic new API fetch, scheduler, schema, data migration, paid service, or entire futures-universe backfill is approved here.

## 6. Instrument- and horizon-level metadata rules

- Intraday comparisons require compatible sessions and actual observed endpoints; a weekend crypto return is not like-for-like with closed COMEX cash/futures session.
- Trading-day, contract rollover, adjustment method, sampling and lookback windows must be explicit.
- Daily rates, credit and macro facts are background for shorter horizon, not contemporary move evidence.
- Breadth denominators must identify eligible universe at each point in time, avoiding survivor bias from current exchange listings.
- USD, gold, and rates links are contextual unless synchronous statistics/transmission methodology is independently validated.
- Where requirements fail, **UNKNOWN / NOT_COMPARABLE / NOT_EVALUATED** is a valid product answer with a reason.

## 7. Relationship to existing P365 assets and governance

The 10 October Financial Market Overview #281 remains a reuse source for qualified factual read models, not authorization for new state/regime models. BTC/Gold evidence contracts remain operative for those instruments; Gold GC=F must not be relabeled spot pending approved #277 qualification. #271 relative strength, #276 Binance futures breadth and #319 pre-MOVE evidence are independent issue scopes. Recovery #283 governs platform safety and quality. #350 and #353 remain paused by owner.

A coverage matrix based on **live actual repo/runtime evidence** is a separate read-only readiness issue, not inferred from historical SSOT or this target list. Every future provider/first-class promotion must have its own issue, PR and closure gates.
