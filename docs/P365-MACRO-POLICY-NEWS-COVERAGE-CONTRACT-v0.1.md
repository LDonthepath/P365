# P365 Macro / Policy News Coverage Contract v0.1

**Checkpoint:** NEWS-MACRO-001A  
**Status:** PROPOSED CONTRACT / OWNER REVIEW & MERGE PENDING  
**Scope:** Macro discovery supporting BTC + Gold; documentation/source qualification only  
**Source:** Existing GDELT GAL RSS, FREE_ONLY  
**Implementation:** No runtime, provider, persistence, scheduler or presentation activation

## 1. Product question and verified baseline

P365 must discover policy and macro information without requiring Bitcoin or Gold
to occur in the headline. BTC/Gold are investigation targets, not the entire news
universe. A candidate may be relevant to both markets, neither market, or remain
unresolved; inclusion does not establish market impact or causality.

Preflight on 7 Oct 2026 WIB:

- main `463f268b32bb9b0c4ccd1e7336ed1069029dd498`, committed 6 Oct 20:53:06 UTC;
- one open PR: #211, head `c6e6210b16d9d9c3145f1bdb994abb77a36de9da`, not merged;
- AGENTS, full operational SSOT and ontology were read; Observation compatibility
  was also reviewed, but this checkpoint changes no Observation mapping;
- #211 remains an independent MOVE title-presentation checkpoint, not a coverage fix.

Verified current implementation:

| Boundary | Current behavior | Consequence |
|---|---|---|
| `lib/data/gdelt-gal.ts` | Local extraction accepts only BTC/Gold asset matches | Policy headlines without asset mentions are dropped before persistence |
| `lib/application/historical-ingestion.ts` | GDELT acquisition requests BTC and GOLD | No independent macro-topic durable snapshot exists |
| `lib/application/gdelt-gal-history.ts` | v1 snapshot requires BTC/GOLD and hashes asset + feed build | MACRO must not be inserted as a pretend asset into v1 |
| `lib/application/move-evidence-bundle.ts` | Replay filters methodology v1 + target gdeltAsset | Macro discovery cannot be repaired only in JSX |
| `lib/data/alpha-vantage.ts` | Current dashboard requests macro/monetary/fiscal/financial-market topics | Useful current path, not an independent cron-owned NEWS history lane |
| `lib/application/dashboard-query.ts` | Dashboard read performs no durable writes | Current macro headlines do not establish historical MOVE availability |

A deterministic synthetic RSS fixture passed five titles to the unchanged adapter:

| Title | Current BTC snapshot | Current Gold snapshot |
|---|---|---|
| Federal Reserve raises interest rates | Excluded | Excluded |
| Bank of Japan announces monetary policy change | Excluded | Excluded |
| China announces new trade tariffs | Excluded | Excluded |
| Bitcoin rises after Federal Reserve decision | Retained | Excluded |
| Gold price falls after policy announcement | Excluded | Retained |

This reproduces a lexical discovery gap, not an assessment of real headline impact.
The production dashboard request during the audit returned HTTP 200, zero macro
headlines and Alpha Vantage ERROR with a provider request-spacing diagnostic.
This is one acquisition observation, not proof of permanent outage, a missing key,
daily-quota exhaustion, or absence of macro news. No paid upgrade is proposed.

## 2. Source requalification

Official sources checked 7 Oct 2026 WIB:

1. [GDELT GAL / RSS documentation](https://blog.gdeltproject.org/announcing-the-gdelt-article-list-rss-feed/)
   describes a global monitored-URL/title feed refreshed each minute, covering a
   rolling 15-minute discovery interval. Its dates may be publication or discovery.
2. [GDELT data access](https://gdeltproject.org/data.html) identifies its database
   as free/open and supports raw downloads.
3. [GDELT terms](https://gdeltproject.org/about.html) allow fee-free use
   and redistribution of released datasets with attribution and a project link.

Decision: reuse the existing qualified GAL metadata feed. The next read-only
qualification may extract macro topics from the same fetched RSS bytes as BTC/Gold;
it must not add a second per-topic fetch or DOC API hot-path polling. No credential,
subscription, SaaS or new dependency is required by this design.

GDELT metadata is discovery, not primary verification. Existing explicit origin-domain
rules may label an article as official only when its actual URL matches the approved
origin map. A media headline mentioning the Fed is not an official Fed statement.
Full article extraction, images, summaries, translation, paywall bypass and content
redistribution are outside this checkpoint. Direct Fed/BoJ/PBoC statement feeds may
be qualified separately later; they are not assumed available through GAL.

## 3. Separate scope and topic identity

New discovery scope: `MACRO`, independent of target asset.

Topics are bounded lexical discovery labels attached to canonical NEWS Evidence.
They are not Observation semantics, canonical Event facts, importance, sentiment,
market regime or a confirmed driver. Multiple matched topics are allowed; each URL
occurs once per macro snapshot and retains all matched topic IDs.

Initial topic vocabulary and scope:

| Topic ID | Mechanism to investigate | Required lexical context | Initial geography |
|---|---|---|---|
| CENTRAL_BANK_POLICY | Decisions, guidance, speeches, minutes, projections, intervention | Named central bank plus monetary-policy/rates/guidance action or document | Fed/US, BoJ/Japan, PBoC/China |
| ECONOMIC_RELEASE | Inflation, labor, growth, PMI and credit releases | Approved release family plus economic jurisdiction/institution | US, China, Japan |
| LIQUIDITY_FUNDING | Repo/funding, reserves, QE/QT, liquidity facilities, RRR | Qualified financial/central-bank terms; generic household liquidity is insufficient | US, China, Japan; explicitly global funding where stated |
| FISCAL_TRADE | Treasury issuance/auctions/refunding, fiscal measures, tariffs and sanctions | Sovereign/authority context plus action or issuance terms | US, China, Japan or explicitly cross-border |
| RATES_FX | Treasury/TIPS yields, USD, JPY/CNH market developments | Explicit financial instrument or qualified market context | US rates/USD, Japan JPY, China CNH |
| GEOPOLITICAL_SUPPLY | Conflict or disruption potentially relevant to risk, energy or trade | Named country/region/chokepoint plus conflict/sanctions/shipping/energy-disruption terms | Cross-border; no assertion of impact |

The implementation must freeze actual term groups and matcher version in a focused
read-only qualification checkpoint. These descriptions alone are not a regex spec
or runtime authorization. Negative fixtures must reject Federal Reserve unrelated
uses of `fed`, a sports team named Treasury, household mortgage advertising, generic
political opinion, a film titled War, and gold-medal headlines.

Examples that must qualify without BTC/Gold mention:

- Federal Reserve raises interest rates;
- Bank of Japan announces monetary policy change;
- PBoC cuts reserve requirement ratio;
- US inflation report surprises economists;
- China announces new trade tariffs;
- US Treasury announces refunding auctions;
- Strait of Hormuz shipping disrupted amid military conflict.

No topic automatically attributes a move. A headline about a forecast, opinion or
rumor remains a headline; no rate change, surprise, amount or occurrence is parsed
into an Observation/Event from title text.

## 4. Language and precision boundary

The first qualification should prove bounded English title matching. GDELT's global
or multilingual reach does not imply the RSS titles are all translated or that
P365's matcher has multilingual recall. Unmatched titles must be counted, not
asserted irrelevant. RSS does not provide qualified language classification here;
do not infer a language or claim a per-language recall count from a failed match.

Prefer normalized title text for topic matching; URL paths and source domains retain
provenance but must not alone supply a policy/topic match. This avoids repeating the
observed ordinary-language URL/ticker collision. Institution abbreviations require
explicit token/context guards; country must not be inferred from publisher location.
Retain null/unknown jurisdiction where title evidence is insufficient.

NEWS-QUALITY-001 display rules remain a separate presentation projection. Extraction
must retain raw qualified candidates and matched topics. Display exclusions must
not change source coverage, historical raw totals or candidate lineage.

## 5. Time, coverage and bounds

Reuse provider date semantics `PUBLICATION_OR_FIRST_SEEN` / `UNAVAILABLE`;
`feedLastBuildAt` and derived rolling-15m `feedWindowStartAt` are feed coverage;
P365 `retrievedAt` is knowledge availability. No exact publication/release time is
fabricated. An old provider-dated article discovered now is not a same-minute event.

Distinguish:

- acquisition availability/freshness;
- union of observed feed intervals;
- raw matching candidate count versus retained candidate count;
- per-topic match counts and candidate truncation;
- matcher/language coverage, which is always bounded;
- displayed title count and screening count.

Complete sampling of selected feed intervals never means complete macro-news coverage.
Zero matches means no retained matches under the frozen matcher, not no policy news.
Provider errors, missing intervals and cap hits remain explicit.

Proposed read-only qualification defaults: 30 unique macro candidates per feed build,
hard maximum 100, one RSS fetch shared with existing asset extraction. Counts must
be computed before truncation. Deterministic per-topic round-robin selection must
avoid one topic monopolizing the cap; within each topic preserve RSS order, dedupe
URL globally, and retain all topic matches for a selected URL. The exact policy and
fixtures must be frozen before production. Never turn a cap hit into complete recall.

Qualification must report title/URL lengths and serialized bytes. Overlarge individual
records or output must produce counted exclusions/truncation, not silent loss or
unbounded stored payload. Byte ceilings and persistent candidate limits are not yet
approved: choose them from live volume/storage proof, not an assumed news rate.

## 6. Proposed additive durable boundary — not activated

Use existing `Evidence.kind = NEWS`, `sourceId = gdelt`, existing Market Memory and
HistoricalEvidenceRepository. No new database or Observation classification.

New methodology for a later runtime:

`gdelt-gal-macro-topic-snapshot-v1`

Snapshot scope is MACRO, not `gdeltAsset=MACRO`. Metadata keys must distinguish
`gdeltScope=MACRO`, matcher version and topic IDs from legacy BTC/Gold v1 asset facts.
Use a distinct payload decoder; legacy decoders must not interpret a macro snapshot
as invalid BTC/Gold history or reinterpret an old payload under new rules.

Proposed immutable snapshot identity is a hash of methodology + scope + matcher
version + feedLastBuildAt. Candidate fields retain URL, title, domain, provider date,
provider-date semantics and matched topic IDs. First eligible snapshot Evidence ID
and P365 retrieval become replay lineage. Repeated same-build/matcher snapshots must
be idempotent. No replacement of existing BTC/Gold snapshot IDs, v1 rows or history.

Persist a bounded zero-match snapshot only when acquisition succeeded, so absence
can be distinguished from missing sampling. Forward-only acquisition; no fake
pre-activation backfill. A matcher update gets a new version and cannot retroactively
rewrite what P365 could discover at an earlier cutoff.

Production writes and scheduler activation require measured storage budget first.
At five-minute polling, an unchanged feed build/matcher dedupes; if every poll sees
a new feed build the extra scope could append up to 288 snapshots/day. This is an
operational upper-count bound, not forecasted volume. Measure serialized bytes,
actual new builds, row/index overhead and storage runway before activation. Existing
storage remediation gates remain authoritative; no second cron is authorized here.

## 7. Proposed consumers — not activated

Current Catalyst Wire: render macro-topic candidates alongside existing media and
asset candidates, preserving source roles, chronology, dedupe, uncertainty and
bounded screening. Macro candidates must not be starved by a generic query limit
shared with two asset scopes; qualification must specify bounded scope-owned queries.
No relevance/impact score or causal ranking.

MOVE investigation: query macro NEWS history under the same MOVE `asOf`, evaluate
each feed interval against the investigation window, and retain provider-dated titles
only inside the window. Unknown provider time remains explicitly unknown. No fresh
provider call may explain a historical move.

Expose MACRO topic discovery separately from target-asset discovery, with separate
coverage and raw candidate counts. Merge duplicate article display by URL while
preserving all scope/topic/source Evidence lineage. A macro candidate can appear
in both BTC and Gold investigations without acquiring a causal association.

Scheduled economic Events remain separate. A news headline about an economic release
does not replace canonical scheduled/released/result/expectation evidence. Current
Alpha Vantage headlines cannot be silently injected into historical MOVE replay.

## 8. Implementation sequence and acceptance

1. NEWS-MACRO-001A: this contract/source decision; owner review/merge.
2. NEWS-MACRO-001B: isolated read-only matcher/combined-feed qualification, no writes.
   Require positive/negative fixtures, language limits, exact-head build and live
   count/byte/latency proof from production-compatible execution.
3. NEWS-MACRO-001C: additive durable runtime only after storage-budget proof; verify
   distinct identity, v1 compatibility, zero-match records, idempotency and cutoff.
4. Production activation: reuse existing clock only after owner merge and approval
   of measured storage cost; verify natural acquisition and point-in-time readback.
5. Separate current-wire / MOVE presentation checkpoints over verified durable data.

No claim of complete discovery, confirmed driver, source truth, bullish/bearish,
State/Regime/Risk/Intelligence, trading signal, prediction or trade execution.

Current runtime/repository/Supabase/Vercel configuration mutations in NEWS-MACRO-001A:
**0**. Only this contract and its operational SSOT pointer are proposed for review.
