import assert from "node:assert/strict";
import test from "node:test";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { providerResult } from "../data/types";
import type { MacroObservationInput } from "../data/fred";
import type { Observation, Evidence } from "../domain/types";
import { InMemoryEvidenceRepository, InMemoryObservationRepository } from "../repositories/memory";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import { runHistoricalIngestion, type HistoricalIngestionAcquisition } from "./historical-ingestion";

function macro(value: string, day = "2026-09-01"): MacroObservationInput {
  return {
    series: MACRO_SERIES_REGISTRY[0], value,
    observationDate: day,
    previousValue: null, vintageDate: day, releasedAt: null,
    retrievedAt: "2026-10-08T06:36:00.000Z",
    provenance: { version: "v1", providerResource: "/fred/series/observations",
      nativeSeriesId: MACRO_SERIES_REGISTRY[0].seriesId, observationDate: day, vintageDate: day },
  };
}

function stores(withReceipt = true, rejectObservation = false): {
  repositories: CanonicalRepositories;
  rawObservations: InMemoryObservationRepository;
} {
  const rawObservations = new InMemoryObservationRepository();
  const rawEvidence = new InMemoryEvidenceRepository();
  const observed = new Set<string>();
  const evidenced = new Set<string>();
  const receipt = async <T extends { id: string }>(items: T[], seen: Set<string>,
    saveMany: (items: T[]) => Promise<void>) => {
    const inserted = items.filter((row) => !seen.has(row.id));
    for (const item of inserted) seen.add(item.id);
    await saveMany(items);
    return { submitted: items.length, inserted: inserted.length,
      duplicates: items.length - inserted.length };
  };
  return {
    rawObservations,
    repositories: {
      observations: {
        save: (row: Observation) => rawObservations.save(row),
        saveMany: (rows: Observation[]) => rawObservations.saveMany(rows),
        findById: (id: string) => rawObservations.findById(id),
        ...(withReceipt ? { saveManyWithReceipt: (rows: Observation[]) =>
          rejectObservation ? Promise.reject(new Error("mock observation write failed"))
            : receipt(rows, observed, (items) => rawObservations.saveMany(items)) } : {}),
      },
      evidence: {
        save: (row: Evidence) => rawEvidence.save(row),
        saveMany: (rows: Evidence[]) => rawEvidence.saveMany(rows),
        findById: (id: string) => rawEvidence.findById(id),
        ...(withReceipt ? { saveManyWithReceipt: (rows: Evidence[]) =>
          receipt(rows, evidenced, (items) => rawEvidence.saveMany(items)) } : {}),
      },
      events: { save: async () => undefined, saveMany: async () => undefined,
        findById: async () => null },
      contexts: { save: async () => undefined, saveMany: async () => undefined,
        findById: async () => null },
    },
  };
}

function acquisition(rows: MacroObservationInput[]): HistoricalIngestionAcquisition {
  return {
    fred: async () => providerResult("fred", "SUCCESS", rows),
    "coingecko-context": async () => providerResult("coingecko", "EMPTY", []),
  } as unknown as HistoricalIngestionAcquisition;
}

test("FRED write metrics distinguish accepted, physical inserts, duplicates and unproven revisions", async () => {
  const store = stores();
  const opts = { mode: "FORWARD" as const, providers: ["fred" as const, "coingecko-context" as const] };
  const first = await runHistoricalIngestion(opts, { acquisition: acquisition([macro("4.1")]),
    repositories: store.repositories });
  assert.equal(first.status, "SUCCESS");
  assert.equal(first.persistedObservations, 1, "legacy accepted metric retained");
  assert.equal(first.providers[0].persisted, 1);
  assert.equal(first.providers[1].writeMetrics, undefined, "other provider contract unchanged");
  assert.deepEqual(first.providers[0].writeMetrics, {
    source: "POSTGREST_RETURNING_KEYS",
    observations: { submitted: 1, inserted: 1, duplicates: 0 },
    evidence: { submitted: 1, inserted: 1, duplicates: 0 },
    revised: null,
    revisionAssessment: "NOT_EVALUATED",
  });

  const duplicate = await runHistoricalIngestion(opts, { acquisition: acquisition([macro("4.1")]),
    repositories: store.repositories });
  assert.equal(duplicate.status, "SUCCESS");
  assert.equal(duplicate.persistedObservations, 1);
  assert.deepEqual(duplicate.providers[0].writeMetrics?.observations,
    { submitted: 1, inserted: 0, duplicates: 1 });
  assert.equal(duplicate.providers[0].writeMetrics?.revised, 0);

  const revisedValue = await runHistoricalIngestion(opts, {
    acquisition: acquisition([macro("4.2")]), repositories: store.repositories,
  });
  assert.equal(revisedValue.providers[0].writeMetrics?.observations.inserted, 1);
  assert.equal(revisedValue.providers[0].writeMetrics?.revised, null,
    "new version must not be labeled revision without DB-backed prior-version proof");
  assert.ok((await store.rawObservations.findHistory({ identity: {
    domain: "MACRO", seriesKey: MACRO_SERIES_REGISTRY[0].seriesId }, limit: 10, order: "ASC" })).length >= 2);
});

test("FRED fallback without receipt must not pretend attempted rows were physically inserted", async () => {
  const store = stores(false);
  const report = await runHistoricalIngestion({ mode: "FORWARD", providers: ["fred"] }, {
    acquisition: acquisition([macro("4.3")]), repositories: store.repositories,
  });
  assert.equal(report.status, "SUCCESS");
  assert.equal(report.providers[0].persisted, 1);
  assert.deepEqual(report.providers[0].writeMetrics?.observations,
    { submitted: 1, inserted: null, duplicates: null });
  assert.equal(report.providers[0].writeMetrics?.source, "NOT_EVALUATED");
});

test("FRED empty data returns known zero inserts; partial persistence errors retain known evidence receipt", async () => {
  const empty = await runHistoricalIngestion({ mode: "FORWARD", providers: ["fred"] }, {
    acquisition: { fred: async () => providerResult("fred", "EMPTY", []) } as unknown as HistoricalIngestionAcquisition,
    repositories: stores().repositories,
  });
  assert.equal(empty.status, "EMPTY");
  assert.deepEqual(empty.providers[0].writeMetrics?.observations,
    { submitted: 0, inserted: 0, duplicates: 0 });

  const failed = await runHistoricalIngestion({ mode: "FORWARD", providers: ["fred"] }, {
    acquisition: acquisition([macro("4.4")]), repositories: stores(true, true).repositories,
  });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.providers[0].status, "PERSISTENCE_ERROR");
  assert.equal(failed.providers[0].writeMetrics?.evidence.inserted, 1);
  assert.equal(failed.providers[0].writeMetrics?.observations.inserted, null);
  assert.equal(failed.persistedObservations, 0, "legacy status remains failed");
});
