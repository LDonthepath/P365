import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import { observationSemanticsForSeriesKey } from "../domain/observation-semantics";
import type {
  HistoricalObservationRepository,
  ObservationHistoryQuery,
} from "../repositories/types";
import {
  buildCreditFinancialConditionsReadModel,
} from "./credit-financial-conditions";

function observation(
  id: string,
  domain: Observation["domain"],
  seriesId: string,
  value: number,
  observedAt: string,
  retrievedAt: string,
  quality: Observation["quality"] = "FRESH",
): Observation {
  return {
    id,
    domain,
    subject: seriesId,
    value: String(value),
    observedAt,
    retrievedAt,
    sourceId: "fred",
    quality,
    evidenceId: `evidence-${id}`,
    metadata: {
      seriesId,
      unit: ["VIXCLS", "NFCI", "ANFCI"].includes(seriesId) ? "Index" : "Percent",
      frequency: ["NFCI", "ANFCI"].includes(seriesId) ? "WEEKLY" : "DAILY",
    },
  };
}

class RecordingRepository implements HistoricalObservationRepository {
  readonly queries: ObservationHistoryQuery[] = [];

  constructor(private readonly source: InMemoryObservationRepository) {}

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    this.queries.push(structuredClone(query));
    return this.source.findHistory(query);
  }
}

test("builds qualified 1D/1W/4W credit-condition facts and recomputes query-time freshness", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.saveMany([
    observation("hy-4w", "MACRO", "BAMLH0A0HYM2", 3.40, "2026-09-04", "2026-09-05T14:00:00.000Z"),
    observation("hy-1w", "MACRO", "BAMLH0A0HYM2", 3.02, "2026-09-28", "2026-09-29T14:00:00.000Z"),
    observation("hy-1d", "MACRO", "BAMLH0A0HYM2", 3.10, "2026-10-02", "2026-10-03T14:00:00.000Z"),
    observation("hy-latest", "MACRO", "BAMLH0A0HYM2", 3.12, "2026-10-05", "2026-10-06T14:00:00.000Z", "STALE"),

    observation("ig-4w", "MACRO", "BAMLC0A0CM", 0.92, "2026-09-04", "2026-09-05T14:00:00.000Z"),
    observation("ig-1w", "MACRO", "BAMLC0A0CM", 0.83, "2026-09-28", "2026-09-29T14:00:00.000Z"),
    observation("ig-1d", "MACRO", "BAMLC0A0CM", 0.85, "2026-10-02", "2026-10-03T14:00:00.000Z"),
    observation("ig-latest", "MACRO", "BAMLC0A0CM", 0.84, "2026-10-05", "2026-10-06T14:00:00.000Z"),

    observation("vix-4w", "ASSET", "VIXCLS", 18.0, "2026-09-04", "2026-09-05T14:00:00.000Z"),
    observation("vix-1w", "ASSET", "VIXCLS", 16.07, "2026-09-28", "2026-09-29T14:00:00.000Z"),
    observation("vix-1d", "ASSET", "VIXCLS", 15.31, "2026-10-02", "2026-10-03T14:00:00.000Z"),
    observation("vix-latest", "ASSET", "VIXCLS", 15.52, "2026-10-05", "2026-10-06T14:00:00.000Z"),
  ]);

  const repository = new RecordingRepository(memory);
  const result = await buildCreditFinancialConditionsReadModel(
    repository,
    new Date("2026-10-07T00:00:00.000Z"),
  );

  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;

  assert.deepEqual(
    result.series.map((item) => item.seriesKey),
    ["BAMLH0A0HYM2", "BAMLC0A0CM", "VIXCLS"],
    "T10Y2Y remains exclusively in the existing Rates & Policy slice",
  );

  const hy = result.series.find((item) => item.seriesKey === "BAMLH0A0HYM2");
  const vix = result.series.find((item) => item.seriesKey === "VIXCLS");
  assert.ok(hy);
  assert.ok(vix);

  assert.equal(hy.observationId, "hy-latest");
  assert.equal(hy.acquisitionQuality, "STALE");
  assert.equal(hy.freshness, "FRESH", "dashboard freshness is recomputed at the query cutoff");
  assert.equal(hy.change1d?.predecessorObservationId, "hy-1d");
  assert.ok(Math.abs((hy.change1d?.value ?? 0) - 2) < 1e-9);
  assert.ok(Math.abs((hy.change1w?.value ?? 0) - 10) < 1e-9);
  assert.ok(Math.abs((hy.change4w?.value ?? 0) - (-28)) < 1e-9);
  assert.equal(hy.change4w?.predecessorObservedAt, "2026-09-04");
  assert.equal(hy.change4w?.predecessorRetrievedAt, "2026-09-05T14:00:00.000Z");
  assert.equal(
    hy.change4w?.targetAt,
    "2026-09-07T00:00:00.000Z",
    "4W target is anchored to the latest observation date",
  );

  assert.equal(vix.changeUnit, "INDEX_POINTS");
  assert.ok(Math.abs((vix.change1d?.value ?? 0) - 0.21) < 1e-9);
  assert.ok(Math.abs((vix.change1w?.value ?? 0) - (-0.55)) < 1e-9);
  assert.ok(Math.abs((vix.change4w?.value ?? 0) - (-2.48)) < 1e-9);

  assert.equal(repository.queries.length, 5);
  assert.equal(
    repository.queries.some((query) => query.identity.seriesKey === "T10Y2Y"),
    false,
    "Credit slice must not duplicate T10Y2Y",
  );
  const vixQuery = repository.queries.find((query) => query.identity.seriesKey === "VIXCLS");
  assert.equal(vixQuery?.identity.domain, "ASSET");
  assert.ok(repository.queries
    .filter((query) => query.identity.seriesKey !== "VIXCLS")
    .every((query) => query.identity.domain === "MACRO"));
  assert.ok(repository.queries.every((query) =>
    query.retrievedAtOnOrBefore === "2026-10-07T00:00:00.000Z"
  ));

  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of [
    "bullish",
    "bearish",
    "risk-on",
    "risk-off",
    "regime",
    "recommendation",
    "caused by",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `read model must not emit ${forbidden}`);
  }
});

test("fails a horizon closed when the predecessor is outside existing FRED freshness tolerance", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.saveMany([
    observation("hy-too-old", "MACRO", "BAMLH0A0HYM2", 3.40, "2026-09-20", "2026-09-21T14:00:00.000Z"),
    observation("hy-latest", "MACRO", "BAMLH0A0HYM2", 3.12, "2026-10-05", "2026-10-06T14:00:00.000Z"),
  ]);

  const result = await buildCreditFinancialConditionsReadModel(
    memory,
    new Date("2026-10-07T00:00:00.000Z"),
  );

  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  const hy = result.series.find((item) => item.seriesKey === "BAMLH0A0HYM2");
  assert.ok(hy);
  assert.equal(hy.change1d, null);
  assert.equal(hy.change1w, null);
  assert.equal(hy.change4w, null);
});


test("weekly Chicago Fed NFCI and ANFCI preserve qualified 1W change and as-of cutoff", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.saveMany([
    observation("nfci-prior", "MACRO", "NFCI", -0.510, "2026-09-25", "2026-09-30T13:00:00.000Z"),
    observation("nfci-current", "MACRO", "NFCI", -0.494, "2026-10-02", "2026-10-07T13:00:00.000Z"),
    observation("anfci-prior", "MACRO", "ANFCI", -0.524, "2026-09-25", "2026-09-30T13:00:00.000Z"),
    observation("anfci-current", "MACRO", "ANFCI", -0.504, "2026-10-02", "2026-10-07T13:00:00.000Z"),
    observation("nfci-future-knowledge", "MACRO", "NFCI", 9, "2026-10-02", "2026-10-12T13:00:00.000Z"),
  ]);
  const result = await buildCreditFinancialConditionsReadModel(memory, new Date("2026-10-09T10:00:00.000Z"));
  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  assert.deepEqual(result.series.map((point) => point.seriesKey), ["NFCI", "ANFCI"]);
  for (const point of result.series) {
    assert.equal(point.valueUnit, "INDEX");
    assert.equal(point.cadence, "WEEKLY");
    assert.equal(point.changeUnit, "INDEX_POINTS");
    assert.equal(point.change1d, null, "weekly release cannot be presented as a daily move");
    assert.equal(point.change4w, null);
    assert.equal(point.freshness, "FRESH");
    assert.equal(point.change1w?.predecessorObservedAt, "2026-09-25");
  }
  assert.equal(result.series[0]?.observationId, "nfci-current");
  assert.ok(Math.abs((result.series[0]?.change1w?.value ?? 0) - 0.016) < 1e-9);
  assert.ok(Math.abs((result.series[1]?.change1w?.value ?? 0) - 0.020) < 1e-9);
  for (const key of ["NFCI", "ANFCI"]) {
    assert.deepEqual(observationSemanticsForSeriesKey(key), {
      ontologyVersion: "v0.1",
      marketDomain: "LIQUIDITY_FUNDING",
      informationClass: "DERIVED_METRIC",
      jurisdiction: "US",
      instrument: "INDEX",
      asset: key === "NFCI" ? "FINANCIAL_CONDITIONS" : "ADJUSTED_FINANCIAL_CONDITIONS",
    });
  }
});
