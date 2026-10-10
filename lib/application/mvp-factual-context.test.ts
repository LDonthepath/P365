import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { compareObservationHistory, observationSemanticSeriesKey } from "../repositories/observation-history";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";
import type { NetLiquidityReadModel } from "./net-liquidity";
import type { RatesInflationReadModel } from "./rates-inflation";
import { buildMacroCryptoGoldFactualContext } from "./mvp-factual-context";

const AS_OF = "2026-09-20T13:14:58.000Z";

const ratesInflation: RatesInflationReadModel = {
  status: "UNAVAILABLE",
  reason: "fixture",
  sep: { status: "UNAVAILABLE", reason: "fixture" },
};
const netLiquidity: NetLiquidityReadModel = {
  status: "UNAVAILABLE",
  reason: "fixture",
};

function observation(
  id: string,
  seriesKey: string,
  observedAt: string,
  retrievedAt: string,
  value: number,
  freshnessCalendar: string,
  quality: Observation["quality"] = "FRESH",
): Observation {
  return {
    id,
    domain: "ASSET",
    subject: seriesKey,
    value: String(value),
    observedAt,
    retrievedAt,
    sourceId: seriesKey === "btc.spot.usd" ? "coingecko-market" : "yahoo-finance",
    quality,
    evidenceId: `evidence-${id}`,
    metadata: {
      metricId: seriesKey,
      unit: seriesKey === "dxy.index.usd" ? "Index" : "USD",
      freshnessCalendar,
    },
  };
}

class PointRepository implements HistoricalObservationRepository {
  readonly queries: ObservationHistoryQuery[] = [];
  private readonly observations: Observation[];

  constructor(observations: Observation[]) {
    this.observations = observations;
  }

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    this.queries.push(structuredClone(query));
    const from = query.observedAtOnOrAfter === undefined ? -Infinity : Date.parse(query.observedAtOnOrAfter);
    const through = query.observedAtOnOrBefore === undefined ? Infinity : Date.parse(query.observedAtOnOrBefore);
    const retrievedThrough = query.retrievedAtOnOrBefore === undefined ? Infinity : Date.parse(query.retrievedAtOnOrBefore);
    const rows = this.observations.filter((item) =>
      item.domain === query.identity.domain
      && observationSemanticSeriesKey(item) === query.identity.seriesKey
      && Date.parse(item.observedAt) >= from
      && Date.parse(item.observedAt) <= through
      && Date.parse(item.retrievedAt) <= retrievedThrough
    );
    rows.sort(compareObservationHistory);
    if (query.order === "DESC") rows.reverse();
    return rows.slice(0, query.limit);
  }
}

function shared() {
  return { ratesInflation, netLiquidity };
}

test("builds deterministic point-in-time 1D/1W/4W factual horizons", async () => {
  const rows = [
    observation("btc-4w", "btc.spot.usd", "2026-08-23T11:45:00.000Z", "2026-08-23T11:45:05.000Z", 80, "CONTINUOUS_24_7"),
    observation("btc-1w", "btc.spot.usd", "2026-09-13T11:00:00.000Z", "2026-09-13T11:00:05.000Z", 90, "CONTINUOUS_24_7"),
    observation("btc-1d-before", "btc.spot.usd", "2026-09-19T11:59:00.000Z", "2026-09-19T11:59:05.000Z", 100, "CONTINUOUS_24_7"),
    observation("btc-1d-after", "btc.spot.usd", "2026-09-19T12:01:00.000Z", "2026-09-19T12:01:05.000Z", 101, "CONTINUOUS_24_7"),
    observation("btc-latest-old-revision", "btc.spot.usd", "2026-09-20T12:00:00.000Z", "2026-09-20T12:00:05.000Z", 118, "CONTINUOUS_24_7"),
    observation("btc-latest-revision", "btc.spot.usd", "2026-09-20T12:00:00.000Z", "2026-09-20T12:02:00.000Z", 120, "CONTINUOUS_24_7"),
    observation("btc-late-knowledge", "btc.spot.usd", "2026-09-20T12:30:00.000Z", "2026-09-20T14:00:00.000Z", 130, "CONTINUOUS_24_7"),
    observation("btc-future", "btc.spot.usd", "2026-09-20T14:00:00.000Z", "2026-09-20T14:00:01.000Z", 140, "CONTINUOUS_24_7"),
    observation("gold-latest", "gold.futures.usd", "2026-09-18T20:59:59.000Z", "2026-09-18T21:00:05.000Z", 3700, "CME_GLOBEX_GOLD"),
    observation("dxy-latest", "dxy.index.usd", "2026-09-18T20:59:59.000Z", "2026-09-18T21:00:05.000Z", 97.5, "ICE_USDX"),
  ];
  const repository = new PointRepository(rows);
  const result = await buildMacroCryptoGoldFactualContext(repository, new Date(AS_OF), shared());
  const bitcoin = result.crypto.bitcoin;

  assert.equal(result.asOf, AS_OF);
  assert.equal(bitcoin.status, "AVAILABLE");
  if (bitcoin.status !== "AVAILABLE") return;
  assert.equal(bitcoin.latestValue, 120, "latest revision ordering is observedAt/retrievedAt/id deterministic");
  assert.equal(bitcoin.latestObservedAt, "2026-09-20T12:00:00.000Z");
  assert.equal(bitcoin.latestRetrievedAt, "2026-09-20T12:02:00.000Z");
  assert.equal(bitcoin.change1d?.predecessorValue, 100, "1D selects the latest point on-or-before target");
  assert.equal(bitcoin.change1d?.predecessorObservedAt, "2026-09-19T11:59:00.000Z");
  assert.equal(bitcoin.change1w?.predecessorValue, 90, "1W selects the correct point");
  assert.equal(bitcoin.change4w?.predecessorValue, 80, "4W selects the correct point");
  assert.equal(bitcoin.change4w?.predecessorRetrievedAt, "2026-08-23T11:45:05.000Z");
  assert.equal(bitcoin.recency, "STALE", "old durable BTC does not masquerade as live");

  assert.equal(result.gold.status === "AVAILABLE" ? result.gold.recency : null, "CURRENT", "Gold reuses the qualified closed-session calendar");
  assert.equal(result.macro.dxy.status === "AVAILABLE" ? result.macro.dxy.recency : null, "CURRENT", "DXY reuses the qualified closed-session calendar");

  assert.equal(repository.queries.length, 12, "three series use one latest plus three bounded target queries each");
  assert.ok(repository.queries.every((query) => query.retrievedAtOnOrBefore === AS_OF), "one shared asOf cutoff is used across all horizons");
  assert.ok(repository.queries.every((query) => query.order === "DESC" && query.limit === (query.identity.seriesKey === "dxy.index.usd" && query.observedAtOnOrBefore === AS_OF ? 100 : 1)), "only the shared DXY latest query reads bounded history; horizon queries stay limit=1");
  assert.ok(repository.queries.every((query) => query.observedAtOnOrAfter === undefined), "no four-week range scan is used");
});

test("keeps missing predecessors unavailable instead of fabricating zero change", async () => {
  const repository = new PointRepository([
    observation("btc-latest", "btc.spot.usd", "2026-09-20T13:10:00.000Z", "2026-09-20T13:10:05.000Z", 100, "CONTINUOUS_24_7"),
  ]);
  const result = await buildMacroCryptoGoldFactualContext(repository, new Date(AS_OF), shared());
  const bitcoin = result.crypto.bitcoin;
  assert.equal(bitcoin.status, "AVAILABLE");
  if (bitcoin.status !== "AVAILABLE") return;
  assert.equal(bitcoin.change1d, null);
  assert.equal(bitcoin.change1w, null);
  assert.equal(bitcoin.change4w, null);
});

test("fails recency closed when the persisted freshness calendar is missing or invalid", async () => {
  const repository = new PointRepository([
    observation("btc-invalid-calendar", "btc.spot.usd", "2026-09-20T13:10:00.000Z", "2026-09-20T13:10:05.000Z", 100, "NOT_QUALIFIED"),
    observation("gold-missing-calendar", "gold.futures.usd", "2026-09-18T20:59:59.000Z", "2026-09-18T21:00:05.000Z", 3700, ""),
    observation("dxy-wrong-calendar", "dxy.index.usd", "2026-09-18T20:59:59.000Z", "2026-09-18T21:00:05.000Z", 97.5, "CONTINUOUS_24_7"),
  ]);
  const result = await buildMacroCryptoGoldFactualContext(repository, new Date(AS_OF), shared());
  assert.equal(result.crypto.bitcoin.status === "AVAILABLE" ? result.crypto.bitcoin.recency : null, "UNKNOWN");
  assert.equal(result.gold.status === "AVAILABLE" ? result.gold.recency : null, "UNKNOWN");
  assert.equal(result.macro.dxy.status === "AVAILABLE" ? result.macro.dxy.recency : null, "UNKNOWN");
});

test("read-model output contains facts and no interpretation labels", async () => {
  const repository = new PointRepository([
    observation("btc-latest", "btc.spot.usd", "2026-09-20T13:10:00.000Z", "2026-09-20T13:10:05.000Z", 100, "CONTINUOUS_24_7"),
  ]);
  const result = await buildMacroCryptoGoldFactualContext(repository, new Date(AS_OF), shared());
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ["bullish", "bearish", "risk-on", "risk-off", "supportive", "restrictive", "causal", "recommendation"]) {
    assert.equal(serialized.includes(forbidden), false, `output must not contain ${forbidden}`);
  }
});
