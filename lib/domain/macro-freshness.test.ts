import assert from "node:assert/strict";
import type { MacroObservationInput } from "../data/fred";
import { MACRO_SERIES_REGISTRY, type MacroSeriesDefinition } from "../data/macro-registry";
import { buildRepositoryBackedMacroFactualBaselines } from "../application/factual-baseline";
import { InMemoryObservationRepository } from "../repositories/memory";
import { qualityFromMacroCadence } from "./freshness";
import { macroToCanonicalRecords } from "./normalize";

const DAY = 24 * 60 * 60 * 1000;

function series(seriesId: string): MacroSeriesDefinition {
  const definition = MACRO_SERIES_REGISTRY.find((item) => item.seriesId === seriesId);
  assert.ok(definition, `${seriesId} registry definition missing`);
  return definition;
}

function macroInput(
  definition: MacroSeriesDefinition,
  observationDate: string,
  retrievedAt: string,
  value = "100",
): MacroObservationInput {
  return {
    series: definition,
    value,
    observationDate,
    previousValue: null,
    vintageDate: observationDate,
    releasedAt: null,
    retrievedAt,
    provenance: {
      version: "v1",
      providerResource: "/fred/series/observations",
      nativeSeriesId: definition.seriesId,
      observationDate,
      vintageDate: observationDate,
    },
  };
}

async function main(): Promise<void> {
  assert.equal(qualityFromMacroCadence({
    observationDate: "2026-08-01",
    frequency: "MONTHLY",
    toleranceMs: 45 * DAY,
    evaluatedAt: "2026-09-21T00:00:00.000Z",
  }), "FRESH", "monthly tolerance starts after the observation period ends");
  assert.equal(qualityFromMacroCadence({
    observationDate: "2026-08-01",
    frequency: "MONTHLY",
    toleranceMs: 45 * DAY,
    evaluatedAt: "2026-10-16T00:00:00.000Z",
  }), "STALE", "monthly observation expires after its period-end deadline");
  assert.equal(qualityFromMacroCadence({
    observationDate: "2026-04-01",
    frequency: "QUARTERLY",
    toleranceMs: 135 * DAY,
    evaluatedAt: "2026-09-21T00:00:00.000Z",
  }), "FRESH", "quarterly tolerance starts after quarter end");

  assert.equal(qualityFromMacroCadence({
    observationDate: "2026-09-16",
    frequency: "DAILY",
    toleranceMs: 5 * DAY,
    evaluatedAt: "2026-09-20T23:59:59.999Z",
  }), "FRESH", "daily observations retain date-anchor behavior");
  assert.equal(qualityFromMacroCadence({
    observationDate: "2026-09-05",
    frequency: "WEEKLY",
    toleranceMs: 14 * DAY,
    evaluatedAt: "2026-09-20T00:00:00.000Z",
  }), "STALE", "weekly observations retain conservative date-anchor behavior");

  const deterministicInput = {
    observationDate: "2026-08-01",
    frequency: "MONTHLY" as const,
    toleranceMs: 45 * DAY,
    evaluatedAt: "2026-09-21T12:34:56.000Z",
  };
  const originalDateNow = Date.now;
  let earlyClockQuality: ReturnType<typeof qualityFromMacroCadence>;
  let lateClockQuality: ReturnType<typeof qualityFromMacroCadence>;
  try {
    Date.now = () => Date.parse("2000-01-01T00:00:00.000Z");
    earlyClockQuality = qualityFromMacroCadence(deterministicInput);
    Date.now = () => Date.parse("2100-01-01T00:00:00.000Z");
    lateClockQuality = qualityFromMacroCadence(deterministicInput);
  } finally {
    Date.now = originalDateNow;
  }
  assert.equal(earlyClockQuality, lateClockQuality, "macro quality is independent of the system clock");
  assert.equal(qualityFromMacroCadence({
    ...deterministicInput,
    observationDate: "2026-09-22",
  }), "UNKNOWN", "a measurement after P365 acquisition cannot be fresh");
  assert.equal(qualityFromMacroCadence({
    ...deterministicInput,
    observationDate: "2026-02-30",
  }), "UNKNOWN", "invalid observation dates are never fresh");
  assert.equal(qualityFromMacroCadence({
    ...deterministicInput,
    evaluatedAt: "invalid",
  }), "UNKNOWN", "invalid acquisition timestamps are never fresh");

  const cpi = series("CPIAUCSL");
  const freshInput = macroInput(cpi, "2026-08-01", "2026-09-21T00:00:00.000Z", "334.1");
  const staleInput = macroInput(cpi, "2026-08-01", "2026-10-16T00:00:00.000Z", "334.1");
  const fresh = macroToCanonicalRecords([freshInput], "fred").observations[0];
  const stale = macroToCanonicalRecords([staleInput], "fred").observations[0];
  assert.ok(fresh && stale);
  assert.equal(fresh.quality, "FRESH");
  assert.equal(stale.quality, "STALE");
  assert.equal(fresh.id, stale.id, "quality evaluation and retrieval time do not change revision identity");
  assert.deepEqual(fresh.identity, stale.identity);
  assert.deepEqual(fresh.provenance, stale.provenance);
  assert.equal(fresh.observedAt, stale.observedAt);
  assert.equal(fresh.retrievedAt, freshInput.retrievedAt);
  assert.equal(stale.retrievedAt, staleInput.retrievedAt);
  assert.equal("releasedAt" in fresh, false, "cadence policy must not fabricate release time");

  assert.equal(
    macroToCanonicalRecords([
      macroInput(cpi, "2026-09-22", "2026-09-21T23:59:59.999Z"),
      macroInput(cpi, "not-a-date", "2026-09-21T23:59:59.999Z"),
      macroInput(cpi, "2026-08-01", "not-a-time"),
    ], "fred").observations.length,
    0,
    "normalization rejects future or invalid temporal contexts deterministically",
  );

  const current = fresh;
  const predecessor = macroToCanonicalRecords([
    macroInput(cpi, "2026-07-01", "2026-08-31T00:00:00.000Z", "333.5"),
  ], "fred").observations[0];
  assert.ok(predecessor);
  assert.equal(predecessor.quality, "FRESH");
  const history = new InMemoryObservationRepository();
  await history.save(predecessor);
  const baselines = await buildRepositoryBackedMacroFactualBaselines([current], history);
  assert.equal(baselines.CPIAUCSL.status, "VALID", "cadence-valid monthly facts produce a valid FND-002 baseline");
  assert.equal(baselines.CPIAUCSL.baselineObservationId, predecessor.id);
}

void main();
