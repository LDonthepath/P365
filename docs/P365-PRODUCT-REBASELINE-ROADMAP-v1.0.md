# P365 — Product Rebaseline Roadmap v1.0

**Decision owner:** 11 Oktober 2026  
**Tracking/approval:** PRODUCT-REBASELINE-001 issue #360 (docs-only). Owner merges PR.  
**Goal:** A useful Multi-Asset Financial Market Intelligence system for discretionary traders across intraday/swing/position, with macro state/regime as context.  
**Important:** This **product roadmap** does not supersede Recovery G0–G5 and operational SSOT #283. Every delivery checkpoint requires a standalone bounded issue + PR and post-merge verification.

## 1. Product north star and success evidence

A user should be able to open P365 **without a scheduled event or MATERIAL_MOVE**, select a market/horizon, and answer: what is the current condition; what changed versus a qualified baseline; how this compares across markets; which evidence agrees/disagrees; what macro backdrop is relevant; what is unknown; and what next observations could invalidate the reading.

Success is demonstrated by **real qualified facts and coherent explanation, not number of widgets/providers/events**.

### Non-negotiable release principles

- Existing active features are not declared gone, nor automatically production-certified, merely because product direction changed.
- Preserve append-only Market Memory, identity, temporal semantics, source contracts, point-in-time and no-causality claims.
- No inferred trade signals, position sizing, execution, price targets or regime labels before gates.
- Free-first, capacity-aware. Storage use, per-provider quotas, and value of retaining high-frequency historical evidence are explicit.
- No new provider, paid entitlement, schema, cron or significant architecture shift without separate owner decision.
- Deployment READY, HTTP 200 and green CI prove different things from historical accuracy, performance, and user usefulness.
- UX is Indonesian with a high-value default view and drilldown, not a dense indicator catalog.

## 2. Phases and sequencing

| Phase | Outcome | Deliverable (one or more bounded issues) | Exit gate | Initial status |
| --- | --- | --- | --- | --- |
| **PRB-0 — Contract freeze** | Owner-approved north star, market universe, governance, roadmap | Contract + universe + roadmap + entry-point SSOT links | Docs reviewed/merged; no contradictory product authority, no runtime mutation | **IN REVIEW** (issue #360; update after merge) |
| **PRB-1 — Factual coverage & user baseline** | Inventory verifiable coverage per market/horizon, user-value baseline and current UI capability | Read-only coverage matrix, actual eligible series, quality/gaps, storage/cost, instrument identity; representative real user task | No inferred availability; owners/risks/issues mapped; evaluate pre/post using same acceptance scenarios | **BACKLOG** |
| **PRB-2 — Market-first factual experience** | Useful cross-market Overview **without event or MOVE prerequisite** | Reuse/extend factual overview and market detail; explicit FX/rates/equity/commodity/crypto/credit-vol groupings where qualified | In real samples user sees multiple qualified market families, changes with correct basis/cutoff and evidence/gap; mobile/desktop + read-only production validation | **BACKLOG; dependencies #281, #319, recovery G1/G2** |
| **PRB-3 — Multi-horizon Market State pilot** | Deterministic market structure / trend / range / volatility states per instrument and horizon | **First** research/definition/calibration issue; **then** independent small implementation issue(s) after approval | Qualified history and session baselines, no look-ahead, reproducible state+uncertainty; BTC/Gold pilot and at least one non-BTC/Gold instrument before claiming generic portability | **BLOCKED until PRB-1/2 and approved State checkpoint** |
| **PRB-4 — Regime research & validation** | Persistent regime labels only if empirically defensible | Define onset/transition/exit, persistence, training/hold-out, stability, confidence and insufficient evidence; macro backdrop distinct from market regime | Out-of-sample/replay/temporal bias tests accepted by owner; negative/unknown cases work; no overfit or fake universal “risk-on” label | **BLOCKED; no regime engine authorized** |
| **PRB-5 — Trader market briefing** | Evidence-driven, multi-asset/multi-horizon summaries, conflicts, gaps and what-to-monitor | Separate factual composer, macro-context attachment, conditional invalidation narrative, provenance drilldown | Non-event user scenarios across multiple families answered, evidence and limitations traceable; cannot overclaim causality or produce trade signal | **BACKLOG; factual briefing may be improved before regime exists** |
| **PRB-6 — Broader first-class activation** | Expand deep capability per eligible market family based on trader value | Per-market qualification and small PRs: FX, equity, rates, commodity beyond gold, credit/vol, crypto breadth as needed | Each family passes identity, legal/provider, timing, historical, comparison, user-value and production gate; no automatic broad backfill | **BACKLOG; per-market owner approval** |

**Sequence:** PRB-0 → PRB-1 → PRB-2; PRB-3 pilot may start only after factual acceptance and explicit owner checkpoint. PRB-4 requires PRB-3 validation; portions of PRB-5 that merely compose factual qualified evidence can proceed after PRB-2 without waiting for Regime. PRB-6 grows incrementally as qualified. Production security/storage hardening in G0–G5 may block releases throughout.

### PRB-1 minimum evidence matrix

Report per market family: product target → existing provider/source → canonical series/instrument identity → native cadence and venue/session → effective vs retrieved time → durable history length/coverage → comparison eligible horizons → data health and gaps → cost/entitlement → storage/runway → current UI consumer → owner issue. Mark each as **VERIFIED / PARTIAL / UNKNOWN / NOT_AVAILABLE**, with exact query/code/production evidence. Do not claim provider coverage solely from README/SSOT.

### PRB-2 factual acceptance examples

1. **Quiet market:** no new macro Event and no material MOVE; Overview still conveys actual market status, at least a few dated qualified changes and coverage.
2. **Divergent markets:** e.g. BTC, Gold, DXY or yields do not align; UI states qualified co-move/divergence only if their horizons/time are comparable, otherwise separates contextual facts.
3. **Closed venue / weekend:** crypto trades while cash equity, rates or Gold venue is closed; no fake synchronized returns.
4. **Partial market data:** stale/unknown rates, missing credit or provider errors do not become zero or bullish/bearish defaults.
5. **Audit replay:** same as-of cutoff yields only information P365 could have retrieved then.

Successful PRB-2 must show **actual values** from qualified data in at least **four distinct market families** across representative live/replay scenarios; unqualified groups can remain explicit gaps. If current provider inventory cannot support four, record BLOCKED and propose separately qualified acquisition rather than filling placeholders. This is a product acceptance target, not a claim of present coverage.

### PRB-3/4 analytical quality gates

- Training/research and acceptance slices separated in time; preserve revision availability; no future leak or survivor bias.
- Explicit default UNKNOWN when evidence insufficient. Model/methodology version, parameters, derived-state provenance.
- Compare candidate state/regime to simple baselines; evaluate frequency of transition, stability and error modes, not merely attractive labels.
- Cross-venue and multi-timeframe contradiction visible (state at 1h ≠ state at 1w).
- Only approved instrument/horizon becomes eligible for UI label after user-value acceptance; no global activation by library import.
- Distinguish macro cycle/regime from instrument regime and guard against simplistic “macro caused price” attribution.

## 3. Existing issue mapping and explicit non-goals

| Existing work | Rebaseline disposition |
| --- | --- |
| #283 Recovery G0–G5 | **Active independent safety/architecture track**; quality, correctness, security and capacity continue as release prerequisites |
| #281 Financial Market Overview | Reuse existing factual UI/read models; review actual production behavior in PRB-1 rather than duplicating |
| #319 pre-MOVE market context | Reuse factual feed in market-first experience, but issue closure follows own checks |
| #271 BTC/Gold relative strength; #274 macro unified view; #275 briefing | Preserve implementation outcomes, evaluate within new trader scenarios; no duplicate PR |
| #276 Binance futures breadth; #277 Gold Spot | Preserve contractual identity/qualification boundaries, no new provider rights |
| #350 5m retention policy and #353 move/drawdown | **PAUSED BY OWNER**; rebaseline is not authorization to resume or delete data |
| #331 recovery backup; #333 capacity and free tier | Storage and recovery risks must be quantified before sustained multi-asset/high-frequency expansion |

A product roadmap row is **not an implementation issue**. After PRB-0, create individual single-purpose issues only when the prior phase establishes evidence and dependencies. Each issue must specify one outcome, affected surface, observable acceptance, exclusions, owner decision needs, base/HEAD tests, post-merge closure conditions, and references.

## 4. Rebaseline product acceptance scorecard

A phase report should include:

| Dimension | Observable evidence |
| --- | --- |
| User value | A trader can answer the target questions with a real representative market case |
| Market breadth | Number/families with **qualified usable** evidence, separately from placeholder groups |
| Temporal integrity | As-of replay, effective/retrieval, session alignment, revision and no-look-ahead tests |
| Explanation quality | Traceable facts, baseline, contradiction, UNKNOWN and bounded attribution |
| Horizon fitness | Intraday vs swing vs position claims aligned with actual source resolution/history |
| Operational | Documented source/license, quota, measured latency, storage impact, stable reads, security |
| Release | Focused/regression tests, owner-reviewed PR, production exact SHA + runtime/UI evidence |

**No guessed thresholds, target latency, accuracy percentage or capacity runway** may be treated as attained without measurement.

## 5. Governance and change policy

PRB-0 is documentation-only. Its merge adopts the new **product intent**, not production activation. A subsequent feature must not touch unrelated recovery items, core semantic types, scheduler or database just because they appear in this roadmap. Read canonical AGENTS.md and F0 before every implementation, capture current main and open PRs, and preserve owner-only merge.

**Next authorized step after PRB-0 verification:** PRB-1 read-only *actual data/feature coverage and trader task baseline*, one issue, one PR/report. Do not build State/Regime from an unmeasured assumption.
