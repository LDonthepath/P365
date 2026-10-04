# P365 Unscheduled News / Catalyst Source Qualification v0.1

**Checkpoint:** NEWS-001B + NEWS-001C + NEWS-001D  
**Status:** CURRENT-15M LIVE-QUALIFIED / DURABLE SNAPSHOT PRODUCTION-ACTIVE / FORWARD HISTORY ACCUMULATING  
**Provider:** GDELT Article List (GAL)  
**Scope:** current candidate discovery plus forward-only durable BTC/Gold feed-snapshot history

## 1. Product question

This checkpoint addresses the P0 question:

> Was there newly discovered information near the current market move that may be relevant
> enough to investigate as a candidate catalyst?

It does not determine that any article caused the move.

## 2. Provider decision

GDELT remains the approved free-first provider, but the runtime surface is **not** DOC 2.0.

The initial DOC API live proof from Vercel reproduced GDELT's documented API rate limiting:

- HTTP 429;
- provider message explicitly requested at most one request every five seconds;
- a later single-query attempt remained unreliable from shared Vercel egress.

P365 therefore does not use DOC 2.0 as a hot-path dependency.

Primary runtime surface:

`https://data.gdeltproject.org/gdeltv3/gal/feed.rss`

GDELT documents this feed as:

- an RSS feed of all monitored article URLs;
- updated every 60 seconds;
- containing a rolling 15-minute window;
- intended for ingestion/archival-style workflows.

The static GAL feed was reachable from the P365 Vercel preview environment:

- HTTP 200;
- `application/rss+xml`;
- approximately 782 KB during the proof;
- feed supplied `lastBuildDate`, article `title`, `link`, and `pubDate`.

## 3. Coverage boundary

The live GAL feed covers only the provider's current rolling 15-minute discovery window.

Therefore NEWS-001B can answer:

> What BTC/Gold-related candidate headlines are present in GDELT's current rolling
> 15-minute feed?

NEWS-001B by itself cannot answer:

> What headlines were available at an arbitrary historical 30/60/120-minute move window?

That current-only output therefore correctly retains:

`NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION`

NEWS-001C/001D add the separate durable path. Historical point-in-time replay is now possible
**only for windows covered after production activation**. Pre-activation periods remain
unavailable and are never reconstructed from the current rolling feed.

## 4. Candidate extraction

The GAL feed contains the global article firehose rather than a query result. P365 filters
locally.

BTC candidate terms:

- Bitcoin;
- BTC.

Generic `crypto` / `cryptocurrency` alone is not sufficient. Live proof showed that a
broad crypto term admits unrelated altcoin/product pages into the BTC catalyst set.

Gold candidates require:

- Gold / XAU / bullion;
- plus market context for generic `gold` titles, such as price, market, futures, ETF,
  rates, dollar, yield, trading, investors, central bank, safe haven, or common price-move
  language.

Obvious non-market phrases such as `gold medal` are excluded.

This title/URL filter is a discovery heuristic only. It is not semantic classification,
importance scoring, sentiment, or causality.

## 5. Timestamp semantics

GAL documentation states its article date is the publication timestamp when the article
exposes an exact publication time (roughly 30% of articles), otherwise it is when GDELT
saw the article.

P365 therefore labels item time:

`PUBLICATION_OR_FIRST_SEEN`

If an RSS item has no valid `pubDate`, the article remains a candidate but time semantics
are:

`UNAVAILABLE`

The provider feed itself supplies `lastBuildDate`. P365 derives:

`feedWindowStartAt = feedLastBuildAt - 15 minutes`

This expresses provider feed coverage, not exact article publication.

## 6. Read-only evidence contract

Methodology:

`gdelt-gal-current-candidate-catalyst-v1`

Output retains:

- BTC or GOLD asset target;
- feed last-build time;
- rolling feed window start;
- retrieval time;
- candidate title;
- URL;
- source domain;
- provider article date where available;
- provider-date semantics;
- explicit evidence state.

Evidence states:

- `CANDIDATES_AVAILABLE`;
- `NO_CANDIDATES`;
- `PROVIDER_UNAVAILABLE`.

Every output retains:

`causalAttribution = NOT_EVALUATED`

## 7. DOC API and attention timeline

GDELT DOC 2.0 remains semantically useful for bounded search and 15-minute attention
timelines, but it is **not** activated in this hot path because current Vercel shared-egress
rate behavior is not sufficiently reliable.

NEWS-001B therefore does not claim:

- historical move-window ArticleList coverage;
- TimelineVolRaw attention metrics;
- tone/sentiment evidence.

Those may be revisited through a different operational path or after durable GAL
acquisition exists.

## 8. Licensing / use

GDELT states its released datasets are available for unlimited and unrestricted academic,
commercial, and governmental use without fee, with attribution to the GDELT Project.

This makes GAL materially more compatible with P365's data-governance needs than providers
whose free tiers prohibit production analytics or independent storage.

NEWS-001B itself remains read-only and does not activate persistence.

## 9. NEWS-001B current-runtime boundary

This section records the original NEWS-001B boundary. NEWS-001C/001D later authorize the separate durable Evidence lane and Supabase scheduler activation described in sections 13–14.

Authorized:

- public read-only GAL RSS acquisition;
- one current rolling-15m feed fetch;
- local BTC/Gold candidate filtering;
- exact feed coverage metadata;
- URL deduplication;
- malformed individual feed rows are skipped and counted instead of failing the whole feed;
- source-domain provenance;
- provider-date semantics;
- explicit current-only replay limitation;
- focused tests;
- temporary preview proof.

Not authorized:

- persistence;
- Supabase cron;
- historical feed reconstruction;
- DOC API hot-path polling;
- GDELT attention/tone metrics;
- article-body scraping;
- automatic source-authority ranking;
- MOVE-002B wiring;
- UI;
- causal attribution;
- State / Regime / Risk / Intelligence;
- trading signals.

## 10. Acceptance gate

Technical qualification requires:

1. static GAL feed reachable from Vercel without credential;
2. feed last-build time parses;
3. rolling 15-minute coverage is explicit;
4. BTC candidate filtering works on live feed;
5. duplicate URLs do not create duplicate candidates;
6. missing item timestamps do not get fabricated;
7. provider failure remains explicit;
8. exact-head build succeeds;
9. writes performed = 0.


## 11. Live proof — 4 Oct 2026

The P365 Vercel preview executed the final Bitcoin-specific GAL runtime successfully.

Observed proof snapshot:

- provider status = `SUCCESS`;
- writes performed = false;
- feed last-build time = `2026-10-03T20:47:00.000Z`;
- derived feed-window start = `2026-10-03T20:32:00.000Z`;
- feed coverage = `ROLLING_15_MINUTES`;
- total RSS items = `2,898`;
- Bitcoin-specific candidates returned by the narrowed filter = `1`;
- candidate source domain in that snapshot = `www.onvista.de`;
- candidate provider date = `2026-10-03T20:46:00.000Z`;
- provider-date semantics = `PUBLICATION_OR_FIRST_SEEN`;
- causal attribution = `NOT_EVALUATED`;
- historical point-in-time replay = `NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION`.

An earlier broad-filter proof admitted unrelated generic crypto/altcoin pages. The final
runtime therefore requires explicit `Bitcoin` or `BTC` matching rather than generic
`crypto` wording alone.

A separate live proof also exposed at least one malformed RSS item with an empty title.
The final parser skips and counts malformed individual rows while retaining strict feed
structure and `lastBuildDate` validation.

These proof values describe one live feed snapshot only. They are not a claim that the
candidate article caused any BTC move.

## 12. Acceptance result

**Technical qualification: PASS for current rolling-15-minute candidate-catalyst discovery.**

Qualified now:

- credential-free static GAL acquisition from Vercel;
- explicit rolling 15-minute coverage;
- Bitcoin-specific and Gold-market candidate filtering;
- URL/domain provenance;
- conservative publication-or-first-seen time semantics;
- malformed-row tolerance with explicit accounting;
- candidate/no-candidate/provider-unavailable states;
- non-causal evidence semantics.

Still missing:

- pre-activation GAL history; no backfill is claimed or fabricated;
- MOVE-window replay for periods not covered by accumulated forward snapshots;
- official-source authority verification/ranking;
- article-body semantic analysis;
- attention/tone timeline runtime;
- MOVE-002B historical-Evidence integration.


## 13. NEWS-001C Durable GAL Snapshot Runtime

NEWS-001C closes the code/runtime side of the historical replay gap without introducing
another provider or another database table.

### 13.1 Acquisition shape

The provider adapter now supports one GAL RSS fetch that derives both:

- BTC candidate snapshot;
- Gold candidate snapshot.

This prevents two downloads of the same global feed per scheduler cycle.

The existing single-asset function remains available for current read-only callers.

### 13.2 Durable canonical shape

NEWS-001C persists **feed snapshots as canonical NEWS Evidence**, not fake numeric
Observations and not synthetic economic Events.

Methodology:

`gdelt-gal-durable-snapshot-v1`

One Evidence row represents one:

`asset + feedLastBuildAt`

identity.

Each row retains:

- asset: BTC or GOLD;
- feed last-build time;
- feed rolling-window start;
- retrieval time;
- rolling-15m coverage semantics;
- total feed item count;
- invalid-row count;
- candidate count;
- full candidate title/URL/domain/providerDate payload;
- source `gdelt`;
- `kind = NEWS`.

For the Evidence row itself:

`releasedAt = feedLastBuildAt`

because the canonical object is the **provider feed snapshot**. This must not be confused with
an article publication timestamp.

Individual article dates remain inside the snapshot payload with the existing
`PUBLICATION_OR_FIRST_SEEN / UNAVAILABLE` semantics.

### 13.3 Why snapshots, not article-only rows

Persisting only matching articles would lose an important factual distinction:

- no matching headline existed in the sampled feed;
- versus
- P365 never sampled that interval.

NEWS-001C therefore also stores valid snapshots containing **zero candidates**.

This preserves feed coverage/absence evidence for later MOVE replay.

### 13.4 Idempotency

Canonical Evidence ID is deterministic from:

`asset + feedLastBuildAt`

The Market Memory Evidence effective time is the source feed build time.

Repeated polling of the same GDELT feed build therefore resolves to the same canonical
snapshot identity and does not create a second logical snapshot.

A later feed build creates a new immutable Evidence record.

### 13.5 Historical Evidence repository

NEWS-001C adds a canonical point-in-time Evidence history contract and Supabase adapter.

Queries can be bounded by:

- source;
- Evidence kind;
- effective-time range;
- `retrievedAt <= asOf`;
- exact string metadata filters such as asset/methodology;
- ASC/DESC order;
- bounded limit.

The adapter fails closed if Supabase returns a row outside the requested canonical filters.

This is the repository boundary that a later MOVE-news replay checkpoint can consume; MOVE code
must not issue ad-hoc Supabase JSON queries.

### 13.6 Historical ingestion lane

Existing authenticated historical ingestion gains:

`provider = gdelt`

with **FORWARD only** semantics.

Each successful cycle:

1. downloads GAL once;
2. derives BTC + Gold snapshots;
3. normalizes them into two NEWS Evidence records;
4. writes through the existing canonical Evidence repository.

No GDELT BACKFILL mode is introduced because GAL itself exposes only the current rolling
15-minute feed. NEWS-001C must not pretend it can reconstruct time before durable acquisition
started.

### 13.7 Production activation boundary

NEWS-001D activates the already-merged NEWS-001C runtime without creating a second scheduler.

Existing Supabase job:

- job name: `p365-market-fast`;
- job id: `2`;
- cadence: `2-57/5 * * * *`;
- owner: Supabase `pg_cron`.

The existing provider list was extended from:

`coingecko,gold,dxy,usdjpy,usdcnh`

to:

`coingecko,gold,dxy,usdjpy,usdcnh,gdelt`

using `cron.schedule` on the same job name. No direct `cron.job` mutation and no duplicate job
were created.

Production activation proof on 4 Oct 2026:

- manual authenticated request id `34068`: HTTP 200 / overall `SUCCESS`;
- GDELT provider: `SUCCESS`, acquired 2 snapshots, normalized 2, persistedEvidence 2;
- first durable feed build: `2026-10-04T11:47:00.000Z`;
- BTC snapshot: 3 matching/retained candidates, `COMPLETE`;
- Gold snapshot: 0 matching candidates, `COMPLETE`;
- repeated request id `34069`: HTTP 200 / `SUCCESS`;
- row count after repeated same-build polling remained exactly 2 rows / 1 feed build / 2 assets;
- first natural recurring run after activation: cron run `34088` at
  `2026-10-04T11:57:00Z`, request id `34070`, HTTP 200 / `SUCCESS`;
- natural run retained the same 2 logical rows while the provider feed build remained unchanged;
- Vercel runtime errors after manual + natural runs: 0.

Point-in-time readback was also verified for the first durable snapshot:

- cutoff before retrieval (`2026-10-04T11:56:00Z`) => 0 rows;
- cutoff after retrieval (`2026-10-04T11:57:00Z`) => 2 rows: BTC + GOLD.

Therefore:

`DURABLE_GDELT_FORWARD_ACQUISITION = PRODUCTION_ACTIVE`

This does **not** create history before activation. Historical MOVE replay is available only for
windows covered by accumulated forward snapshots.

### 13.8 Still not authorized

NEWS-001C still does not add:

- DOC 2.0 hot-path polling;
- article-body scraping;
- tone/sentiment scoring;
- automatic source authority ranking;
- generated causal explanation;
- MOVE-002B integration;
- UI;
- State / Regime / Risk / Intelligence;
- trading signals.

`causalAttribution = NOT_EVALUATED` remains unchanged.


## 14. NEWS-001D Production Activation

NEWS-001D closes the production-acquisition gate for durable unscheduled-catalyst snapshots.

### 14.1 Scheduler ownership

P365 reuses `p365-market-fast`; it does not create a GDELT-specific scheduler.

This preserves one fast-market acquisition owner and avoids overlapping fetches.

### 14.2 First durable snapshot

First production Evidence pair:

`feedLastBuildAt = 2026-10-04T11:47:00.000Z`

BTC:

- candidateCoverage = `COMPLETE`;
- matchingCandidateCount = 3;
- candidateCount = 3.

Gold:

- candidateCoverage = `COMPLETE`;
- matchingCandidateCount = 0;
- candidateCount = 0.

The zero-candidate Gold snapshot is intentional evidence of sampled absence, not missing data.

### 14.3 Idempotency proof

Three successful acquisitions observed the same provider feed build:

- manual request `34068`;
- manual request `34069`;
- natural cron request `34070`.

Market Memory remained:

- 2 GDELT durable rows;
- 1 distinct feed build;
- 2 distinct assets.

This proves deterministic `asset + feedLastBuildAt` identity and Market Memory dedupe behavior.

### 14.4 Point-in-time replay proof

The same first snapshot was invisible before P365 retrieval and visible after retrieval:

- `retrievedAt <= 11:56:00Z` => 0;
- `retrievedAt <= 11:57:00Z` => BTC + GOLD.

Therefore future MOVE replay can preserve what P365 actually knew at the target cutoff.

### 14.5 Remaining boundary

Production acquisition is active **forward only**.

NEWS-001D does not authorize:

- historical reconstruction before 4 Oct 2026 activation;
- article-body scraping;
- tone/sentiment scoring;
- source-authority ranking;
- causal attribution;
- State / Regime / Risk / Intelligence;
- trading semantics.

The next news-specific product step is repository-backed MOVE integration once the requested MOVE
window falls inside accumulated durable coverage.
