# P365 Financial Market Ontology & Data Foundation v0.1

**Status:** Proposed normative foundation contract  
**Product ontology scope:** Global multi-asset financial-market information model  
**MVP implementation scope:** **Macro + Crypto + Gold**  
**Implementation effect:** Documentation-only. This contract does **not** authorize provider expansion, runtime migration, State/Regime activation, or trading logic.

## 1. Purpose

P365 is a **Financial Market Intelligence System**. Its long-term product ontology is broader than the MVP, but the **MVP implementation boundary is intentionally limited to Macro + Crypto + Gold**.

The canonical foundation must represent the mechanisms a self-directed trader/investor uses to understand the market:

```text
Economic Reality
Policy
Expectations / Pricing
Liquidity / Funding
Fiscal / Sovereign Funding
Financial Markets
Derivatives / Volatility
Positioning / Flows
Market Internals
Events / Evidence
        ↓
Market Memory
        ↓
Baselines / Snapshot
        ↓
Change / Surprise / Repricing
        ↓
Transmission
        ↓
Confirmation / Contradiction / Divergence
        ↓
Derived State
        ↓
Intelligence
        ↓
Briefing
```

Current implementation domains are an implementation subset, not the product boundary.

### 1.1 MVP boundary

The ontology and the MVP are intentionally different layers:

```text
LONG-TERM PRODUCT ONTOLOGY
Global multi-asset financial market
        ↓
MVP PRODUCT / IMPLEMENTATION SCOPE
Macro + Crypto + Gold
```

For MVP, P365 should complete a defensible reasoning chain inside those three scopes before expanding first-class coverage to Equity, broad Credit, broad Commodities, or other asset classes.

**Macro** is the explanatory environment for the MVP and may include:

- economic reality: growth, inflation, labor and other material macro releases;
- material central-bank policy and projections;
- liquidity/funding: balance sheets, reserves, money supply, TGA/RRP, money-market funding;
- rates and real yields;
- USD / relevant FX context;
- inflation expectations/pricing;
- economic/central-bank events, consensus, actual, revisions and policy pricing.

**Crypto** is a first-class MVP market domain and may include:

- BTC/ETH spot and market structure;
- total market cap / volume / dominance;
- stablecoin liquidity;
- spot-ETF flows where qualified;
- futures/open-interest/funding/basis where qualified;
- positioning/flow data only when its identity, timing and methodology are explicit.

**Gold** is a first-class MVP market domain even though the long-term ontology classifies it under Commodity. MVP Gold may include:

- spot/futures pricing;
- historical baselines;
- relevant ETF/positioning data where qualified;
- transmission against macro drivers such as real yields, USD, rates, liquidity and inflation pricing.

Existing non-MVP cross-asset observations such as S&P 500, Nasdaq, Russell 2000, VIX, WTI and IG/HY spreads may remain as **supporting evidence** if already present and useful for context/transmission. They are not authorization to expand Equity, Volatility, Oil, or Credit into first-class MVP product modules.

### 1.2 Explicitly outside MVP first-class scope

Unless required as supporting evidence for Macro/Crypto/Gold reasoning, defer first-class implementation of:

- full Equity market intelligence;
- equity breadth / sector / factor / earnings systems;
- broad Credit intelligence;
- broad Commodity coverage other than Gold;
- full multi-asset derivatives/options platform;
- EM/cross-border asset-class expansion;
- portfolio construction, execution, signals or trade recommendations.

The broader ontology remains deliberate future compatibility, not an MVP delivery mandate.

The normative evidence requirements for the MVP traded markets are defined in `P365-MVP-BTC-XAU-EVIDENCE-MAP-v0.1.md`. That contract owns the shared Macro driver map, BTC-specific flow/derivatives evidence, Gold-specific flow/positioning evidence, relationship methodology, and event-window evidence requirements.

### 1.3 MVP operating thesis

The MVP is intentionally a **vertical slice**, not a broad terminal.

```text
MACRO
explanatory environment
        ↓
CRYPTO + GOLD
first-class traded markets
        ↓
MARKET MEMORY
        ↓
BASELINE / EXPECTATION / PRICING
        ↓
SNAPSHOT / REPRICING
        ↓
TRANSMISSION
        ↓
CONFIRMATION / CONTRADICTION
        ↓
INTELLIGENCE
```

Macro is not a third traded asset class in the MVP. Its primary role is to explain the environment and catalysts that affect Crypto and Gold.

Scope expansion is blocked until this vertical slice can reliably answer:

- what changed;
- relative to what baseline;
- what was expected;
- what was priced;
- how the market repriced;
- how Crypto and Gold responded;
- what evidence confirms or contradicts the move;
- what is historically unusual;
- what should be monitored next.

Adding another first-class asset class before this chain is reliable would increase horizontal breadth without proving the core intelligence architecture.

## 2. Core invariants

1. Raw observations must remain factual.
2. Market pricing must remain distinct from economic reality and survey/forecast expectations.
3. Deterministic derived metrics must be distinguishable from model estimates.
4. Model estimates must retain methodology, version, inputs, and provenance.
5. Positioning, flow, inventory, pricing, expectation, and event data must not be collapsed into a generic Observation meaning.
6. Derived State such as risk appetite, liquidity state, funding stress, or regime must never be ingested as if it were a provider fact.
7. Correlation is not causation and does not by itself establish transmission.
8. Historical point-in-time reconstruction must preserve what P365 could have known at that time.
9. Missing data remains missing; no hidden proxy may silently fill a required dimension.
10. Intelligence must remain traceable to canonical evidence, baselines, methodology, and time.

## 3. Multi-axis ontology

P365 must not rely on one flat domain enum or indicator names to carry all semantics.

A canonical data item should be classifiable across the following independent axes.

### 3.1 Market domain

Target domains:

- `ECONOMY`
- `POLICY`
- `LIQUIDITY_FUNDING`
- `FISCAL_SOVEREIGN`
- `RATES`
- `FX`
- `EQUITY`
- `CREDIT`
- `COMMODITY`
- `VOLATILITY`
- `CRYPTO`
- `DERIVATIVES`

These domains describe **what market mechanism the information belongs to**.

### 3.2 Information class

Target classes:

- `OBSERVATION` — source-reported factual measurement
- `EXPECTATION` — forecast, consensus, official projection, or stated expectation
- `PRICING` — market price, yield, spread, implied path, or other market-implied value
- `POSITIONING` — participant holdings/exposure/commitments
- `FLOW` — movement of capital, subscriptions/redemptions, transfers, or funding flows
- `INVENTORY` — physical or financial stock available for comparison through time
- `EVENT` — scheduled/occurred market-relevant event
- `EVIDENCE` — source material that supports a canonical fact/event
- `DERIVED_METRIC` — deterministic transform of canonical inputs
- `MODEL_ESTIMATE` — model-dependent estimate not directly observed
- `DERIVED_STATE` — higher-order interpretation requiring explicit methodology and evidence

### 3.3 Jurisdiction / geography

Examples:

- `US`
- `EURO_AREA`
- `JAPAN`
- `CHINA`
- `UK`
- `CANADA`
- `AUSTRALIA`
- country-level EM identifiers
- `GLOBAL`

Jurisdiction must be explicit where economically meaningful. Provider identity or a series name must not be the only way to infer geography.

### 3.4 Instrument

Examples:

- cash / deposit
- index
- sovereign bond
- corporate bond
- FX pair
- future
- option
- swap / OIS
- ETF
- fund
- commodity contract
- crypto spot
- crypto derivative

### 3.5 Participant

Where relevant:

- central bank / official sector
- bank
- dealer
- asset manager
- leveraged fund
- pension / insurer
- ETF / mutual fund
- corporate
- household
- non-bank financial institution
- non-reportable / other

### 3.6 Tenor and horizon

Tenor examples:

- overnight
- 1M / 3M / 6M
- 1Y / 2Y / 5Y / 10Y / 30Y

Reasoning horizons:

- intraday
- session
- daily
- weekly
- cyclical
- structural

Tenor and reasoning horizon are not interchangeable.

### 3.7 Methodology and provenance

Every canonical or derived item must be able to retain, where relevant:

- provider/source identity
- source-native series/instrument/event identity
- endpoint/document identity
- observed/released/published time
- retrieval/capture time
- unit and scale
- revision/vintage identity
- calculation methodology
- methodology version
- model version
- input references
- evidence references
- data quality / source health

## 4. Canonical distinction: facts, calculations, models, and states

Examples:

```text
US 10Y yield              → RATES / PRICING
10Y-2Y spread             → RATES / DERIVED_METRIC
10Y term premium estimate → RATES / MODEL_ESTIMATE

BTC spot price            → CRYPTO / PRICING
BTC ETF daily net flow    → CRYPTO / FLOW
CME BTC futures OI        → CRYPTO / POSITIONING

WTI price                 → COMMODITY / PRICING
Crude inventory           → COMMODITY / INVENTORY

VIX                       → VOLATILITY / PRICING

CPI actual                → ECONOMY / OBSERVATION
CPI consensus             → ECONOMY / EXPECTATION

FOMC Dot Plot             → POLICY / EXPECTATION
OIS-implied policy path   → RATES / PRICING

Risk Appetite State       → DERIVED_STATE
```

The last item must not be stored or presented as equivalent to a raw provider observation.

## 5. Canonical financial-market information universe

### A. Economic reality

- growth
- inflation
- labor
- consumption
- production
- housing
- trade
- money
- credit
- corporate fundamentals

### B. Policy and central banks

Material central-bank coverage should be able to include:

- Federal Reserve
- ECB
- BoJ
- PBoC
- BoE
- other central banks when material to the reasoning scope

Information may include:

- policy rates
- administered rates
- balance sheets
- reserves
- QE/QT
- liquidity facilities
- official guidance
- minutes/statements
- economic projections
- SEP / Dot Plot where applicable

No single central-bank schema should be forced on institutions whose policy frameworks differ.

### C. Expectations and market pricing

- macro consensus / forecast
- forecast revisions
- official projections
- OIS / futures-implied policy expectations
- nominal yield curve
- real yield curve
- inflation compensation / breakevens
- inflation swaps
- earnings estimates
- earnings revisions
- other market-implied expectations

Economic reality, expectations, and pricing are separate concepts.

### D. Liquidity and funding

- central-bank liquidity
- bank reserves
- money supply
- bank credit
- secured/unsecured money markets
- repo
- SOFR / EFFR / related funding rates
- collateral conditions
- FX swaps
- cross-currency basis
- foreign-currency funding
- central-bank swap lines
- global bank/non-bank credit where qualified

`Global liquidity` must not be treated as one universal formula. Any aggregate or proxy requires an explicit methodology.

### E. Fiscal and sovereign funding

- government cash balances
- borrowing requirements
- Treasury/sovereign issuance
- auction schedule/results
- bill/coupon composition
- maturity structure
- buybacks
- primary-dealer positions/financing where qualified

TGA is one component, not the complete fiscal-liquidity mechanism.

### F. Financial markets

#### Rates
- sovereign yields
- real yields
- curves / forwards
- spreads

#### FX
- broad USD indices
- major pairs
- relevant EM FX
- forwards
- funding/basis measures

#### Equity
- major indices
- breadth/participation
- sectors/industries
- style/factors
- equal-weight vs cap-weight where relevant
- earnings actual/expectation/revision

#### Credit
- IG/HY spreads
- rating buckets
- bank lending standards/demand
- default/refinancing conditions
- issuance where qualified

#### Commodity
- spot/futures price
- futures curve
- calendar spreads
- inventory
- production/consumption
- imports/exports
- physical-flow evidence

#### Crypto
- spot prices
- market cap
- volume
- dominance
- stablecoin supply/liquidity
- ETF flows
- futures/options
- open interest
- funding
- basis
- liquidations
- qualified on-chain structural data

### G. Derivatives and volatility

- futures
- options
- open interest
- basis
- implied volatility
- realized volatility
- skew
- term structure
- vol-of-vol
- equity volatility
- rates volatility
- commodity volatility
- crypto volatility

Methodology-dependent dealer/gamma measures are derived/model outputs and require explicit provenance.

### H. Positioning and flows

- CFTC COT
- futures positioning
- options positioning
- ETF flows
- fund flows
- institutional holdings
- cross-border flows
- dealer positioning where qualified
- crypto structural flows

A generic `net position` or `capital flow` field is insufficient without participant, instrument, time, and methodology.

### I. Market internals

- equity breadth
- sector leadership
- factor/style rotation
- concentration
- dispersion
- correlation
- credit internals
- commodity curve state
- inventory context
- crypto market structure

### J. Events and evidence

- economic releases
- central-bank decisions/speeches/minutes
- Treasury/refunding/auction events
- earnings
- geopolitical events
- official statements
- news/evidence

### K. Market Memory

Market Memory must retain point-in-time canonical history for the information classes that require temporal reasoning:

- observations
- expectations
- pricing
- positioning
- flows
- inventories
- revisions
- event results
- snapshots
- model methodology/version references where applicable

History is the prerequisite for valid baseline, abnormality, persistence, repricing, and transmission reasoning.

## 6. Current repository → target ontology mapping

The current repository remains valid as an implementation subset. The target ontology does not retroactively change current runtime semantics until a dedicated compatibility/migration checkpoint is approved.

### 6.1 FRED registry

| Current series | Target domain | Target class | Note |
|---|---|---|---|
| FEDFUNDS | POLICY | OBSERVATION | policy rate |
| EFFR | LIQUIDITY_FUNDING | PRICING | overnight unsecured policy implementation |
| WALCL | POLICY | OBSERVATION | Fed balance sheet |
| WRESBAL | LIQUIDITY_FUNDING | OBSERVATION | reserve balances |
| M2SL | LIQUIDITY_FUNDING | OBSERVATION | US money supply |
| WTREGEN | FISCAL_SOVEREIGN | OBSERVATION | US Treasury cash balance |
| SOFR | LIQUIDITY_FUNDING | PRICING | secured overnight funding |
| IORB | POLICY | OBSERVATION | administered policy rate |
| RRPONTSYD | LIQUIDITY_FUNDING | OBSERVATION | ON RRP usage |
| CPIAUCSL / CPILFESL | ECONOMY | OBSERVATION | inflation |
| PCEPI / PCEPILFE | ECONOMY | OBSERVATION | inflation |
| UNRATE / PAYEMS | ECONOMY | OBSERVATION | labor |
| ICSA / CCSA | ECONOMY | OBSERVATION | labor |
| JTSJOL / JTSQUR | ECONOMY | OBSERVATION | labor |
| SAHMREALTIME | ECONOMY | DERIVED_METRIC | source-published derived indicator |
| DGS2 / DGS10 | RATES | PRICING | Treasury yields |
| DFII10 | RATES | PRICING | real yield |
| T10YIE | RATES | PRICING | inflation compensation, not pure expectation |
| T10Y2Y | RATES | DERIVED_METRIC | curve spread |
| BAMLC0A0CM | CREDIT | PRICING | IG OAS |
| BAMLH0A0HYM2 | CREDIT | PRICING | HY OAS |
| DTWEXBGS | FX | PRICING | broad USD index |
| GDPC1 | ECONOMY | OBSERVATION | real GDP |
| VIXCLS | VOLATILITY | PRICING | equity implied volatility index |
| SP500 / NASDAQCOM | EQUITY | PRICING | equity index levels |
| DCOILWTICO | COMMODITY | PRICING | WTI |

### 6.2 Yahoo Finance trial market data

| Current metric | Target domain | Target class |
|---|---|---|
| `gold.futures.usd` | COMMODITY | PRICING |
| `russell2000.index.usd` | EQUITY | PRICING |
| `dxy.index.usd` | FX | PRICING |

### 6.3 CoinGecko current data

| Current metric family | Target domain | Target class |
|---|---|---|
| BTC/ETH spot | CRYPTO | PRICING |
| BTC/ETH market cap | CRYPTO | OBSERVATION |
| total crypto market cap | CRYPTO | OBSERVATION |
| total 24h volume | CRYPTO | OBSERVATION |
| BTC/ETH dominance | CRYPTO | DERIVED_METRIC |

### 6.4 Events and expectations

- Forex Factory calendar → EVENT + EVIDENCE.
- Federal Reserve FOMC calendar → POLICY-related EVENT + EVIDENCE.
- Biquote actual result → OBSERVATION attached to an EVENT lifecycle.
- Biquote forecast/expected field → EXPECTATION.
- Biquote previous/revision fields → event-result history/revision semantics.

The existing `EconomicEventResult` contract is useful because it already preserves actual, expected, expected type, prior/revised prior, release, retrieval, source, and evidence.

## 7. Current coverage gap matrix

Legend:

- **EXISTING** — implemented canonical data is already useful
- **PARTIAL** — useful coverage exists but the mechanism is incomplete
- **MISSING** — no current canonical implementation
- **MISCLASSIFIED** — data exists but the current coarse domain does not represent the target ontology
- **DEFERRED** — intentionally blocked until lower-level gates exist

| Area | Status |
|---|---|
| US economic reality | PARTIAL |
| Fed policy | PARTIAL |
| ECB / BoJ / PBoC / BoE policy | MISSING |
| Dot Plot / SEP | MISSING |
| US M2 / reserves / Fed BS / TGA / RRP | EXISTING / MISCLASSIFIED |
| SOFR / EFFR / IORB | EXISTING / MISCLASSIFIED |
| Global liquidity | MISSING |
| Cross-currency basis / FX funding | MISSING |
| Treasury issuance / auctions / buybacks / dealer system | MISSING except TGA |
| US rates | PARTIAL |
| Inflation pricing | PARTIAL: real yield + 10Y breakeven |
| OIS / policy futures pricing | MISSING |
| Term premium | MISSING |
| FX | PARTIAL: broad USD + DXY |
| Equity headline indices | PARTIAL |
| Equity breadth / sectors / factors | MISSING |
| Earnings expectations/revisions | MISSING |
| Credit | PARTIAL: IG/HY OAS |
| Commodity | PARTIAL: WTI + Gold |
| Commodity curves/inventories | MISSING |
| Volatility | PARTIAL: VIX |
| MOVE / rates volatility | MISSING |
| Crypto spot/market-cap/volume/dominance | PARTIAL |
| Stablecoin liquidity | MISSING |
| Crypto ETF flows | MISSING |
| Crypto derivatives | MISSING |
| COT / positioning | MISSING |
| ETF / fund flows | MISSING |
| Institutional holdings | MISSING |
| Cross-border / EM flows | MISSING |
| Events / evidence | PARTIAL |
| Durable Observation history | PARTIAL: adapter implemented; continuity pending |
| Historical expectation/pricing/flow history | MISSING |
| Factual baseline | PARTIAL |
| Expectation baseline | MISSING |
| Pricing baseline | MISSING |
| Market Snapshot | MISSING |
| Repricing / transmission | MISSING |
| Risk Appetite / Regime / Intelligence | DEFERRED |

## 8. Priority model

Priority describes implementation dependency, **not market importance**.

### CORE

Required for the first defensible **MVP Macro + Crypto + Gold** intelligence chain:

- canonical historical continuity
- factual baseline from durable history
- explicit ontology-compatible semantic identity
- macro economic reality
- material central-bank policy/projections
- liquidity/funding and money supply
- rates / real yields / inflation pricing
- USD / relevant FX context
- economic/central-bank events and expectations
- market-implied policy/rates pricing
- crypto spot / market structure
- qualified crypto ETF / stablecoin / derivatives data when required by the approved MVP reasoning questions
- gold pricing and its macro transmission context
- immutable Market Snapshot

### SECONDARY

Materially improves explanation but is not required for the first valid chain:

- Treasury issuance/auction mechanics when needed for macro liquidity reasoning
- COT limited to approved Macro/Crypto/Gold instruments
- ETF flows limited to approved Crypto/Gold reasoning
- stablecoin liquidity
- crypto derivatives
- gold positioning/ETF-flow enrichment
- selected credit/volatility/cross-asset evidence needed to test Macro/Crypto/Gold transmission

### ENRICHMENT

Requires stronger provider/methodology qualification or is more specialized:

- term-premium decomposition
- cross-currency basis
- advanced crypto/gold options or dealer positioning
- institutional holdings relevant to Crypto/Gold
- attributed on-chain exchange flows
- advanced global-liquidity decomposition
- advanced market microstructure

### DEFERRED

Do not activate before factual, historical, baseline, and snapshot gates:

- Risk Appetite State
- Liquidity State
- Funding Stress State
- Financial Conditions composite
- Market Regime
- automated transmission conclusion
- Intelligence synthesis
- Market Briefing generation
- any trading signal, position sizing, execution, or portfolio instruction

## 9. Backward compatibility and migration rule

This document does **not** authorize replacing the current `ObservationDomain` enum or rewriting stored Market Memory.

Migration must be additive and isolated.

Required future compatibility rules:

1. Preserve existing canonical records and append-only Market Memory.
2. Do not rewrite historical rows to fit the new ontology.
3. Treat current `MARKET / MACRO / ASSET / OTHER` as legacy compatibility classification until an approved additive semantic contract exists.
4. Introduce new semantic dimensions in a way that can coexist with current IDs/history.
5. Provider identity must remain provenance, not logical market-series identity.
6. Historical logical identity must eventually use stable market semantics rather than provider-specific or coarse legacy domain assumptions.
7. A runtime migration must include mapping tests for every current FRED/Yahoo/CoinGecko family before any stored-history compatibility change.
8. Do not combine ontology migration with provider expansion in the same PR.

## 10. Revised foundation dependency sequence

```text
A. Financial Market Ontology & Data Foundation documentation freeze
   ↓
B. Additive canonical semantic-dimensions compatibility contract
   ↓
C. FND-003 independent ingestion / backfill ownership
   ↓
D. FND-002 repository-backed factual baseline
   ↓
E. Temporal / provenance / freshness + ID lineage hardening
   ↓
F. FND-009 cache invalidation + remaining current-foundation defects
   ↓
G. Complete approved MVP market universe: Macro + Crypto + Gold, in isolated provider/domain checkpoints
   ↓
H. Expectation baseline lifecycle
   ↓
I. Market-implied Pricing baseline
   ↓
J. Immutable Market Snapshot
   ↓
K. Event-window repricing / transmission comparison contract
   ↓
L. Secondary positioning / flow enrichment inside Macro + Crypto + Gold
   ↓
M. Only after evidence gates: Derived State → Intelligence → Briefing
```

The existing architecture is retained. The ontology stays broad for future compatibility, while implementation remains deliberately bounded to **Macro + Crypto + Gold for MVP** until the MVP reasoning chain is complete.

## 11. Acceptance criteria for ontology implementation

A future runtime ontology checkpoint passes only if:

- the change is additive or has an explicit non-destructive migration plan;
- existing canonical facts remain queryable;
- Market Memory history remains reconstructable;
- current provider families have deterministic mapping coverage;
- domain and information class are independently represented;
- jurisdiction is explicit where material;
- pricing is distinguishable from expectation and factual measurement;
- deterministic derived metrics are distinguishable from model estimates;
- Derived State cannot enter the factual ingestion path;
- provider-specific response shapes remain outside the domain layer;
- no new provider is added in the ontology-migration PR;
- focused tests prove backward compatibility.

## 12. Non-goals of v0.1

This contract does not:

- choose all future providers;
- require every domain to be implemented immediately;
- define a universal global-liquidity score;
- define risk-on/risk-off thresholds;
- define regime rules;
- define causal transmission from correlation alone;
- define a universal event window;
- authorize AI-generated market conclusions;
- authorize trading advice or execution.

The immediate purpose is narrower:

> **Give P365 one scalable semantic map for the financial market while keeping MVP delivery constrained to Macro + Crypto + Gold.**
