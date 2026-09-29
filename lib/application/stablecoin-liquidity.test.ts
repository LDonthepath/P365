import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";
import { buildStablecoinLiquidityReadModel } from "./stablecoin-liquidity";

function observation(
  id: string,
  value: string,
  observedAt: string,
  retrievedAt: string,
  quality: Observation["quality"] = "STALE",
): Observation {
  return {
    id,
    domain: "MARKET",
    subject: "crypto.usd_stablecoin_market_cap.usd",
    value,
    observedAt,
    retrievedAt,
    sourceId: "defillama-stablecoins",
    quality,
    evidenceId: `evidence-${id}`,
    metadata: { metricId: "crypto.usd_stablecoin_market_cap.usd", unit: "USD", pegType: "peggedUSD" },
  };
}

class RecordingRepository implements HistoricalObservationRepository {
  readonly queries: ObservationHistoryQuery[] = [];

  constructor(private readonly source: InMemoryObservationRepository) {}

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    this.queries.push(query);
    return this.source.findHistory(query);
  }
}

test("builds latest/1D/1W/4W stablecoin facts with four bounded point queries", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.saveMany([
    observation("latest-old-revision", "128", "2026-09-29T00:00:00.000Z", "2026-09-29T00:30:00.000Z"),
    observation("latest-current-revision", "130", "2026-09-29T00:00:00.000Z", "2026-09-29T01:00:00.000Z", "STALE"),
    observation("latest-future-revision", "999", "2026-09-29T00:00:00.000Z", "2026-09-29T13:00:00.000Z"),
    observation("future-observation", "999", "2026-09-30T00:00:00.000Z", "2026-09-29T02:00:00.000Z"),
    observation("after-1d-target", "125", "2026-09-28T01:00:00.000Z", "2026-09-29T01:00:00.000Z"),
    observation("one-day", "120", "2026-09-27T23:00:00.000Z", "2026-09-29T01:00:00.000Z"),
    observation("one-week", "100", "2026-09-21T22:00:00.000Z", "2026-09-29T01:00:00.000Z"),
    observation("four-weeks", "80", "2026-08-31T12:00:00.000Z", "2026-09-29T01:00:00.000Z"),
  ]);
  const repository = new RecordingRepository(memory);
  const result = await buildStablecoinLiquidityReadModel(repository, new Date("2026-09-29T12:00:00.000Z"));

  assert.equal(result.asOf, "2026-09-29T12:00:00.000Z");
  assert.equal(result.latest?.value, 130, "latest deterministic revision available by asOf wins");
  assert.equal(result.latest?.retrievedAt, "2026-09-29T01:00:00.000Z");
  assert.equal(result.latest?.acquisitionQuality, "STALE", "persisted acquisition quality stays immutable");
  assert.equal(result.latest?.recency, "CURRENT", "read recency is evaluated independently at asOf");

  assert.equal(result.change1d?.targetAt, "2026-09-28T00:00:00.000Z");
  assert.equal(result.change1d?.predecessor.observedAt, "2026-09-27T23:00:00.000Z");
  assert.equal(result.change1d?.predecessor.retrievedAt, "2026-09-29T01:00:00.000Z");
  assert.equal(result.change1d?.absoluteChange, 10);
  assert.equal(result.change1w?.targetAt, "2026-09-22T00:00:00.000Z");
  assert.equal(result.change1w?.predecessor.observedAt, "2026-09-21T22:00:00.000Z");
  assert.equal(result.change1w?.absoluteChange, 30);
  assert.equal(result.change4w?.targetAt, "2026-09-01T00:00:00.000Z");
  assert.equal(result.change4w?.predecessor.observedAt, "2026-08-31T12:00:00.000Z");
  assert.equal(result.change4w?.absoluteChange, 50);

  assert.equal(repository.queries.length, 4, "read model performs exactly four bounded point queries");
  for (const query of repository.queries) {
    assert.deepEqual(query.identity, { domain: "MARKET", seriesKey: "crypto.usd_stablecoin_market_cap.usd" });
    assert.equal(query.retrievedAtOnOrBefore, "2026-09-29T12:00:00.000Z");
    assert.equal(query.order, "DESC");
    assert.equal(query.limit, 1);
    assert.equal(query.observedAtOnOrAfter, undefined, "point query must not become a range scan");
  }

  const shallowMemory = new InMemoryObservationRepository();
  await shallowMemory.save(observation(
    "only-latest",
    "130",
    "2026-09-29T00:00:00.000Z",
    "2026-09-29T01:00:00.000Z",
  ));
  const shallow = await buildStablecoinLiquidityReadModel(shallowMemory, new Date("2026-09-29T12:00:00.000Z"));
  assert.equal(shallow.change1d, null);
  assert.equal(shallow.change1w, null);
  assert.equal(shallow.change4w, null, "missing predecessor remains null rather than zero");
});
