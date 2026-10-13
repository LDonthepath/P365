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


/** PRB-BASE-PIT-001 (#402): golden, retrieval-bounded factual baseline cases.
 * Captured-at eligibility and arbitrary-T current resolution belong to #370.
 */
async function goldenRevisedMonthlyPredecessors(): Promise<void> {
  function monthly(
    id: string, seriesId: string, period: string, retrievedAt: string,
    value: string, vintageDate: string, unit: string,
  ): Observation {
    return macroObservation(id, seriesId, period + "T00:00:00.000Z", retrievedAt, {
      value,
      metadata: { seriesId, observationDate: period, vintageDate, frequency: "MONTHLY", unit },
    });
  }

  const cpiUnit = "Index 1982-1984=100";
  const cpiOld = monthly("gold-cpi-jul-v1", "CPIAUCSL", "2026-07-01",
    "2026-08-10T12:00:00.000Z", "332.813", "2026-08-10", cpiUnit);
  const cpiRevised = monthly("gold-cpi-jul-v2", "CPIAUCSL", "2026-07-01",
    "2026-09-22T12:00:00.000Z", "332.910", "2026-09-22", cpiUnit);
  const cpiAugustT1 = monthly("gold-cpi-aug-t1", "CPIAUCSL", "2026-08-01",
    "2026-09-20T23:04:00.000Z", "334.131", "2026-09-11", cpiUnit);
  const cpiAugustT2 = monthly("gold-cpi-aug-t2", "CPIAUCSL", "2026-08-01",
    "2026-09-23T12:00:00.000Z", "334.131", "2026-09-11", cpiUnit);
  const cpiSamePeriod = monthly("gold-cpi-aug-other-version", "CPIAUCSL", "2026-08-01",
    "2026-09-19T12:00:00.000Z", "334.140", "2026-09-19", cpiUnit);
  const cpiRepo = new InMemoryObservationRepository();
  await cpiRepo.saveMany([cpiRevised, cpiSamePeriod, cpiOld]);
  const cpiBefore = (await buildRepositoryBackedMacroFactualBaselines(
    [cpiAugustT1], cpiRepo,
  )).CPIAUCSL;
  const cpiAfter = (await buildRepositoryBackedMacroFactualBaselines(
    [cpiAugustT2], cpiRepo,
  )).CPIAUCSL;
  assertEqual(cpiBefore.status, "VALID", "CPI original predecessor is valid at T1");
  assertEqual(cpiBefore.baselineObservationId, cpiOld.id,
    "CPI July correction acquired after T1 must not leak");
  assertEqual(cpiBefore.baselineValue, "332.813", "CPI July value known at T1");
  assertEqual(cpiAfter.baselineObservationId, cpiRevised.id,
    "CPI July correction acquired before T2 becomes selectable");
  assertEqual(cpiAfter.baselineValue, "332.910", "CPI revised July value at T2");
  assertEqual(cpiAfter.baselineObservedAt, "2026-07-01T00:00:00.000Z",
    "another August version is not a predecessor period");

  const cpiReverseRepo = new InMemoryObservationRepository();
  await cpiReverseRepo.saveMany([cpiOld, cpiSamePeriod, cpiRevised]);
  const cpiReordered = (await buildRepositoryBackedMacroFactualBaselines(
    [cpiAugustT2], cpiReverseRepo,
  )).CPIAUCSL;
  assertEqual(cpiReordered.baselineObservationId, cpiRevised.id,
    "candidate storage order cannot change CPI revision selected");

  const gapRepo = new InMemoryObservationRepository();
  await gapRepo.save(monthly("gold-cpi-june-only", "CPIAUCSL", "2026-06-01",
    "2026-07-15T00:00:00.000Z", "330.000", "2026-07-15", cpiUnit));
  const gap = (await buildRepositoryBackedMacroFactualBaselines(
    [cpiAugustT1], gapRepo,
  )).CPIAUCSL;
  assertEqual(gap.baselineObservedAt, "2026-06-01T00:00:00.000Z",
    "generic factual predecessor can skip July; this is NOT a valid August MoM pair");
  assertEqual(gap.baselineObservedAt === "2026-07-01T00:00:00.000Z", false,
    "calendar MoM layer #372 must reject this missing immediate month");

  const payrollUnit = "Thousands of Persons";
  const payrollJuly = monthly("gold-pay-july", "PAYEMS", "2026-07-01",
    "2026-09-01T00:00:00.000Z", "158990", "2026-09-01", payrollUnit);
  const payrollAugV1 = monthly("gold-pay-aug-v1", "PAYEMS", "2026-08-01",
    "2026-09-20T23:03:00.000Z", "159075", "2026-09-04", payrollUnit);
  const payrollAugV2 = monthly("gold-pay-aug-v2", "PAYEMS", "2026-08-01",
    "2026-10-02T13:31:04.000Z", "159015", "2026-10-02", payrollUnit);
  const payrollAugFuture = monthly("gold-pay-aug-future", "PAYEMS", "2026-08-01",
    "2026-10-04T09:00:00.000Z", "159000", "2026-10-04", payrollUnit);
  const payrollSeptember = monthly("gold-pay-sept", "PAYEMS", "2026-09-01",
    "2026-10-02T13:32:00.000Z", "159044", "2026-10-02", payrollUnit);
  const payrollRepo = new InMemoryObservationRepository();
  await payrollRepo.saveMany([
    payrollAugFuture, payrollAugV2, payrollJuly, payrollSeptember, payrollAugV1,
  ]);

  const septemberAtEarlierT = await payrollRepo.findHistory({
    identity: { domain: "MACRO", seriesKey: "PAYEMS" }, sourceId: "fred",
    observedAtOnOrAfter: payrollSeptember.observedAt,
    observedAtOnOrBefore: payrollSeptember.observedAt,
    retrievedAtOnOrBefore: "2026-09-20T23:04:00.000Z",
    order: "DESC", limit: 10,
  });
  assertEqual(septemberAtEarlierT.length, 0,
    "PAYEMS September period is not yet acquired at earlier T");

  const payrollBefore = (await buildRepositoryBackedMacroFactualBaselines(
    [payrollAugV1], payrollRepo,
  )).PAYEMS;
  assertEqual(payrollBefore.baselineObservationId, payrollJuly.id,
    "PAYEMS August earlier view uses July and excludes revised same-period August");
  const payrollAfter = (await buildRepositoryBackedMacroFactualBaselines(
    [payrollSeptember], payrollRepo,
  )).PAYEMS;
  assertEqual(payrollAfter.status, "VALID", "PAYEMS September is eligible after acquisition");
  assertEqual(payrollAfter.baselineObservationId, payrollAugV2.id,
    "PAYEMS selects August revision knowable by T2, not earlier/future version");
  assertEqual(payrollAfter.baselineValue, "159015", "PAYEMS August revised value at T2");
  assertEqual(Number(payrollAfter.currentValue) - Number(payrollAfter.baselineValue), 29,
    "PAYEMS observed adjacent level delta is 29 thousand, not 29 percent");
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

  await goldenRevisedMonthlyPredecessors();
}

void main();
