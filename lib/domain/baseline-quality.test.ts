import assert from "node:assert/strict";
import { buildRepositoryBackedMacroFactualBaselines } from "../application/factual-baseline";
import { InMemoryObservationRepository } from "../repositories/memory";
import type { HistoricalObservationRepository } from "../repositories/types";
import {
  FACTUAL_BASELINE_QUALITY_POLICY,
  factualBaselineChange,
  selectFactualBaseline,
} from "./baseline";
import type { DataQuality, Observation } from "./types";

function observation(
  id: string,
  observationDate: string,
  retrievedAt: string,
  quality: DataQuality,
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id,
    domain: "MACRO",
    subject: "Consumer Price Index",
    value: observationDate === "2026-08-01" ? "334.1" : "333.5",
    observedAt: `${observationDate}T00:00:00.000Z`,
    retrievedAt,
    sourceId: "fred",
    quality,
    evidenceId: `evidence-${id}`,
    metadata: {
      seriesId: "CPIAUCSL",
      observationDate,
      unit: "Index 1982-1984=100",
      frequency: "MONTHLY",
    },
    ...overrides,
  };
}

async function main(): Promise<void> {
  const currentRetrievedAt = "2026-09-21T00:00:00.000Z";
  const predecessorRetrievedAt = "2026-08-20T00:00:00.000Z";
  const truthTable: Array<{
    current: DataQuality;
    predecessor: DataQuality;
    expected: "VALID" | "STALE" | "UNKNOWN";
  }> = [
    { current: "FRESH", predecessor: "FRESH", expected: "VALID" },
    { current: "FRESH", predecessor: "STALE", expected: "VALID" },
    { current: "FRESH", predecessor: "UNKNOWN", expected: "UNKNOWN" },
    { current: "FRESH", predecessor: "PARTIAL", expected: "UNKNOWN" },
    { current: "STALE", predecessor: "FRESH", expected: "STALE" },
    { current: "STALE", predecessor: "STALE", expected: "STALE" },
    { current: "UNKNOWN", predecessor: "FRESH", expected: "UNKNOWN" },
    { current: "PARTIAL", predecessor: "FRESH", expected: "UNKNOWN" },
    { current: "STALE", predecessor: "UNKNOWN", expected: "UNKNOWN" },
  ];

  for (const row of truthTable) {
    const current = observation("current", "2026-08-01", currentRetrievedAt, row.current);
    const predecessor = observation("predecessor", "2026-07-01", predecessorRetrievedAt, row.predecessor);
    const baseline = selectFactualBaseline(current, [predecessor]);
    assert.equal(baseline.status, row.expected, `${row.current}/${row.predecessor} baseline status`);
    assert.equal(baseline.currentObservationQuality, row.current);
    assert.equal(baseline.baselineObservationQuality, row.predecessor);
    assert.equal(baseline.qualityPolicy, FACTUAL_BASELINE_QUALITY_POLICY);
  }

  const legacyPredecessor = observation(
    "legacy-cpi-july-stored-stale",
    "2026-07-01",
    predecessorRetrievedAt,
    "STALE",
  );
  const current = observation("cpi-august-current", "2026-08-01", currentRetrievedAt, "FRESH");
  const legacyQualityBeforeSelection = legacyPredecessor.quality;
  const directBaseline = selectFactualBaseline(current, [legacyPredecessor]);
  assert.equal(directBaseline.status, "VALID");
  assert.equal(directBaseline.quality, "FRESH");
  assert.equal(directBaseline.currentObservationQuality, "FRESH");
  assert.equal(directBaseline.baselineObservationQuality, "STALE");
  assert.equal(legacyPredecessor.quality, legacyQualityBeforeSelection, "stored predecessor quality remains immutable");
  assert.ok(Math.abs((factualBaselineChange(directBaseline) ?? 0) - 0.6) < 1e-9);

  const beforeCutoffRepository = new InMemoryObservationRepository();
  await beforeCutoffRepository.save(legacyPredecessor);
  const beforeCutoff = await buildRepositoryBackedMacroFactualBaselines([current], beforeCutoffRepository);
  assert.equal(beforeCutoff.CPIAUCSL.status, "VALID", "STALE predecessor acquired before cutoff is usable");
  assert.equal(beforeCutoff.CPIAUCSL.baselineObservationId, legacyPredecessor.id);
  assert.equal(beforeCutoff.CPIAUCSL.baselineObservationQuality, "STALE");

  const afterCutoffPredecessor = observation(
    "cpi-july-late-backfill",
    "2026-07-01",
    "2026-09-22T00:00:00.000Z",
    "STALE",
  );
  const afterCutoffRepository = new InMemoryObservationRepository();
  await afterCutoffRepository.save(afterCutoffPredecessor);
  const afterCutoff = await buildRepositoryBackedMacroFactualBaselines([current], afterCutoffRepository);
  assert.equal(afterCutoff.CPIAUCSL.status, "MISSING", "post-cutoff history remains invisible");
  assert.equal(afterCutoff.CPIAUCSL.baselineObservationId, null);

  const sameMeasurementRepository = new InMemoryObservationRepository();
  await sameMeasurementRepository.save(observation(
    "cpi-august-correction",
    "2026-08-01",
    "2026-09-20T00:00:00.000Z",
    "STALE",
  ));
  const sameMeasurement = await buildRepositoryBackedMacroFactualBaselines([current], sameMeasurementRepository);
  assert.equal(sameMeasurement.CPIAUCSL.status, "MISSING");
  assert.equal(sameMeasurement.CPIAUCSL.baselineObservationId, null);

  const incompatibleCandidates = [
    observation("wrong-series", "2026-07-01", predecessorRetrievedAt, "STALE", {
      metadata: { ...legacyPredecessor.metadata, seriesId: "CPILFESL" },
    }),
    observation("wrong-source", "2026-07-01", predecessorRetrievedAt, "STALE", { sourceId: "other" }),
    observation("wrong-unit", "2026-07-01", predecessorRetrievedAt, "STALE", {
      metadata: { ...legacyPredecessor.metadata, unit: "Percent" },
    }),
    observation("wrong-frequency", "2026-07-01", predecessorRetrievedAt, "STALE", {
      metadata: { ...legacyPredecessor.metadata, frequency: "QUARTERLY" },
    }),
  ];
  for (const candidate of incompatibleCandidates) {
    assert.equal(selectFactualBaseline(current, [candidate]).status, "INCOMPATIBLE");
  }

  const failedRepository: HistoricalObservationRepository = {
    async findHistory(): Promise<Observation[]> {
      throw new Error("repository unavailable");
    },
  };
  const failed = await buildRepositoryBackedMacroFactualBaselines([current], failedRepository);
  assert.equal(failed.CPIAUCSL.status, "UNKNOWN");
  assert.equal(failed.CPIAUCSL.baselineObservationId, null);
  assert.equal(failed.CPIAUCSL.currentObservationQuality, "FRESH");
  assert.equal(failed.CPIAUCSL.baselineObservationQuality, null);
}

void main();
