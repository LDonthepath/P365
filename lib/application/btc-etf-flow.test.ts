import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";
import { buildBtcEtfFlowReadModel, BTC_ETF_FLOW_HISTORY_QUERY_LIMIT } from "./btc-etf-flow";

function observation(
  id: string,
  date: string,
  value: number,
  retrievedAt: string,
  measurementId = `measurement-${date}`,
): Observation {
  return {
    id,
    domain: "MARKET",
    subject: "crypto.us_spot_btc_etf_net_flow.usd",
    value: String(value),
    observedAt: `${date}T00:00:00.000Z`,
    retrievedAt,
    sourceId: "sosovalue-etf-flow",
    quality: "UNKNOWN",
    evidenceId: `evidence-${id}`,
    identity: {
      version: "v1",
      seriesKey: "crypto.us_spot_btc_etf_net_flow.usd",
      measurementId,
      revisionFingerprint: id.padEnd(64, "0").slice(0, 64),
    },
    metadata: { metricId: "crypto.us_spot_btc_etf_net_flow.usd", providerTradingDate: date, unit: "USD" },
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

test("returns the latest revision for five actual sessions at an asOf cutoff", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.saveMany([
    observation("d29-original", "2026-09-29", 100, "2026-09-30T01:00:00.000Z"),
    observation("d29-correction", "2026-09-29", 105, "2026-10-01T01:00:00.000Z"),
    observation("d29-future", "2026-09-29", 999, "2026-10-03T01:00:00.000Z"),
    observation("d26", "2026-09-26", -10, "2026-09-27T01:00:00.000Z"),
    observation("d25", "2026-09-25", 20, "2026-09-26T01:00:00.000Z"),
    observation("d24", "2026-09-24", 30, "2026-09-25T01:00:00.000Z"),
    observation("d23", "2026-09-23", 40, "2026-09-24T01:00:00.000Z"),
    observation("d22", "2026-09-22", 50, "2026-09-23T01:00:00.000Z"),
    observation("future-session", "2026-10-03", 700, "2026-10-01T02:00:00.000Z"),
    { ...observation("other-source", "2026-09-30", 800, "2026-10-01T02:00:00.000Z"), sourceId: "other" },
  ]);
  const repository = new RecordingRepository(memory);
  const result = await buildBtcEtfFlowReadModel(repository, new Date("2026-10-02T00:00:00.000Z"));

  assert.equal(result.latest?.providerTradingDate, "2026-09-29");
  assert.equal(result.latest?.value, 105, "latest factual revision eligible at asOf wins");
  assert.equal(result.previous?.providerTradingDate, "2026-09-26", "previous means previous actual session");
  assert.deepEqual(result.recent.map((point) => point.providerTradingDate), [
    "2026-09-29", "2026-09-26", "2026-09-25", "2026-09-24", "2026-09-23",
  ]);
  assert.equal(result.recent.length, 5);
  assert.equal(repository.queries.length, 1, "read model performs one repository-only bounded query");
  assert.deepEqual(repository.queries[0], {
    identity: { domain: "MARKET", seriesKey: "crypto.us_spot_btc_etf_net_flow.usd" },
    sourceId: "sosovalue-etf-flow",
    observedAtOnOrBefore: "2026-10-02T00:00:00.000Z",
    retrievedAtOnOrBefore: "2026-10-02T00:00:00.000Z",
    order: "DESC",
    limit: BTC_ETF_FLOW_HISTORY_QUERY_LIMIT,
  });
});

test("excludes later revisions at earlier asOf and leaves missing history explicit", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.saveMany([
    observation("original", "2026-09-29", 100, "2026-09-30T01:00:00.000Z"),
    observation("correction", "2026-09-29", 105, "2026-10-01T01:00:00.000Z"),
  ]);
  const earlier = await buildBtcEtfFlowReadModel(memory, new Date("2026-09-30T12:00:00.000Z"));
  assert.equal(earlier.latest?.value, 100);
  assert.equal(earlier.previous, null);
  assert.equal(earlier.recent.length, 1, "revisions never count as sessions");

  const empty = await buildBtcEtfFlowReadModel(new InMemoryObservationRepository(), new Date("2026-09-30T12:00:00.000Z"));
  assert.equal(empty.latest, null);
  assert.equal(empty.previous, null);
  assert.deepEqual(empty.recent, []);
});

test("fails closed when the bounded page is saturated by too few measurement sessions", async () => {
  const revisions = Array.from({ length: BTC_ETF_FLOW_HISTORY_QUERY_LIMIT }, (_, index) =>
    observation(`revision-${index}`, "2026-09-29", index, `2026-09-30T${String(index % 24).padStart(2, "0")}:00:00.000Z`));
  const repository: HistoricalObservationRepository = {
    findHistory: async () => revisions,
  };
  await assert.rejects(
    buildBtcEtfFlowReadModel(repository, new Date("2026-10-02T00:00:00.000Z")),
    /cannot prove a complete five-session view/,
  );
});
