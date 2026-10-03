# P365 Unscheduled News / Catalyst Source Qualification v0.1

**Checkpoint:** NEWS-001B  
**Status:** GDELT GAL CURRENT-15M LIVE-QUALIFIED READ-ONLY / HISTORICAL MOVE-WINDOW COVERAGE MISSING  
**Provider:** GDELT Article List (GAL)  
**Scope:** current BTC/Gold candidate-catalyst discovery only

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

It cannot yet answer:

> What headlines were available at an arbitrary historical 30/60/120-minute move window?

Historical point-in-time replay remains:

`NOT_SUPPORTED_WITHOUT_DURABLE_ACQUISITION`

This is explicit because MOVE detection includes horizons longer than the GAL live window.

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

## 9. Runtime boundary

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

- durable GAL acquisition/history;
- arbitrary historical 30/60/120-minute move-window replay;
- official-source authority verification/ranking;
- article-body semantic analysis;
- attention/tone timeline runtime;
- MOVE-002B integration.
