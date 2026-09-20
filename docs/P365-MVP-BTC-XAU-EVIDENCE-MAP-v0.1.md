# P365 MVP BTC + XAU Evidence & Relationship Map v0.1

**Status:** Proposed normative MVP evidence contract  
**Primary user:** Self-directed retail Crypto + Gold trader  
**MVP traded markets:** Bitcoin / Crypto + Gold  
**Explanatory layer:** Macro  
**Implementation effect:** Documentation-only. This contract does not authorize provider expansion, runtime reasoning, trading signals, or portfolio/execution logic.

## 1. Purpose

This document defines the minimum evidence universe P365 needs to explain material BTC and Gold moves without relying on static correlation assumptions.

The MVP must not encode simplistic rules such as:

```text
DXY down → BTC up
Real yield down → Gold up
Nasdaq up → BTC up
```

Relationships between macro variables, Bitcoin, and Gold are time-varying and can strengthen, weaken, invert, or disappear.

The system therefore needs a **relationship evidence layer**:

```text
DRIVER / CATALYST
        ↓
CANONICAL OBSERVATIONS
        ↓
HISTORICAL RELATIONSHIP
        ↓
CURRENT CHANGE
        ↓
BTC / GOLD RESPONSE
        ↓
CONFIRMATION / CONTRADICTION
        ↓
HISTORICAL CONTEXT
```

Correlation is evidence, not causation.

## 2. MVP reasoning objective

For any material BTC or Gold move, P365 should eventually be able to answer:

1. What changed in the macro environment?
2. What was the relevant factual, expectation, or pricing baseline?
3. Was there a scheduled catalyst?
4. Was there a factual surprise?
5. Did rates, real yields, USD, or liquidity/funding reprice?
6. How did BTC respond?
7. How did Gold respond?
8. Did market-specific flow, positioning, or structure confirm or contradict the move?
9. Is the current relationship historically typical or unusual?
10. What next catalyst or invalidation should be monitored?

The output remains decision support, not a trade instruction.

## 3. Evidence hierarchy

Priority means MVP dependency, not universal market importance.

### 3.1 CORE evidence

Required for the first defensible BTC + Gold intelligence chain.

#### Shared macro / financial-condition evidence

- Fed policy rate / target range
- FOMC decisions and statements
- SEP / Dot Plot where available
- policy expectation / market-implied path where qualified
- US 2Y yield
- US 10Y yield
- 10Y real yield
- 10Y breakeven / inflation compensation
- DXY
- broad USD
- M2 / broad money
- Fed balance sheet
- reserve balances
- TGA
- ON RRP
- SOFR / EFFR / IORB where relevant
- CPI / Core CPI
- PCE / Core PCE
- NFP / unemployment / jobless claims
- material scheduled macro events
- consensus / forecast / previous / revised previous / actual

#### Bitcoin / Crypto

- BTC spot price
- ETH spot price as secondary crypto-market context
- total crypto market cap
- BTC market cap
- total crypto volume
- BTC dominance
- BTC spot-ETF daily net flow where qualified
- stablecoin supply / market cap where qualified
- durable historical BTC observations

#### Gold

- Gold spot or qualified futures price
- durable historical Gold observations
- real-yield relationship inputs
- USD relationship inputs
- qualified Gold ETF flow/holdings where available

### 3.2 HIGH-VALUE evidence

Add after source identity, time semantics, historical continuity, and canonical classification are qualified.

#### Bitcoin / Crypto structure

- futures open interest
- perpetual open interest
- funding rates
- futures basis
- liquidations
- options implied volatility
- options skew
- CME Bitcoin positioning / COT where applicable
- historical positioning percentile
- stablecoin issuance/redemption and chain distribution when methodologically qualified

#### Gold structure

- COMEX open interest
- CFTC COT by participant category
- managed-money positioning
- other reportable / non-reportable positioning
- Gold ETF holdings
- Gold ETF flows
- positioning percentile / z-score derived from durable history

#### Supporting cross-asset evidence

These remain supporting evidence, not first-class MVP modules:

- Nasdaq
- S&P 500
- VIX
- IG/HY credit spreads
- WTI
- other already-available cross-asset observations when directly relevant to an approved BTC/Gold reasoning question

### 3.3 ENRICHMENT

Do not block the first MVP chain on these.

- advanced options skew / gamma / dealer-positioning models
- attributed on-chain exchange flows
- cross-currency basis / advanced USD funding
- term-premium decomposition
- advanced global-liquidity composites
- central-bank Gold purchases as a structural-demand series
- advanced geopolitical/event classification
- intraday microstructure/order-flow

## 4. Bitcoin evidence tree

```text
BTC PRICE
│
├── MACRO / POLICY
│   ├── Fed policy
│   ├── policy expectations
│   ├── US 2Y / 10Y
│   ├── real yield
│   ├── inflation pricing
│   └── economic catalysts
│
├── USD / LIQUIDITY
│   ├── DXY / broad USD
│   ├── M2
│   ├── Fed balance sheet
│   ├── reserves
│   ├── TGA / RRP
│   └── SOFR / funding
│
├── CAPITAL FLOW
│   ├── BTC ETF net flow
│   ├── cumulative ETF flow
│   └── ETF holdings / AUM where qualified
│
├── CRYPTO LIQUIDITY
│   ├── stablecoin market cap
│   ├── stablecoin issuance
│   └── chain distribution
│
├── DERIVATIVES
│   ├── OI
│   ├── funding
│   ├── basis
│   ├── liquidations
│   ├── IV
│   └── skew
│
├── POSITIONING
│   ├── CME / COT where applicable
│   └── historical percentile
│
└── SUPPORTING RISK EVIDENCE
    ├── Nasdaq
    ├── S&P 500
    ├── VIX
    └── credit spreads
```

The system must distinguish:

```text
BTC price movement
≠
ETF flow
≠
stablecoin liquidity
≠
derivatives leverage
≠
participant positioning
```

They may reinforce or contradict each other.

## 5. Gold evidence tree

```text
GOLD PRICE
│
├── OPPORTUNITY COST / RATES
│   ├── US 2Y
│   ├── US 10Y
│   ├── 10Y real yield
│   └── policy-implied path
│
├── USD
│   ├── DXY
│   └── broad USD
│
├── INFLATION
│   ├── CPI / PCE
│   ├── breakeven
│   └── inflation expectations / pricing
│
├── LIQUIDITY / POLICY
│   ├── Fed balance sheet
│   ├── M2
│   ├── reserves
│   ├── TGA / RRP
│   └── policy expectations
│
├── INVESTOR FLOW
│   ├── Gold ETF flow
│   └── Gold ETF holdings
│
├── POSITIONING
│   ├── COMEX OI
│   ├── CFTC COT
│   ├── Managed Money
│   └── other participant groups
│
└── STRUCTURAL / EVENT CONTEXT
    ├── central-bank Gold demand
    ├── fiscal stress
    ├── geopolitical events
    └── financial-stress evidence
```

Real yield and USD are high-value Gold drivers, but P365 must not treat either as a deterministic rule.

## 6. BTC ↔ Gold comparison

P365 must compare BTC and Gold directly without assuming Bitcoin is mechanically a "digital Gold" proxy.

For each shared catalyst, retain:

- BTC return
- Gold return
- US 2Y change
- US 10Y change
- real-yield change
- DXY / broad-USD change
- relevant liquidity/funding change
- BTC ETF flow
- Gold ETF flow
- BTC derivatives evidence
- Gold positioning evidence

This supports questions such as:

```text
Did BTC and Gold respond to the same macro impulse?
Did only one market respond?
Did market-specific flow dominate the shared macro backdrop?
Did one market contradict the prevailing cross-market pattern?
```

## 7. Relationship methodology

A relationship object must contain enough metadata to be reproducible.

Minimum dimensions:

| Field | Requirement |
|---|---|
| pair | e.g. BTC ↔ DXY, Gold ↔ real yield |
| transformation | price level, return, yield change, spread change, flow change |
| frequency | intraday / daily / weekly |
| window | explicit lookback; no hidden default |
| correlation | optional derived statistic |
| beta | optional derived statistic |
| lead/lag | optional, with methodology |
| sample size | required when statistical measures are shown |
| start/end | required |
| current percentile | optional vs historical relationship distribution |
| event condition | optional: CPI / FOMC / NFP / other |
| regime condition | deferred unless methodology approved |
| methodology version | required |
| input references | canonical IDs or stable series identity |

Candidate windows such as 20D / 60D / 120D may be evaluated later. They are not canonical rules in v0.1.

## 8. Event-window evidence

For scheduled macro events, correlation alone is insufficient.

Minimum event-window model:

```text
T-60m
T-5m
EVENT / RELEASE
T+5m
T+30m
T+60m
SESSION CLOSE
NEXT SESSION when required
```

The exact windows remain use-case specific and require later approval.

For a CPI/FOMC/NFP-style event, a snapshot may include:

- expectation before release
- actual / revision
- US 2Y
- US 10Y
- real yield
- DXY
- BTC
- Gold
- supporting VIX/equity/credit evidence where relevant

The reasoning chain is:

```text
EXPECTATION
        ↓
ACTUAL / SURPRISE
        ↓
RATES / USD REPRICING
        ↓
BTC RESPONSE
        ↓
GOLD RESPONSE
        ↓
CONFIRMATION / CONTRADICTION
        ↓
HISTORICAL COMPARABLE
```

## 9. Historical relationship / Market Memory requirements

Market Memory must eventually support:

- historical BTC observations
- historical Gold observations
- historical macro-driver observations
- historical ETF flows
- historical positioning
- historical derivatives structure
- historical event expectations/results
- pre/post-event snapshots
- relationship-statistic history
- methodology/version references

Historical relationship analysis must never silently use revised or later-known information inside an earlier point-in-time snapshot.

## 10. Evidence-state examples

P365 should prefer evidence bundles over directional labels.

Example:

```text
BTC +4.2%

Macro:
- DXY lower
- real yield lower
- easing expectations increased

Crypto flow:
- BTC ETF inflow

Liquidity:
- stablecoin supply increasing

Derivatives:
- OI higher
- funding moderate

Supporting market:
- Nasdaq confirms

Interpretation status:
- multiple evidence classes aligned
```

Alternative:

```text
BTC +4.2%

Macro:
- DXY higher
- real yield higher

Crypto flow:
- ETF outflow

Derivatives:
- OI sharply higher
- funding elevated

Interpretation status:
- price move contradicts several macro/flow inputs
- leverage contribution requires monitoring
```

For Gold:

```text
Gold +2.1%

- real yield lower
- DXY lower
- Gold ETF inflow
- positioning increased
- catalyst evidence present

Interpretation status:
- multiple Gold-relevant evidence classes aligned
```

These are structural examples only. They do not define thresholds or trade direction.

## 11. MVP acceptance gate for relationship intelligence

Do not call BTC/Gold relationship intelligence ready until P365 can:

1. retrieve point-in-time-compatible BTC, Gold, macro, and supporting evidence;
2. distinguish factual observation, pricing, expectation, flow, positioning, and model output;
3. compute reproducible relationship statistics with explicit methodology;
4. preserve correlation as non-causal evidence;
5. construct pre/post-event evidence sets;
6. compare current response against historical distributions or comparable events;
7. expose confirmation and contradiction without converting them into BUY/SELL/LONG/SHORT;
8. identify missing/stale/partial evidence explicitly;
9. retain source, time, and methodology provenance;
10. reconstruct what was knowable at the time.

## 12. Provider-selection rule

This document specifies **what evidence is required**, not which provider must supply it.

A provider is selected only after proving:

- semantic identity;
- timestamp/release semantics;
- unit/scale;
- historical continuity;
- provenance;
- quality/error semantics;
- reproducibility;
- acceptable licensing/usage terms for the MVP stage.

No provider should be added merely because it exposes a desired number.

## 13. Non-goals

This contract does not define:

- predictive correlation;
- causal claims from statistical association;
- trade-entry rules;
- stop loss / take profit;
- position sizing;
- risk limits;
- automatic bullish/bearish labels;
- universal risk-on/risk-off score;
- universal liquidity score;
- fixed correlation windows;
- fixed event windows;
- automatic regime classification.

Its purpose is narrower:

> **Define the evidence required for an auditable, time-varying Macro → BTC/Gold intelligence chain.**
