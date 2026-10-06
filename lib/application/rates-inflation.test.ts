import assert from "node:assert/strict";
import test from "node:test";
import type { Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import type {
  HistoricalObservationRepository,
  ObservationHistoryQuery,
} from "../repositories/types";
import { buildRatesInflationReadModel } from "./rates-inflation";

function observation(
  id: string,
  seriesId: string,
  value: number,
  observedAt: string,
  retrievedAt: string,
  unit: string,
  frequency: "DAILY" | "WEEKLY",
  quality: Observation["quality"] = "FRESH",
): Observation {
  return {
    id,
    domain: "MACRO",
    subject: seriesId,
    value: String(value),
    observedAt,
    retrievedAt,
    sourceId: "fred",
    quality,
    evidenceId: `evidence-${id}`,
    metadata: {
      seriesId,
      unit,
      frequency,
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

function point(
  result: Awaited<ReturnType<typeof buildRatesInflationReadModel>>,
  key: string,
) {
  assert.equal(result.status, "OK");
  if (result.status !== "OK") throw new Error("expected OK");
  const item = result.series.find((candidate) => candidate.seriesKey === key);
  assert.ok(item, `missing ${key}`);
  return item;
}

test("builds factual Rates & Policy latest/1D/1W facts without regime semantics", async () => {
  const memory = new InMemoryObservationRepository();
  await memory.saveMany([
    observation("effr-1w", "EFFR", 3.90, "2026-09-25", "2026-09-26T13:00:00.000Z", "Percent", "DAILY"),
    observation("effr-1d", "EFFR", 3.88, "2026-10-01", "2026-10-02T13:00:00.000Z", "Percent", "DAILY"),
    observation("effr-latest", "EFFR", 3.88, "2026-10-02", "2026-10-05T13:00:00.000Z", "Percent", "DAILY"),

    observation("iorb-1w", "IORB", 3.90, "2026-09-25", "2026-09-25T00:30:00.000Z", "Percent", "DAILY"),
    observation("iorb-1d", "IORB", 3.90, "2026-10-01", "2026-10-01T00:30:00.000Z", "Percent", "DAILY"),
    observation("iorb-latest", "IORB", 3.90, "2026-10-05", "2026-10-05T00:30:00.000Z", "Percent", "DAILY"),

    observation("sofr-1w", "SOFR", 3.90, "2026-09-25", "2026-09-26T12:00:00.000Z", "Percent", "DAILY"),
    observation("sofr-1d", "SOFR", 3.87, "2026-10-01", "2026-10-02T12:00:00.000Z", "Percent", "DAILY"),
    observation("sofr-latest", "SOFR", 3.88, "2026-10-02", "2026-10-05T12:00:00.000Z", "Percent", "DAILY"),

    observation("reserve-1w", "WRESBAL", 2900000, "2026-09-23", "2026-09-24T21:00:00.000Z", "Millions of U.S. Dollars", "WEEKLY"),
    observation("reserve-latest", "WRESBAL", 2948090, "2026-09-30", "2026-10-01T21:00:00.000Z", "Millions of U.S. Dollars", "WEEKLY"),

    observation("dgs2-1w", "DGS2", 4.81, "2026-09-25", "2026-09-28T20:00:00.000Z", "Percent", "DAILY"),
    observation("dgs2-1d", "DGS2", 4.78, "2026-10-01", "2026-10-02T20:00:00.000Z", "Percent", "DAILY"),
    observation("dgs2-latest", "DGS2", 4.83, "2026-10-02", "2026-10-05T20:00:00.000Z", "Percent", "DAILY"),

    observation("real-1w", "DFII10", 2.87, "2026-09-25", "2026-09-28T20:00:00.000Z", "Percent", "DAILY"),
    observation("real-1d", "DFII10", 2.88, "2026-10-01", "2026-10-02T20:00:00.000Z", "Percent", "DAILY"),
    observation("real-latest", "DFII10", 2.92, "2026-10-02", "2026-10-05T20:00:00.000Z", "Percent", "DAILY"),

    observation("usd-1w", "DTWEXBGS", 120.50, "2026-09-25", "2026-09-28T20:00:00.000Z", "Index Mar 1973=100", "DAILY"),
    observation("usd-1d", "DTWEXBGS", 121.7882, "2026-10-01", "2026-10-05T20:00:00.000Z", "Index Mar 1973=100", "DAILY"),
    observation("usd-latest", "DTWEXBGS", 121.3848, "2026-10-02", "2026-10-05T20:00:00.000Z", "Index Mar 1973=100", "DAILY"),

    observation("curve-1w", "T10Y2Y", 0.30, "2026-09-25", "2026-09-25T21:00:00.000Z", "Percent", "DAILY"),
    observation("curve-1d", "T10Y2Y", 0.46, "2026-10-01", "2026-10-01T21:00:00.000Z", "Percent", "DAILY"),
    observation("curve-latest", "T10Y2Y", 0.47, "2026-10-05", "2026-10-05T21:00:00.000Z", "Percent", "DAILY"),
  ]);

  const repository = new RecordingRepository(memory);
  const result = await buildRatesInflationReadModel(
    repository,
    new Date("2026-10-06T00:00:00.000Z"),
  );

  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  assert.deepEqual(
    result.series.map((item) => item.seriesKey),
    ["EFFR", "IORB", "SOFR", "SOFR_IORB_SPREAD", "WRESBAL", "DGS2", "DFII10", "DTWEXBGS", "T10Y2Y"],
  );

  const spread = point(result, "SOFR_IORB_SPREAD");
  assert.ok(Math.abs(spread.value - (-2)) < 1e-9, "latest spread is SOFR 3.88 minus same-date-known IORB 3.90");
  assert.ok(Math.abs((spread.change1d ?? 0) - 1) < 1e-9, "spread moves from -3 bps to -2 bps");
  assert.ok(Math.abs((spread.change1w ?? 0) - (-2)) < 1e-9, "spread moves from 0 bps to -2 bps");
  assert.equal(spread.observedAt, "2026-10-02");

  const reserve = point(result, "WRESBAL");
  assert.ok(Math.abs(reserve.value - 2948.09) < 1e-9);
  assert.equal(reserve.change1d, null, "weekly reserve series must not fabricate a 1D delta");
  assert.equal(reserve.change1dFrom, null);
  assert.ok(Math.abs((reserve.change1w ?? 0) - 48.09) < 1e-9);

  const realYield = point(result, "DFII10");
  assert.ok(Math.abs((realYield.change1d ?? 0) - 4) < 1e-9);
  assert.ok(Math.abs((realYield.change1w ?? 0) - 5) < 1e-9);

  const broadUsd = point(result, "DTWEXBGS");
  assert.equal(broadUsd.changeUnit, "PERCENT");
  assert.ok((broadUsd.change1d ?? 0) < 0, "broad USD 1D change is factual percent change");

  assert.equal(repository.queries.length, 8, "one bounded history read per durable source series");
  assert.ok(repository.queries.every((query) => query.identity.domain === "MACRO"));
  assert.ok(repository.queries.every((query) => query.retrievedAtOnOrBefore === "2026-10-06T00:00:00.000Z"));
  assert.ok(repository.queries.every((query) => query.limit === 100));

  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ["bullish", "bearish", "risk-on", "risk-off", "regime", "recommendation", "caused by"]) {
    assert.equal(serialized.includes(forbidden), false, `read model must not emit ${forbidden}`);
  }
});
