# P365 Current State v0.1

**Status:** Current-state SSOT  
**Last verified:** 2026-09-18  
**Product:** P365 Market Intelligence System  
**Audit baseline:** `docs/P365-CANONICAL-FOUNDATION-INTEGRITY-AUDIT-F0.md`

## 1. Executive state

P365 is in **foundation remediation** after the end-to-end F0 audit. The active product scope is Macro + Crypto with cross-asset factual coverage; the architecture remains market-agnostic. The product serves a self-directed retail trader/investor as decision support and does not make the user's trading/investment decision.

```text
Product/user contract        COMPLETE
Canonical provider pipeline  IMPLEMENTED / PARTIAL HARDENING
Macro factual foundation     IMPLEMENTED
Crypto factual foundation    PARTIAL
Cross-asset factual data     PARTIAL
Economic event results       TRIAL / PARTIAL
Context                      IMPLEMENTED / DEFECT OPEN (FND-004)
Durable Market Memory        FOUNDATION IMPLEMENTED
Historical retrieval         MISSING (FND-001)
Factual baseline             IMPLEMENTED / NOT REPOSITORY-BACKED (FND-002)
Independent ingestion        MISSING (FND-003)
Expectation baseline         MISSING lifecycle
Pricing baseline             MISSING
Market Snapshot              DESIGN ONLY
Transmission reasoning       MISSING
State / Regime / Risk        DEFERRED
Intelligence / Briefing      DEFERRED
```

## 2. Current factual coverage

**Macro:** FRED covers the approved monetary-policy, liquidity, inflation, labor, rates, broad-USD and growth foundation. FRED also supplies several cross-asset series.

**Crypto:** CoinGecko supplies BTC/ETH spot, BTC/ETH market cap, total crypto market cap, total volume and BTC/ETH dominance. Stablecoin market cap and a defined basic-volatility metric remain open.

**Cross-asset:** S&P 500, Nasdaq, Russell 2000, US 2Y, US 10Y, 10Y real yield, DXY, broad USD, Gold futures, WTI, VIX and IG/HY credit spreads are available. DXY and the FRED broad USD index are separate instruments and must never be treated as interchangeable. MOVE remains open.

**Economic events:** Forex Factory supplies scheduled-calendar awareness; Federal Reserve supplies official FOMC date anchors; Biquote supplies trial structured result fields including actual/forecast/previous/revision. Production qualification and release-time semantics remain open.

**Evidence:** Alpha Vantage and CoinDesk news remain Evidence and are not promoted into Observation or Intelligence.

## 3. Active architecture state

```text
Provider
  ↓
Ingestion
  ↓
Normalization
  ↓
Canonical Observation / Event / Evidence / EconomicEventResult
  ↓
Context
  ├── known taxonomy defect pending repair
  ↓
Append-only Market Memory
  ├── historical semantic query missing
  ↓
Factual Baseline
  └── currently uses the current provider retrieval window
```

No State, Risk, Regime, Intelligence, Market Briefing, trading signal, portfolio sizing or execution logic is active.

## 4. Authoritative open foundation blockers

The F0 audit is the authoritative defect inventory. Current HIGH blockers are:

- FND-001 — semantic historical Observation query missing.
- FND-002 — factual baseline is not repository-backed.
- FND-003 — historical ingestion/backfill has no independent owner.
- FND-004 — CRYPTO_MARKET Context taxonomy mixes/omits domains.
- FND-005 — documentation drift; this reconciliation checkpoint addresses the current-state portion.
- FND-006 — Market Snapshot implementation missing.
- FND-007 — Pricing baseline/market-implied layer missing.
- FND-009 — manual refresh does not invalidate all canonical cadence tags.

Medium/low findings FND-008 and FND-010 through FND-019 remain governed by the F0 audit and must not be silently dropped.

## 5. Immediate remediation sequence

```text
SSOT reconciliation                         ← this checkpoint
  ↓
Context taxonomy repair
  ↓
Historical Observation repository contract
  ↓
Durable history adapters
  ↓
Independent ingestion/backfill ownership
  ↓
Repository-backed Factual Baseline
  ↓
Temporal/provenance/freshness hardening
  ↓
Manual cache invalidation repair
  ↓
Remaining qualified factual gaps
  ↓
Expectation baseline lifecycle
  ↓
Market Snapshot
  ↓
Pricing baseline
  ↓
Cross-asset temporal comparison/transmission
  ↓
State → Risk → Intelligence → Briefing
```

This order is dependency-driven. A later reasoning layer must not be activated to compensate for an unresolved earlier foundation dependency.

## 6. Documentation authority

For **current repository state**, use this document. For **development sequencing**, use `P365-ROADMAP-v0.1.md`. For the **verified defect inventory and completion gates**, use `P365-CANONICAL-FOUNDATION-INTEGRITY-AUDIT-F0.md`. Product/user requirements are defined by `P365-USER-DECISION-SUPPORT-CONTRACT.md` and architecture invariants by `P365-ARCHITECTURE.md`.

Older audit/design documents are retained for history. Where their current-state claims conflict with this SSOT or F0, they are superseded rather than silently rewritten.
