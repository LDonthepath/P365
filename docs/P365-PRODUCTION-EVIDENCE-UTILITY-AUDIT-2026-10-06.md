# P365 Production Evidence Utility Audit — EVIDENCE-EFF-001A

**Status:** AUDIT FROZEN / NO PRODUCTION MUTATION  
**Checkpoint:** EVIDENCE-EFF-001A — Production Evidence Utility Audit  
**Base:** `main@a521a60bdd48ded94193e0bd5d98ebdf85007d82`  
**Audit time:** 6 Oct 2026  
**Scope:** production evidence utility, write-rate, persistence efficiency, and storage pressure

## 1. Purpose

P365 has reached a point where adding more evidence is no longer automatically beneficial.

This checkpoint answers:

> Which evidence families materially support production P365, which need high-frequency durable history, which only need slower context, and which persistence patterns are creating storage cost without adding new factual value?

This audit does **not** authorize:

- deletion of canonical history;
- compaction;
- archival;
- scheduler mutation;
- provider removal;
- cadence changes;
- schema changes;
- order-book activation;
- State / Regime / Risk / Intelligence;
- causal attribution;
- trading signals.

The first goal is to stop low-value future growth safely. Historical cleanup requires its own contract.

## 2. Live production baseline

Read-only Supabase verification at approximately 14:35 UTC on 6 Oct 2026:

- PostgreSQL database: **286,346,387 bytes**;
- planning ceiling: **524,288,000 bytes**;
- utilization: **54.62%**;
- estimated headroom: **237,941,613 bytes** (~227 MiB);
- Market Memory total: **248,299,520 bytes**;
- Market Memory heap: **181,387,264 bytes**;
- Market Memory indexes: **66,428,928 bytes**;
- Market Memory rows: **159,694**;
- Evidence rows: **122,007**;
- Observation rows: **36,088**;
- `cron.job_run_details`: **25,624,576 bytes**.

From the 00:15 UTC storage snapshot to ~14:35 UTC:

- database growth: **+9,568,256 bytes**;
- Market Memory growth: **+9,289,728 bytes**;
- Market Memory rows: **+3,839**;
- elapsed time: **14.33 hours**.

If this short-window rate persisted unchanged, it would imply roughly **16.0 MB/day** database growth and only about **14.8 days** of planning headroom. This is a sensitivity estimate, not a stable long-run forecast.

Last 24 hours:

- Market Memory writes: **6,387 rows**;
- logical canonical payload: **6,391,133 bytes** before tuple/index overhead;
- Observation: **2,904 rows**;
- Evidence: **3,475 rows**;
- Event: **6 rows**;
- Snapshot: **2 rows**.

## 3. Active scheduler ownership

Production recurring owners remain unique; no duplicate scheduler was found.

### p365-market-fast

- cadence: every 5 minutes;
- providers:
  - CoinGecko;
  - Gold Yahoo;
  - DXY Yahoo;
  - USDJPY Yahoo;
  - USDCNH Yahoo;
  - GDELT;
  - Binance spot-flow.

### Other active owners

- Biquote event-fast: every 5 minutes around bounded event windows;
- FRED: hourly acquisition with canonical fact idempotency;
- Forex Factory + Federal Reserve event calendar: every 6 hours;
- stablecoin: twice daily;
- BTC ETF flow: twice daily;
- CFTC Gold COT: daily poll of weekly-source facts;
- snapshot capture: every 5 minutes but persists only qualifying event-window snapshots;
- storage monitoring: daily.

The storage issue is therefore not caused by duplicate cron ownership.

## 4. Production utility classification

### 4.1 KEEP_FAST — 5-minute durable history is justified

| Evidence | Current cadence | Production consumers | Verdict |
|---|---:|---|---|
| `btc.spot.usd` | 5m | MOVE trigger, MOVE calibration, event windows, briefing, dashboard | **KEEP_FAST** |
| `eth.spot.usd` | 5m | synchronous MOVE fingerprint, event windows, dashboard | **KEEP_FAST** |
| `gold.futures.usd` | ~5m market session | MOVE trigger, MOVE calibration, event windows, briefing | **KEEP_FAST** |
| `dxy.index.usd` | ~5m market session | synchronous MOVE, event windows, repricing context | **KEEP_FAST** |
| `fx.usdjpy.jpy_per_usd` | 5m | synchronous MOVE fingerprint / Japan transmission | **KEEP_FAST** |
| `fx.usdcnh.cnh_per_usd` | 5m | synchronous MOVE fingerprint / China transmission | **KEEP_FAST** |
| Binance BTCUSDT completed 5m taker-flow | 5m | MOVE-002C replay and MOVE-003C participation summary | **KEEP_FAST** |

These series depend on exact 5-minute-ish point-in-time history. Downsampling them would directly reduce MOVE/event-window capability.

### 4.2 KEEP_SOURCE_NATIVE — persistence already tracks source-native cadence

| Evidence | Durable cadence observed | Production consumers | Verdict |
|---|---:|---|---|
| GDELT BTC candidate snapshot | ~15m | MOVE-002D unscheduled catalyst replay | **KEEP_SOURCE_NATIVE** |
| GDELT Gold candidate snapshot | ~15m | MOVE-002D unscheduled catalyst replay | **KEEP_SOURCE_NATIVE** |
| FRED macro series | source daily/weekly/monthly | Rates & Policy, briefing, macro context | **KEEP_SOURCE_NATIVE** |
| stablecoin supply | daily source / twice-daily poll | Crypto background + MOVE slow background | **KEEP_SOURCE_NATIVE** |
| BTC ETF flow | trading-day maturity | Crypto flow + MOVE slow background | **KEEP_SOURCE_NATIVE** |
| CFTC Gold positioning | weekly source | Gold context + MOVE slow background | **KEEP_SOURCE_NATIVE** |
| SEP | release-driven | Rates & Policy | **KEEP_SOURCE_NATIVE** |

Polling frequency alone is not the storage problem when unchanged provider facts dedupe correctly.

### 4.3 KEEP_SLOW — useful context, but 5-minute durable persistence is not justified

Current production code search found these series as dashboard / neutral CRYPTO_MARKET context inputs, with no MOVE trigger, event-window, historical calibration, or synchronous replay consumer:

- `btc.market_cap.usd`;
- `eth.market_cap.usd`;
- `crypto.total_market_cap.usd`;
- `crypto.total_volume_24h.usd`;
- `crypto.btc_dominance.pct`;
- `crypto.eth_dominance.pct`.

24-hour production footprint:

#### BTC + ETH market cap

- **1,152 rows/day** including Observation + Evidence;
- ~**1.084 MB/day logical payload**.

#### Global crypto context

- total market cap;
- total 24h volume;
- BTC dominance;
- ETH dominance;
- **1,144 rows/day**;
- ~**1.020 MB/day logical payload**.

Combined:

- approximately **2,296 rows/day**;
- approximately **2.10 MB/day logical payload** before tuple/index overhead.

These account for roughly **36% of all Market Memory rows written in the last 24 hours** while not supporting the 5-minute MOVE/event evidence path.

**Frozen audit verdict: `KEEP_SLOW`.**

A later implementation checkpoint should keep BTC/ETH spot on the 5-minute lane while persisting these context metrics at a slower cadence. The audit does not yet freeze the exact slower interval; an hourly target is a reasonable implementation candidate, but must be tested against UI freshness expectations before activation.

### 4.4 KEEP_EVENT / STOP_DUPLICATE_PERSIST — event facts remain important, retrieval snapshots do not

#### Biquote

Seven-day production evidence:

- **1,593 physical Evidence rows**;
- only **20 unique canonical Evidence IDs**;
- ~**1.22 MB logical payload**;
- **1,573 repeated physical rows**.

Biquote `EVENT_RESULT` is already content-versioned using a provider snapshot fingerprint. The event/result history must remain.

The repeated Biquote Evidence rows primarily arise because Event Evidence uses retrieval time as its effective timestamp, so every poll can receive a new Market Memory dedupe key even when the provider event content is unchanged.

**Verdict:** keep 5-minute event polling, but change durable Evidence persistence so unchanged provider content does not create another physical Evidence version.

#### Federal Reserve FOMC calendar

Seven-day production evidence:

- 199 physical Evidence rows;
- 37 unique canonical IDs;
- 162 repeated rows.

**Verdict:** keep calendar refresh, but content-dedupe unchanged calendar Evidence.

#### Forex Factory

Seven-day production evidence:

- 47 physical Evidence rows;
- 37 unique canonical IDs.

Smaller issue, same family.

**Verdict:** retain event facts; review content-deduping under the same event-Evidence checkpoint.

## 5. Historical duplicate-version footprint

The audit found substantial legacy physical-version density where many Market Memory rows share the same canonical ID.

This is **not** an orphan-data finding and does not authorize deletion.

Potential logical payload represented by rows after the first physical row per `record_type + canonical_id`:

| Family | Duplicate-version logical payload |
|---|---:|
| FRED Evidence | **39,978,410 bytes** |
| CoinGecko Evidence | **2,894,746 bytes** |
| Biquote Evidence | **1,990,250 bytes** |
| Yahoo Evidence | **930,829 bytes** |
| FRED Observation | **479,386 bytes** |
| Federal Reserve Evidence | **323,072 bytes** |
| Biquote EventResult | **188,812 bytes** |
| Context | **186,716 bytes** |
| Forex Factory Evidence | **91,170 bytes** |

The largest item is FRED Evidence: **75,418 physical rows for 804 canonical Evidence IDs**.

However, canonical ID equality alone is insufficient to delete later physical rows because later rows may preserve:

- point-in-time retrieval semantics;
- provider vintage lineage;
- correction knowledge time;
- provenance differences;
- historical reconstruction behavior.

A separate compaction checkpoint must prove which fields differ and whether retaining the earliest knowable physical row plus true factual revisions preserves all existing HIST/MOVE/REL/Snapshot consumers.

## 6. Direct HistoricalEvidence families are not orphans

The following Evidence families are intentionally consumed directly and therefore may show no Observation/Event reference:

- Binance spot-flow;
- GDELT durable NEWS snapshots.

Their absence from Observation/Event `evidenceId` references is expected. MOVE reads them through `HistoricalEvidenceRepository`.

They must not be removed by a generic "unreferenced Evidence" cleanup.

## 7. Inactive historical provider data

Small historical footprints remain from no-longer-active runtime paths such as:

- Alpha Vantage;
- CoinDesk.

They are not meaningful contributors to current growth.

They may become future archive candidates, but they are not a priority while active high-frequency lanes dominate write-rate.

## 8. Operational history

`cron.job_run_details` is about **25 MB** physical relation size and contains records back to 6 Jul 2026.

Read-only retention sensitivity:

- older than 7 days: 29,767 rows / ~10.1 MB logical row payload;
- older than 14 days: 23,650 rows / ~6.9 MB;
- older than 30 days: 17,939 rows / ~5.0 MB.

A 30-day retention policy remains reasonable for operational history, but deleting those rows alone will not solve Market Memory growth. PostgreSQL deletion also does not automatically shrink relation files; it primarily makes space reusable unless a separately authorized rewrite/compaction operation occurs.

## 9. Prioritized remediation sequence

### EVIDENCE-EFF-001B — split fast pricing from slow crypto context

Goal:

- keep BTC/ETH spot on current 5-minute durable path;
- reduce persistence cadence for market cap, dominance, total market cap, and 24h volume;
- preserve UI/context availability;
- no deletion of old history.

Expected effect:

- eliminate most of ~2,296 context-only rows/day;
- reduce logical payload growth by roughly ~2.1 MB/day before tuple/index overhead.

This is the highest-value low-risk write-rate reduction.

### EVIDENCE-EFF-001C — event Evidence content idempotency

Goal:

- preserve Biquote / Federal Reserve / Forex Factory polling cadence;
- persist new Evidence only when provider factual content changes;
- retain genuine actual/forecast/previous/revision transitions;
- do not suppress EVENT_RESULT revisions.

Expected effect:

- remove high redundant Event Evidence write multiplicity;
- improve canonical idempotency semantics.

### EVIDENCE-EFF-001D — canonical duplicate-version compaction feasibility

Read-only first.

Must prove:

- what differs across same-canonical-ID physical versions;
- earliest-knowledge preservation;
- FRED vintage/provenance safety;
- Snapshot reference safety;
- HIST/MOVE/REL read-equivalence;
- whether any deletion/archival can preserve append-only audit semantics.

No destructive action is authorized by EVIDENCE-EFF-001A.

### HOUSEKEEP-002 — bounded cron history

Operational-only retention remains worthwhile, preferably 30 days unless owner selects another horizon.

It is secondary to active Market Memory write-rate reduction.

### ORDER-BOOK-001D — remain blocked

Do not activate the two durable order-book sampling lanes until:

1. EVIDENCE-EFF-001B is production-active;
2. at least one new storage snapshot confirms reduced steady-state growth;
3. headroom/runway is recalculated.

## 9A. Release-aligned polling vs persistence policy

Owner decision on 6 Oct 2026: scheduler/persistence cadence must follow the information cadence of each data family rather than a uniform database-write interval.

Frozen rule:

- **Polling cadence and persistence cadence are separate controls.**
- A cron may poll more frequently than the provider's release cadence when timely detection matters.
- Market Memory must not create another physical canonical fact merely because P365 polled again.
- Release-based facts persist only when provider effective date/time, value/revision, or qualified factual content changes.
- Continuously traded pricing used by MOVE/event windows may retain fast durable sampling.
- Continuously changing market context with no intraday historical consumer must use a slower sampling lane.
- Source-native feeds such as GDELT should preserve source-native durable cadence even if acquisition is attempted more frequently.
- Event calendars may be polled near release windows, but unchanged event Evidence must be content-idempotent.

Current target mapping:

| Family | Acquisition policy | Durable persistence policy |
|---|---|---|
| BTC/ETH spot, Gold, DXY, USDJPY, USDCNH | 5m where market/session permits | **5m / effective quote timestamp** |
| Binance BTC spot-flow | 5m | **completed 5m window only** |
| CoinGecko market cap + global dominance/24h metrics | slower context lane | **context sampling, not 5m** |
| GDELT GAL | may be checked by fast owner | **source-native ~15m feed build only** |
| FRED daily/weekly/monthly series | polling may remain hourly for timely detection | **new effective observation/revision only** |
| stablecoin supply | twice-daily detection currently acceptable | **daily provider-effective fact only** |
| BTC ETF flow | twice-daily maturity detection | **new maturity-qualified trading-date fact only** |
| CFTC Gold COT | daily detection currently acceptable, including holiday-delayed publication | **new weekly report/revision only** |
| SEP | release discovery/recheck | **new official SEP release/revision only** |
| economic-event calendars | scheduled/fast-window polling as required | **new/changed factual event content only** |

The uploaded liquidity framework also distinguishes daily, weekly, monthly and real-time update families; P365 uses that distinction as a utility input, but preserves its own intraday requirements for MOVE pricing series.

## 10. Evidence utility rules frozen by this audit

Future data additions should answer all five questions before production persistence:

1. **Consumer:** Which production component consumes this exact evidence?
2. **Temporal need:** What is the minimum cadence required by that consumer?
3. **Historical need:** Does the consumer need durable history or only latest state?
4. **Identity:** What factual change justifies a new canonical physical version?
5. **Storage budget:** What rows/day and bytes/day does the lane add?

If a lane cannot answer these questions, it should not automatically receive high-frequency durable persistence.

## 11. Current product consequence

P365 should prioritize **evidence effectiveness over evidence count**.

More rows do not mean more intelligence.

The correct near-term sequence is:

> reduce low-value write-rate → prove storage improvement → then activate new high-value evidence such as durable order-book geometry.

This keeps the system aligned with the MVP objective: Macro explanatory environment → BTC + Gold market intelligence for intraday decision support, without turning Market Memory into an indiscriminate data lake.
