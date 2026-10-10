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

function sepObservation(
  id: string,
  seriesKey: string,
  value: number,
  observedAt: string,
  retrievedAt: string,
  horizon: string,
): Observation {
  return {
    id,
    domain: "MACRO",
    subject: seriesKey,
    value: String(value),
    observedAt,
    retrievedAt,
    sourceId: "federal-reserve",
    quality: "UNKNOWN",
    evidenceId: `evidence-${id}`,
    metadata: {
      metricId: seriesKey,
      factType: "PUBLISHED_MEDIAN",
      unit: "PERCENT",
      releaseDate: observedAt.slice(0, 10),
      sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomcprojtabl20260916.htm",
      meetingStartDate: "2026-09-15",
      meetingEndDate: "2026-09-16",
      horizon,
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
    sepObservation(
      "sep-june-2026",
      "policy.us.sep.ffr.year_end_2026.median_pct",
      4.3,
      "2026-06-17T18:00:00.000Z",
      "2026-06-17T18:01:00.000Z",
      "YEAR_END_2026",
    ),
    sepObservation(
      "sep-2026",
      "policy.us.sep.ffr.year_end_2026.median_pct",
      4.1,
      "2026-09-16T18:00:00.000Z",
      "2026-10-05T12:30:00.000Z",
      "YEAR_END_2026",
    ),
    sepObservation(
      "sep-2027",
      "policy.us.sep.ffr.year_end_2027.median_pct",
      4.1,
      "2026-09-16T18:00:00.000Z",
      "2026-10-05T12:30:00.000Z",
      "YEAR_END_2027",
    ),
    sepObservation(
      "sep-2028",
      "policy.us.sep.ffr.year_end_2028.median_pct",
      3.9,
      "2026-09-16T18:00:00.000Z",
      "2026-10-05T12:30:00.000Z",
      "YEAR_END_2028",
    ),
    sepObservation(
      "sep-2029",
      "policy.us.sep.ffr.year_end_2029.median_pct",
      3.6,
      "2026-09-16T18:00:00.000Z",
      "2026-10-05T12:30:00.000Z",
      "YEAR_END_2029",
    ),
    sepObservation(
      "sep-longer",
      "policy.us.sep.ffr.longer_run.median_pct",
      3.2,
      "2026-09-16T18:00:00.000Z",
      "2026-10-05T12:30:00.000Z",
      "LONGER_RUN",
    ),
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

  assert.equal(result.sep.status, "OK");
  if (result.sep.status !== "OK") throw new Error("expected SEP OK");
  assert.equal(result.sep.releaseDate, "2026-09-16");
  assert.equal(result.sep.observedAt, "2026-09-16T18:00:00.000Z");
  assert.equal(result.sep.meetingStartDate, "2026-09-15");
  assert.equal(result.sep.meetingEndDate, "2026-09-16");
  assert.deepEqual(
    result.sep.points.map((item) => [item.horizon, item.valuePct]),
    [
      ["YEAR_END_2026", 4.1],
      ["YEAR_END_2027", 4.1],
      ["YEAR_END_2028", 3.9],
      ["YEAR_END_2029", 3.6],
      ["LONGER_RUN", 3.2],
    ],
    "latest SEP release must replace the older June path without recomputing medians",
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

  assert.equal(repository.queries.length, 16, "8 Rates reads plus 7 SEP reads and one shared DXY history");
  assert.ok(repository.queries.filter((query) => query.identity.seriesKey !== "dxy.index.usd").every((query) => query.identity.domain === "MACRO"));
  assert.ok(repository.queries.every((query) => query.retrievedAtOnOrBefore === "2026-10-06T00:00:00.000Z"));
  const sepQueries = repository.queries.filter((query) => query.identity.seriesKey.startsWith("policy.us.sep.ffr."));
  const ratesQueries = repository.queries.filter((query) => !query.identity.seriesKey.startsWith("policy.us.sep.ffr."));
  assert.equal(sepQueries.length, 7);
  assert.ok(sepQueries.every((query) => query.sourceId === "federal-reserve"));
  assert.ok(sepQueries.every((query) => query.limit === 8));
  assert.ok(sepQueries.every((query) => query.observedAtOnOrAfter === undefined), "latest SEP must remain readable between quarterly releases");
  assert.ok(ratesQueries.every((query) => query.limit === 100));

  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ["bullish", "bearish", "hawkish", "dovish", "risk-on", "risk-off", "regime", "recommendation", "caused by"]) {
    assert.equal(serialized.includes(forbidden), false, `read model must not emit ${forbidden}`);
  }
});
