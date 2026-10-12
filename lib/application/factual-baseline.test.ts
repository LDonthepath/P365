import type { Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import type { HistoricalObservationRepository, ObservationHistoryQuery } from "../repositories/types";
import { buildRepositoryBackedMacroFactualBaselines } from "./factual-baseline";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function macroObservation(
  id: string,
  seriesId: string,
  observedAt: string,
  retrievedAt: string,
  overrides: Partial<Observation> = {},
): Observation {
  return {
    id,
    domain: "MACRO",
    subject: `subject-${seriesId}`,
    value: id,
    observedAt,
    retrievedAt,
    sourceId: "fred",
    quality: "FRESH",
    evidenceId: `evidence-${id}`,
    metadata: {
      seriesId,
      observationDate: observedAt.slice(0, 10),
      unit: "Percent",
      frequency: "Monthly",
    },
    ...overrides,
  };
}

class StaticHistoryRepository implements HistoricalObservationRepository {
  readonly queries: ObservationHistoryQuery[] = [];

  constructor(private readonly candidates: Observation[]) {}

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    this.queries.push(query);
    return this.candidates;
  }
}

async function main(): Promise<void> {
  const current = macroObservation(
    "cpi-current",
    "CPIAUCSL",
    "2026-08-01T00:00:00.000Z",
    "2026-09-01T12:00:00.000Z",
  );
  const repositoryPredecessor = macroObservation(
    "cpi-repository-predecessor",
    "CPIAUCSL",
    "2026-07-01T00:00:00.000Z",
    "2026-08-10T12:00:00.000Z",
    { subject: "renamed CPI label" },
  );

  const ownershipRepository = new InMemoryObservationRepository();
  await ownershipRepository.save(repositoryPredecessor);
  const ownership = await buildRepositoryBackedMacroFactualBaselines([current], ownershipRepository);
  assertEqual(ownership.CPIAUCSL.status, "VALID", "repository predecessor produces a valid baseline");
  assertEqual(
    ownership.CPIAUCSL.baselineObservationId,
    repositoryPredecessor.id,
    "repository ownership tolerates descriptive subject changes",
  );

  const providerPredecessor = macroObservation(
    "cpi-provider-predecessor",
    "CPIAUCSL",
    "2026-06-01T00:00:00.000Z",
    "2026-09-01T12:00:00.000Z",
  );
  const emptyRepository = new InMemoryObservationRepository();
  const noFallback = await buildRepositoryBackedMacroFactualBaselines(
    [providerPredecessor, current],
    emptyRepository,
  );
  assertEqual(noFallback.CPIAUCSL.status, "MISSING", "provider-window predecessor is not a fallback");
  assertEqual(noFallback.CPIAUCSL.baselineObservationId, null, "empty repository stays missing");

  const repositoryWins = new InMemoryObservationRepository();
  await repositoryWins.save(repositoryPredecessor);
  const repositoryOwned = await buildRepositoryBackedMacroFactualBaselines(
    [current, providerPredecessor],
    repositoryWins,
  );
  assertEqual(
    repositoryOwned.CPIAUCSL.baselineObservationId,
    repositoryPredecessor.id,
    "durable repository wins over provider-window candidate",
  );

  const original = macroObservation(
    "cpi-original",
    "CPIAUCSL",
    "2026-07-01T00:00:00.000Z",
    "2026-08-10T00:00:00.000Z",
  );
  const lateCorrection = macroObservation(
    "cpi-late-correction",
    "CPIAUCSL",
    "2026-07-01T00:00:00.000Z",
    "2026-09-02T00:00:00.000Z",
    { value: "corrected" },
  );
  const pointInTimeRepository = new InMemoryObservationRepository();
  await pointInTimeRepository.saveMany([lateCorrection, original]);
  const pointInTime = await buildRepositoryBackedMacroFactualBaselines([current], pointInTimeRepository);
  assertEqual(
    pointInTime.CPIAUCSL.baselineObservationId,
    original.id,
    "revision retrieved after current context is invisible",
  );

  const sameMeasurement = macroObservation(
    "cpi-same-measurement-revision",
    "CPIAUCSL",
    current.observedAt,
    "2026-08-20T00:00:00.000Z",
  );
  const sameMeasurementRepository = new InMemoryObservationRepository();
  await sameMeasurementRepository.save(sameMeasurement);
  const samePeriod = await buildRepositoryBackedMacroFactualBaselines([current], sameMeasurementRepository);
  assertEqual(samePeriod.CPIAUCSL.status, "MISSING", "same-measurement revision is not a predecessor");
  assertEqual(samePeriod.CPIAUCSL.baselineObservationId, null, "same-measurement revision remains unselected");

  const incompatibleCandidates = [
    macroObservation("wrong-series", "CPILFESL", "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z"),
    macroObservation("wrong-source", "CPIAUCSL", "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", { sourceId: "other" }),
    macroObservation("wrong-unit", "CPIAUCSL", "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", { metadata: { ...current.metadata, observationDate: "2026-07-01", unit: "Index" } }),
    macroObservation("wrong-frequency", "CPIAUCSL", "2026-07-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", { metadata: { ...current.metadata, observationDate: "2026-07-01", frequency: "Quarterly" } }),
  ];
  const incompatible = await buildRepositoryBackedMacroFactualBaselines(
    [current],
    new StaticHistoryRepository(incompatibleCandidates),
  );
  assertEqual(incompatible.CPIAUCSL.status, "INCOMPATIBLE", "semantic mismatches are explicit");
  assertEqual(incompatible.CPIAUCSL.baselineObservationId, null, "semantic mismatches are never selected");

  const failed = await buildRepositoryBackedMacroFactualBaselines([current], {
    async findHistory(): Promise<Observation[]> {
      throw new Error("repository unavailable");
    },
  });
  assertEqual(failed.CPIAUCSL.status, "UNKNOWN", "repository failure produces degraded UNKNOWN");
  assertEqual(failed.CPIAUCSL.baselineObservationId, null, "repository failure cannot fabricate a baseline");
  assertEqual(
    failed.CPIAUCSL.reason,
    "Historical Observation repository read failed; factual baseline is unavailable.",
    "repository failure reason is explicit and stable",
  );

  const unemploymentCurrent = macroObservation(
    "unrate-current",
    "UNRATE",
    "2026-08-01T00:00:00.000Z",
    current.retrievedAt,
  );
  const unemploymentPrevious = macroObservation(
    "unrate-previous",
    "UNRATE",
    "2026-07-01T00:00:00.000Z",
    "2026-08-10T00:00:00.000Z",
  );
  const isolatedRepository = new InMemoryObservationRepository();
  await isolatedRepository.saveMany([unemploymentPrevious, repositoryPredecessor]);
  const isolated = await buildRepositoryBackedMacroFactualBaselines(
    [unemploymentCurrent, current],
    isolatedRepository,
  );
  assertEqual(isolated.CPIAUCSL.baselineObservationId, repositoryPredecessor.id, "CPI series stays isolated");
  assertEqual(isolated.UNRATE.baselineObservationId, unemploymentPrevious.id, "unemployment series stays isolated");

  const olderRevision = macroObservation(
    "cpi-revision-a",
    "CPIAUCSL",
    "2026-07-01T00:00:00.000Z",
    "2026-08-01T00:00:00.000Z",
  );
  const newerRevision = macroObservation(
    "cpi-revision-z",
    "CPIAUCSL",
    "2026-07-01T00:00:00.000Z",
    "2026-08-15T00:00:00.000Z",
  );
  const ordered = await buildRepositoryBackedMacroFactualBaselines(
    [current],
    new StaticHistoryRepository([olderRevision, newerRevision]),
  );
  const reversed = await buildRepositoryBackedMacroFactualBaselines(
    [current],
    new StaticHistoryRepository([newerRevision, olderRevision]),
  );
  assertEqual(ordered.CPIAUCSL.baselineObservationId, newerRevision.id, "latest available revision is selected");
  assertEqual(reversed.CPIAUCSL.baselineObservationId, newerRevision.id, "candidate ordering cannot change selection");

  const queryRepository = new StaticHistoryRepository([]);
  await buildRepositoryBackedMacroFactualBaselines([current], queryRepository);
  assertEqual(queryRepository.queries[0], {
    identity: { domain: "MACRO", seriesKey: "CPIAUCSL" },
    sourceId: "fred",
    observedAtOnOrBefore: "2026-07-31T23:59:59.999Z",
    retrievedAtOnOrBefore: current.retrievedAt,
    order: "DESC",
    limit: 500,
  }, "repository query uses strict predecessor and point-in-time bounds");
  // Projection results are already durable and source-qualified. Reuse must
  // eliminate the SECOND physical query without misrepresenting PIT revisions.
  let reusedRepositoryCalls = 0;
  const onlyIfUnproven: HistoricalObservationRepository = {
    async findHistory(): Promise<Observation[]> {
      reusedRepositoryCalls++;
      throw new Error("Unexpected unnecessary historical read");
    },
  };
  const compactHistory = new Map([["CPIAUCSL", [current, repositoryPredecessor]]]);
  const reused = await buildRepositoryBackedMacroFactualBaselines(
    [current], onlyIfUnproven, compactHistory,
  );
  assertEqual(reused.CPIAUCSL.baselineObservationId, repositoryPredecessor.id,
    "complete projection history chooses the same durable predecessor");
  assertEqual(reusedRepositoryCalls, 0, "complete projection avoids the physical baseline read");

  const projectedLateRevision = macroObservation(
    "late-july-revision", "CPIAUCSL", repositoryPredecessor.observedAt,
    "2026-09-02T00:00:00.000Z", { value: "100" },
  );
  const projectedWithLateCorrection = new Map([
    ["CPIAUCSL", [current, projectedLateRevision, repositoryPredecessor]],
  ]);
  const reusedPIT = await buildRepositoryBackedMacroFactualBaselines(
    [current], onlyIfUnproven, projectedWithLateCorrection,
  );
  assertEqual(reusedPIT.CPIAUCSL.baselineObservationId, repositoryPredecessor.id,
    "late corrections remain invisible at current's retrievedAt cutoff");
  assertEqual(reusedRepositoryCalls, 0, "late corrections do not require a second query");

  const manyHistorical = Array.from({ length: 6 }, (_, index) =>
    macroObservation(
      `older-${index}`, "CPIAUCSL",
      new Date(Date.parse("2026-06-01T00:00:00.000Z") - index * 30 * 86_400_000).toISOString(),
      "2026-07-10T00:00:00.000Z",
    ));
  const saturatedWithPredecessor = new Map([
    ["CPIAUCSL", [current, repositoryPredecessor, ...manyHistorical]],
  ]);
  const reusedSaturated = await buildRepositoryBackedMacroFactualBaselines(
    [current], onlyIfUnproven, saturatedWithPredecessor,
  );
  assertEqual(reusedSaturated.CPIAUCSL.baselineObservationId, repositoryPredecessor.id,
    "bounded latest-first prefix with predecessor remains valid when truncated");
  assertEqual(reusedRepositoryCalls, 0, "safe truncated prefix skips physical predecessor read");

  const samePeriodRows = Array.from({ length: 7 }, (_, index) =>
    macroObservation(
      `same-period-${index}`, "CPIAUCSL", current.observedAt,
      new Date(Date.parse(current.retrievedAt) - (index + 1) * 60_000).toISOString(),
    ));
  const fallbackRepo = new StaticHistoryRepository([repositoryPredecessor]);
  const saturatedWithoutPredecessor = new Map([
    ["CPIAUCSL", [current, ...samePeriodRows]],
  ]);
  const mustFallback = await buildRepositoryBackedMacroFactualBaselines(
    [current], fallbackRepo, saturatedWithoutPredecessor,
  );
  assertEqual(mustFallback.CPIAUCSL.baselineObservationId, repositoryPredecessor.id,
    "truncated same-period revisions fall back to authoritative history");
  assertEqual(fallbackRepo.queries.length, 1, "history fallback executes exactly one physical read");
  assertEqual(fallbackRepo.queries[0].retrievedAtOnOrBefore, current.retrievedAt,
    "fallback retains strict current-observation knowledge cutoff");

  const badProvenance = new Map([
    ["CPIAUCSL", [current, { ...repositoryPredecessor, sourceId: "provider-other" }]],
  ]);
  const mismatchRepo = new StaticHistoryRepository([repositoryPredecessor]);
  const mismatch = await buildRepositoryBackedMacroFactualBaselines(
    [current], mismatchRepo, badProvenance,
  );
  assertEqual(mismatch.CPIAUCSL.baselineObservationId, repositoryPredecessor.id,
    "mixed provider histories are rejected and re-read");
  assertEqual(mismatchRepo.queries.length, 1, "mismatched provenance requires a physical read");

  const badDate = new Map([
    ["CPIAUCSL", [current, { ...repositoryPredecessor,
      metadata: { ...repositoryPredecessor.metadata, observationDate: "2026-08-15" } }]],
  ]);
  const dateRepo = new StaticHistoryRepository([repositoryPredecessor]);
  await buildRepositoryBackedMacroFactualBaselines([current], dateRepo, badDate);
  assertEqual(dateRepo.queries.length, 1, "date/measurement mismatch bypasses cache");

  const failClosed = await buildRepositoryBackedMacroFactualBaselines(
    [current], onlyIfUnproven, saturatedWithoutPredecessor,
  );
  assertEqual(failClosed.CPIAUCSL.status, "UNKNOWN", "fallback failure remains UNKNOWN, never stale success");

}

void main();
