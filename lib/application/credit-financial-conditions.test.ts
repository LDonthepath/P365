import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
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
): Observation {
  return {
    id,
    domain,
    subject: seriesId,
    value: String(value),
    observedAt,
    retrievedAt,
    sourceId: "fred",
    quality: "FRESH",
    evidenceId: `evidence-${id}`,
    metadata: {
      seriesId,
      unit: seriesId === "VIXCLS" ? "Index" : "Percent",
      frequency: "DAILY",
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

test("builds factual credit and financial-condition changes without regime semantics", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.saveMany([
    observation("hy-1w", "MACRO", "BAMLH0A0HYM2", 3.28, "2026-09-28", "2026-09-29T14:00:00.000Z"),
    observation("hy-1d", "MACRO", "BAMLH0A0HYM2", 3.18, "2026-10-02", "2026-10-03T14:00:00.000Z"),
    observation("hy-latest", "MACRO", "BAMLH0A0HYM2", 3.12, "2026-10-05", "2026-10-06T14:00:00.000Z"),

    observation("ig-1w", "MACRO", "BAMLC0A0CM", 0.88, "2026-09-28", "2026-09-29T14:00:00.000Z"),
    observation("ig-1d", "MACRO", "BAMLC0A0CM", 0.86, "2026-10-02", "2026-10-03T14:00:00.000Z"),
    observation("ig-latest", "MACRO", "BAMLC0A0CM", 0.84, "2026-10-05", "2026-10-06T14:00:00.000Z"),

    observation("vix-1w", "ASSET", "VIXCLS", 17.1, "2026-09-28", "2026-09-29T14:00:00.000Z"),
    observation("vix-1d", "ASSET", "VIXCLS", 16.2, "2026-10-02", "2026-10-03T14:00:00.000Z"),
    observation("vix-latest", "ASSET", "VIXCLS", 15.52, "2026-10-05", "2026-10-06T14:00:00.000Z"),

    observation("curve-1w", "MACRO", "T10Y2Y", 0.39, "2026-09-28", "2026-09-29T14:00:00.000Z"),
    observation("curve-1d", "MACRO", "T10Y2Y", 0.45, "2026-10-05", "2026-10-05T21:00:00.000Z"),
    observation("curve-latest", "MACRO", "T10Y2Y", 0.48, "2026-10-06", "2026-10-06T21:00:00.000Z"),
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
    ["BAMLH0A0HYM2", "BAMLC0A0CM", "VIXCLS", "T10Y2Y"],
  );

  const hy = result.series.find((item) => item.seriesKey === "BAMLH0A0HYM2");
  const vix = result.series.find((item) => item.seriesKey === "VIXCLS");
  const curve = result.series.find((item) => item.seriesKey === "T10Y2Y");

  assert.ok(hy);
  assert.ok(vix);
  assert.ok(curve);
  assert.ok(Math.abs((hy.change1d ?? 0) - (-6)) < 1e-9);
  assert.ok(Math.abs((hy.change1w ?? 0) - (-16)) < 1e-9);
  assert.ok(Math.abs((vix.change1d ?? 0) - (-0.68)) < 1e-9);
  assert.ok(Math.abs((curve.change1d ?? 0) - 3) < 1e-9);
  assert.equal(vix.changeUnit, "INDEX_POINTS");

  assert.equal(repository.queries.length, 4);
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
