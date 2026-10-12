import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readDurableDashboardData, type DurableDashboardRepositories } from "./durable-dashboard-read";
import type { Observation, Evidence, Event } from "../domain/types";

const AS_OF = new Date("2026-10-11T10:00:00.000Z");

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: "o-btc", domain: "ASSET", subject: "btc.spot.usd", value: "65000",
    observedAt: "2026-10-11T09:58:00.000Z", retrievedAt: "2026-10-11T09:59:00.000Z",
    sourceId: "coingecko-market", quality: "FRESH", evidenceId: "ev-btc",
    metadata: { metricId: "btc.spot.usd" }, ...overrides,
  };
}

function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: "ev-news", sourceId: "alpha-vantage", kind: "NEWS",
    subject: "Judul sumber", content: "Isi berita yang tersedia",
    capturedAt: "2026-10-11T09:50:00.000Z",
    retrievedAt: "2026-10-11T09:50:00.000Z",
    publishedAt: "2026-10-11T09:40:00.000Z",
    metadata: { url: "https://example.com/news", category: "macro", source: "Alpha Vantage" },
    ...overrides,
  };
}

function repositories(input: {
  observations?: Observation[];
  news?: Evidence[];
  events?: Event[];
  failSource?: string;
  failSeries?: string;
} = {}) {
  const reads: string[] = [];
  const repo: DurableDashboardRepositories = {
    observations: {
      async findHistory(query) {
        reads.push("obs:" + query.sourceId + ":" + query.identity.seriesKey);
        if (query.sourceId === input.failSource || query.identity.seriesKey === input.failSeries) throw new Error("database unavailable");
        // Deliberately return future records in some fixtures to test reader-side protection.
        return (input.observations ?? []).filter((item) =>
          item.sourceId === query.sourceId &&
          item.domain === query.identity.domain &&
          (item.metadata?.metricId === query.identity.seriesKey ||
            item.metadata?.seriesId === query.identity.seriesKey));
      },
    },
    evidence: {
      async findHistory(query) {
        reads.push("evidence:" + query.sourceId);
        if (query.sourceId === input.failSource) throw new Error("database unavailable");
        return (input.news ?? []).filter((item) => item.sourceId === query.sourceId);
      },
    },
    events: {
      async findHistory() {
        reads.push("event-history");
        return input.events ?? [];
      },
    },
  };
  return { repo, reads };
}

test("G2-01: dashboard request does not import provider ingestion, normalize live feed or canonical writer", () => {
  const source = readFileSync(new URL("./dashboard-query.ts", import.meta.url), "utf8");
  assert.match(source, /readDurableDashboardData\(asOf/);
  assert.doesNotMatch(source, /ingestDashboardData|normalizeDashboardData\(|canonicalRepositories|fetch[A-Z]/);
  assert.doesNotMatch(readFileSync(new URL("./durable-dashboard-read.ts", import.meta.url), "utf8"),
    /from ["']\.\.\/ingestion\/|from ["']\.\.\/data\/(?:alpha-vantage|fred|crypto-market|yahoo-finance-markets)/);
});

test("G2-01: no provider call or write, BTC/Gold/FRED come only from canonical durable rows", async () => {
  const fred = observation({
    id: "o-fred", subject: "US 10Y yield", domain: "MACRO", value: "4.3",
    observedAt: "2026-10-10", retrievedAt: "2026-10-10T13:00:00.000Z",
    sourceId: "fred", metadata: { seriesId: "DGS10", observationDate: "2026-10-10" },
  });
  const gold = observation({
    id: "o-gold", subject: "gold.futures.usd", sourceId: "yahoo-finance",
    metadata: { metricId: "gold.futures.usd" },
  });
  const { repo, reads } = repositories({ observations: [observation(), gold, fred] });
  const data = await readDurableDashboardData(AS_OF, repo);
  assert.equal(data.observations.find((o) => o.subject === "btc.spot.usd")?.value, "65000");
  assert.equal(data.observations.find((o) => o.subject === "gold.futures.usd")?.sourceId, "yahoo-finance");
  assert.equal(data.macroObservations.find((o) => o.metadata?.seriesId === "DGS10")?.value, "4.3");
  assert.equal(data.observations.length, 3);
  assert.ok(reads.every((name) => name.startsWith("obs:") || name.startsWith("evidence:") || name === "event-history"));
  assert.ok(reads.some((name) => name === "obs:fred:DGS10"));
  assert.equal(data.providerHealth.find((p) => p.sourceId === "coingecko-market")?.fetchedAt,
    "2026-10-11T09:59:00.000Z"); // last stored provider retrieval, not dashboard render
  assert.equal(data.economicEventResults.length, 0); // never fabricate an unsourced consensus
});

test("G2-01: never display future-retrieved, future-observed, wrong-source or malformed rows", async () => {
  const invalid = [
    observation({ id: "future-fetched", retrievedAt: "2026-10-12T00:00:00.000Z" }),
    observation({ id: "future-observed", observedAt: "2026-10-12T00:00:00.000Z" }),
    observation({ id: "bad-time", observedAt: "INVALID" }),
    observation({ id: "wrong-metric", metadata: { metricId: "eth.spot.usd" } }),
  ];
  const { repo } = repositories({ observations: invalid });
  const data = await readDurableDashboardData(AS_OF, repo);
  assert.equal(data.observations.length, 0);
  assert.equal(data.providerHealth.find((p) => p.sourceId === "coingecko-market")?.status, "EMPTY");
  assert.ok(data.unavailableSources.some((x) => x.includes("coingecko-market")));
});

test("G2-01: expired historical price stays available but freshness downgrades to STALE", async () => {
  const { repo } = repositories({ observations: [observation({
    observedAt: "2026-10-11T08:00:00.000Z", retrievedAt: "2026-10-11T08:01:00.000Z",
  })] });
  const data = await readDurableDashboardData(AS_OF, repo);
  assert.equal(data.observations[0]?.quality, "STALE");
  assert.equal(data.providerHealth.find((p) => p.sourceId === "coingecko-market")?.status, "STALE");
});

test("G2-01: history failures fail closed; other providers' durable values survive", async () => {
  const { repo } = repositories({
    observations: [
      observation(),
      observation({ id: "gold", subject: "gold.futures.usd", sourceId: "yahoo-finance",
        metadata: { metricId: "gold.futures.usd" } }),
    ],
    failSource: "yahoo-finance",
  });
  const data = await readDurableDashboardData(AS_OF, repo);
  assert.equal(data.observations.length, 1);
  assert.equal(data.providerHealth.find((p) => p.sourceId === "yahoo-finance")?.status, "ERROR");
  assert.ok(data.unavailableSources.some((x) => x.includes("gagal membaca histori")));
  assert.equal(data.observations[0]?.id, "o-btc");
});

test("G2-01: news and forex-factory calendar can be reconstructed from only persisted evidence", async () => {
  const event: Event = {
    id: "event-1", subject: "US CPI", description: "CPI release", sourceId: "forex-factory",
    scheduledAt: "2026-10-11T12:00:00.000Z", retrievedAt: "2026-10-11T08:00:00.000Z",
    importance: "HIGH", status: "UPCOMING", evidenceId: "ev-calendar", jurisdiction: "US",
  };
  const { repo } = repositories({ news: [evidence()], events: [event] });
  const data = await readDurableDashboardData(AS_OF, repo);
  assert.equal(data.macroNews[0]?.title, "Judul sumber");
  assert.equal(data.calendarEvents[0]?.event, "US CPI");
  assert.equal(data.calendarEvents[0]?.status, "TODAY");
  assert.equal(data.calendarEvents[0]?.time, "19:00");
  assert.equal(data.events[0]?.id, "event-1");
});

test("G2-01: invalid time rejects rather than widening the source visibility cutoff", async () => {
  const { repo } = repositories();
  await assert.rejects(readDurableDashboardData(new Date("invalid"), repo), /valid as-of/);
});


test("RECOVERY-G1-04: Gold repository failure does not mask healthy DXY and Yahoo aggregate fails closed", async () => {
  const dxy = observation({
    id: "dxy", subject: "dxy.index.usd", sourceId: "yahoo-finance",
    observedAt: "2026-10-12T13:58:00.000Z",
    retrievedAt: "2026-10-12T13:59:00.000Z",
    metadata: { metricId: "dxy.index.usd", unit: "USD" },
  });
  const { repo } = repositories({
    observations: [dxy], failSeries: "gold.futures.usd",
  });
  const data = await readDurableDashboardData(new Date("2026-10-12T14:00:00.000Z"), repo);
  assert.equal(data.yahooSeriesHealth?.find((x) => x.seriesKey === "gold.futures.usd")?.status, "ERROR");
  assert.equal(data.yahooSeriesHealth?.find((x) => x.seriesKey === "dxy.index.usd")?.status, "HEALTHY");
  assert.equal(data.yahooSeriesHealth?.find((x) => x.seriesKey === "russell2000.index.usd")?.status, "EMPTY");
  assert.equal(data.providerHealth.find((x) => x.sourceId === "yahoo-finance")?.status, "ERROR");
  assert.ok(data.unavailableSources.some((x) => x.includes("COMEX") && x.includes("gagal")));
  assert.ok(!data.unavailableSources.some((x) => x.includes("DXY (Yahoo")));
  assert.equal(data.observations.find((x) => x.metadata?.metricId === "gold.futures.usd"), undefined);
  assert.equal(data.observations.find((x) => x.metadata?.metricId === "dxy.index.usd")?.id, "dxy");
});

test("RECOVERY-G1-04: empty or stale Gold stays independently disclosed despite healthy DXY", async () => {
  const dxy = observation({
    id: "dxy", subject: "dxy.index.usd", sourceId: "yahoo-finance",
    observedAt: "2026-10-12T13:58:00.000Z",
    retrievedAt: "2026-10-12T13:59:00.000Z",
    metadata: { metricId: "dxy.index.usd" },
  });
  const gold = observation({
    id: "gold", subject: "gold.futures.usd", sourceId: "yahoo-finance",
    observedAt: "2026-10-09T20:00:00.000Z",
    retrievedAt: "2026-10-09T20:01:00.000Z",
    metadata: { metricId: "gold.futures.usd" },
  });
  const { repo } = repositories({ observations: [dxy, gold] });
  const data = await readDurableDashboardData(new Date("2026-10-12T14:00:00.000Z"), repo);
  assert.equal(data.yahooSeriesHealth?.find((x) => x.seriesKey === "dxy.index.usd")?.status, "HEALTHY");
  assert.notEqual(data.yahooSeriesHealth?.find((x) => x.seriesKey === "gold.futures.usd")?.status, "HEALTHY");
  assert.notEqual(data.providerHealth.find((x) => x.sourceId === "yahoo-finance")?.status, "HEALTHY");
  assert.ok(data.unavailableSources.some((x) => x.includes("COMEX")));
});

test("RECOVERY-G1-06: typed durable projection retains stored quality separately from evaluated freshness", async () => {
  const raw = observation({
    id: "historic-btc",
    observedAt: "2026-10-11T08:00:00.000Z",
    retrievedAt: "2026-10-11T08:01:00.000Z",
  });
  const { repo } = repositories({ observations: [raw] });
  const data = await readDurableDashboardData(AS_OF, repo);
  const diagnostic = data.observationReadQuality?.find((p) => p.observationId === raw.id);
  assert.ok(diagnostic);
  assert.equal(diagnostic.ingestionQuality, "FRESH");
  assert.equal(diagnostic.evaluatedFreshness, "STALE");
  assert.equal(diagnostic.currentContextFitness, "INELIGIBLE");
  assert.equal(diagnostic.historicalReferenceFitness, "ELIGIBLE");
  assert.equal(data.observations[0].quality, "STALE", "legacy display behavior unchanged");
  assert.equal(raw.quality, "FRESH", "repository canonical fact remains untouched");
  assert.equal(data.observationReadQuality?.length, data.observations.length);
});
