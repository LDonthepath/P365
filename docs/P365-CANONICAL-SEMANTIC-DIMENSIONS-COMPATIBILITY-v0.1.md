# P365 Canonical Semantic Dimensions Compatibility Contract v0.1

**Status:** Active compatibility contract  
**Scope:** Additive semantic classification for current canonical Observations  
**MVP boundary:** Macro + Crypto + Gold  
**Non-goal:** This contract does not add providers, rewrite Market Memory, change historical query identity, activate reasoning engines, or expand first-class MVP asset classes.

## 1. Purpose

The legacy canonical Observation contract uses:

```text
domain = MARKET | MACRO | ASSET | OTHER
```

That field remains required for backward compatibility, persistence, and the existing historical Observation query contract.

It is no longer sufficient to express the financial-market meaning required by the P365 ontology.

This checkpoint therefore adds independent semantic dimensions without replacing the legacy domain:

```text
legacy Observation.domain
+
marketDomain
+
informationClass
+
jurisdiction
+
instrument
+
asset
+
participant
+
tenor
```

The new dimensions describe meaning. The legacy domain preserves compatibility.

## 2. Compatibility invariant

The migration is additive.

```text
OLD RECORD
Observation
├─ domain
├─ sourceId
├─ metadata.seriesId / metricId
└─ ...

NEW RECORD
Observation
├─ domain                    ← retained
├─ semantics                 ← additive
│  ├─ ontologyVersion
│  ├─ marketDomain
│  ├─ informationClass
│  ├─ jurisdiction?
│  ├─ instrument?
│  ├─ asset?
│  ├─ participant?
│  └─ tenor?
├─ sourceId
├─ metadata.seriesId / metricId
└─ ...
```

Existing historical rows are immutable and do not need a destructive backfill.

## 3. Runtime contract

### 3.1 New writes

Current approved FRED, CoinGecko, and Yahoo canonical Observation families must attach approved semantic dimensions during normalization.

A current active metric that does not have an approved semantic mapping must fail explicitly rather than silently entering the canonical layer with an unclassified meaning.

### 3.2 Legacy reads

A persisted historical Observation may not contain the additive `semantics` field.

For such rows, P365 may resolve semantics at read time from the existing stable machine identity:

- `metadata.seriesId` for current FRED observations;
- `metadata.metricId` for current market observations.

This is a compatibility interpretation only. It does not mutate or rewrite the stored row.

### 3.3 Unknown legacy records

If a historical record has no approved semantic mapping, semantic resolution returns missing/unknown.

P365 must not infer semantics from:

- descriptive subject text;
- provider name alone;
- display labels;
- arbitrary prefix heuristics;
- UI location.

## 4. Current approved dimensions

### Market domain

- ECONOMY
- POLICY
- LIQUIDITY_FUNDING
- FISCAL_SOVEREIGN
- RATES
- FX
- EQUITY
- CREDIT
- COMMODITY
- VOLATILITY
- CRYPTO
- DERIVATIVES

### Information class

- OBSERVATION
- EXPECTATION
- PRICING
- POSITIONING
- FLOW
- INVENTORY
- EVENT
- EVIDENCE
- DERIVED_METRIC
- MODEL_ESTIMATE
- DERIVED_STATE

The information-class vocabulary is broader than the current Observation implementation so later canonical objects can use the same ontology. This checkpoint attaches it only to current canonical Observations.

### Jurisdiction

Current vocabulary supports:

- US
- EURO_AREA
- JAPAN
- CHINA
- UK
- CANADA
- AUSTRALIA
- GLOBAL
- OTHER

### Instrument

Current compatibility vocabulary supports:

- ECONOMIC_SERIES
- POLICY_RATE
- MONEY_MARKET_RATE
- BALANCE_SHEET
- CASH
- SOVEREIGN_BOND
- CREDIT_INDEX
- FX_INDEX
- FX_PAIR
- INDEX
- FUTURE
- OPTION
- SWAP
- ETF
- FUND
- COMMODITY_CONTRACT
- CRYPTO_SPOT
- CRYPTO_DERIVATIVE
- OTHER

Participant and tenor remain optional because they are not meaningful for every canonical observation.

## 5. Current mapping invariants

Examples:

```text
M2SL
legacy domain      MACRO
marketDomain       LIQUIDITY_FUNDING
informationClass   OBSERVATION
jurisdiction       US

SOFR
legacy domain      MACRO
marketDomain       LIQUIDITY_FUNDING
informationClass   PRICING
instrument         MONEY_MARKET_RATE
tenor              OVERNIGHT

DGS10
legacy domain      MACRO
marketDomain       RATES
informationClass   PRICING
instrument         SOVEREIGN_BOND
tenor              10Y

DFII10
legacy domain      MACRO
marketDomain       RATES
informationClass   PRICING
asset              US_TIPS
tenor              10Y

T10Y2Y
legacy domain      MACRO
marketDomain       RATES
informationClass   DERIVED_METRIC

btc.spot.usd
legacy domain      ASSET
marketDomain       CRYPTO
informationClass   PRICING
asset              BTC

crypto.btc_dominance.pct
legacy domain      MARKET
marketDomain       CRYPTO
informationClass   DERIVED_METRIC
asset              BTC

gold.futures.usd
legacy domain      ASSET
marketDomain       COMMODITY
informationClass   PRICING
instrument         FUTURE
asset              GOLD

dxy.index.usd
legacy domain      ASSET
marketDomain       FX
informationClass   PRICING
asset              USD
```

The coexistence of different legacy domains for observations that belong to one market domain is intentional during migration.

## 6. Historical Observation Repository compatibility

FND-001 remains unchanged in this checkpoint.

Current logical history identity continues to use:

```text
legacy domain
+
seriesKey
```

with optional source qualification.

Reason:

- changing historical query identity in the same checkpoint would mix ontology migration with history-contract migration;
- existing persisted history already uses legacy domains;
- current history behavior is tested and should remain stable while semantic classification is introduced.

A future semantic-history query contract may be added separately after the additive dimensions are established and migration behavior is proven.

## 7. Market Memory compatibility

No database schema migration is required.

Market Memory stores canonical payloads, therefore:

- new Observation writes can include `semantics` in the JSON payload;
- old rows remain valid without `semantics`;
- read-time semantic resolution can classify approved old rows from stable machine keys;
- append-only behavior remains intact.

No historical row should be rewritten solely to populate semantic dimensions.

## 8. Provider boundary

Provider identity is provenance, not market meaning.

Correct:

```text
seriesKey / metricId
        ↓
approved semantic mapping
        ↓
canonical Observation.semantics
```

Incorrect:

```text
provider == CoinGecko
        ↓
therefore CRYPTO
```

The mapping is based on canonical machine series identity, not provider branding.

## 9. Context compatibility

Existing Context scopes may continue using their current legacy selectors during this checkpoint.

The semantic dimensions are not permission for a drive-by Context rewrite.

Later Context evolution should consume approved semantic dimensions only in an isolated checkpoint with focused compatibility tests.

## 10. Acceptance criteria

This checkpoint passes only if:

1. existing `Observation.domain` remains unchanged;
2. existing canonical IDs remain unchanged;
3. existing historical query contract remains unchanged;
4. existing Market Memory rows require no rewrite;
5. current FRED registry series all have approved semantic mappings;
6. current CoinGecko metric families all have approved semantic mappings;
7. current Yahoo Gold/Russell/DXY metrics all have approved semantic mappings;
8. new normalized Observations carry additive semantic dimensions;
9. legacy rows can resolve approved semantics from series/metric identity;
10. unknown semantics fail or remain explicitly missing rather than being guessed;
11. no provider is added;
12. no UI, State, Risk, Regime, Intelligence, or Briefing logic changes;
13. build/lint and focused compatibility verification pass.

## 11. Next dependency

After this checkpoint is merged, the next foundation dependency remains:

```text
FND-003
Independent Historical Ingestion / Backfill Ownership
```

That checkpoint can then collect durable history while preserving both the legacy compatibility contract and the additive semantic meaning required by the Macro + Crypto + Gold MVP.
