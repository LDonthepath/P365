import type { EconomicEventResult } from "../domain/event-result";
import {
  assessEventSurprise,
  EVENT_SURPRISE_POLICY_V1,
  selectActualEventResult,
  type EventSurpriseRequest,
} from "../domain/event-surprise";
import {
  selectExpectationBaseline,
  type ExpectationBaseline,
} from "../domain/expectation-baseline";
import type {
  EconomicEventResultHistoryQuery,
  HistoricalEconomicEventResultRepository,
} from "../repositories/types";
import { assessRepositoryBackedEventSurprise } from "./event-surprise";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      label
      + ": expected "
      + JSON.stringify(expected)
      + ", got "
      + JSON.stringify(actual),
    );
  }
}

const eventIdentityKey =
  "event:v1:US:2026-10-15T12:30:00.000Z:cpi";

function result(
  id: string,
  retrievedAt: string,
  overrides: Partial<EconomicEventResult> = {},
): EconomicEventResult {
  return {
    id,
    eventId: "biquote-event-cpi",
    eventIdentityKey,
    expected: 2.8,
    expectedType: "FORECAST",
    unit: "%",
    period: "Sep 2026",
    retrievedAt,
    sourceId: "biquote",
    evidenceId: "evidence-" + id,
    ...overrides,
  };
}

class StaticRepository implements HistoricalEconomicEventResultRepository {
  readonly queries: EconomicEventResultHistoryQuery[] = [];

  constructor(
    private readonly items: EconomicEventResult[],
    private readonly failAfter = Number.POSITIVE_INFINITY,
  ) {}

  async findHistory(
    query: EconomicEventResultHistoryQuery,
  ): Promise<EconomicEventResult[]> {
    this.queries.push(query);
    if (this.queries.length > this.failAfter) {
      throw new Error("repository unavailable");
    }
    return this.items;
  }
}

const request: EventSurpriseRequest = {
  eventIdentityKey,
  sourceId: "biquote",
  releaseAt: "2026-10-15T12:30:00.000Z",
  asOf: "2026-10-15T12:35:00.000Z",
  expectedType: "FORECAST",
};

function expectation(
  candidates: EconomicEventResult[],
  overrides: Partial<ExpectationBaseline> = {},
): ExpectationBaseline {
  return {
    ...selectExpectationBaseline(request, candidates),
    ...overrides,
  };
}

async function main(): Promise<void> {
  const forecast = result(
    "forecast",
    "2026-10-15T12:20:00.000Z",
  );
  const leakedAtRelease = result(
    "at-release-forecast",
    "2026-10-15T12:30:00.000Z",
    { expected: 2.6 },
  );
  const actual = result(
    "actual",
    "2026-10-15T12:31:00.000Z",
    {
      actual: 2.5,
      releasedAt: "2026-10-15T12:30:00.000Z",
    },
  );

  const baseline = expectation([leakedAtRelease, forecast, actual]);
  assertEqual(
    baseline.baselineEventResultId,
    forecast.id,
    "SUR-001 reuses strict pre-release EXP-001 expectation",
  );

  const assessment = assessEventSurprise({
    request,
    expectation: baseline,
    candidates: [actual],
  });
  assertEqual(assessment.status, "VALID", "valid surprise assessment");
  assertEqual(
    assessment.policy,
    EVENT_SURPRISE_POLICY_V1,
    "policy is explicit",
  );
  assertEqual(assessment.actualEventResultId, actual.id, "actual selected");
  assertEqual(assessment.expected, 2.8, "forecast preserved");
  assertEqual(assessment.actual, 2.5, "actual preserved");
  assertEqual(
    assessment.absoluteSurprise,
    -0.2999999999999998,
    "raw factual delta preserved",
  );
  assertEqual(
    assessment.relation,
    "BELOW_EXPECTATION",
    "relation is mechanical only",
  );
  assertEqual(
    assessment.causalAttribution,
    "NOT_EVALUATED",
    "causal attribution remains disabled",
  );

  const laterRevision = result(
    "actual-revision",
    "2026-10-15T12:34:00.000Z",
    {
      actual: 2.4,
      releasedAt: "2026-10-15T12:30:00.000Z",
    },
  );
  assertEqual(
    selectActualEventResult(request, [actual, laterRevision])?.id,
    laterRevision.id,
    "latest actual known by as-of wins deterministically",
  );

  const afterAsOf = result(
    "future-actual",
    "2026-10-15T12:36:00.000Z",
    {
      actual: 2.3,
      releasedAt: "2026-10-15T12:30:00.000Z",
    },
  );
  assertEqual(
    selectActualEventResult(request, [afterAsOf, actual])?.id,
    actual.id,
    "actual retrieved after as-of cannot leak backward",
  );

  const beforeRelease = result(
    "premature-actual",
    "2026-10-15T12:29:59.000Z",
    { actual: 2.2 },
  );
  assertEqual(
    selectActualEventResult(request, [beforeRelease]),
    null,
    "actual retrieved before release is ineligible",
  );

  const wrongProvider = result(
    "other-provider-actual",
    "2026-10-15T12:31:00.000Z",
    { actual: 2.1, sourceId: "other" },
  );
  assertEqual(
    selectActualEventResult(request, [wrongProvider, actual])?.id,
    actual.id,
    "provider ownership is never blended",
  );

  const unitMismatch = assessEventSurprise({
    request,
    expectation: baseline,
    candidates: [
      result(
        "wrong-unit",
        "2026-10-15T12:31:00.000Z",
        {
          actual: 2.5,
          unit: "index",
        },
      ),
    ],
  });
  assertEqual(
    unitMismatch.status,
    "PARTIAL",
    "unit mismatch fails closed",
  );
  assertEqual(
    unitMismatch.absoluteSurprise,
    null,
    "unit mismatch never produces a numeric surprise",
  );

  const missingActual = assessEventSurprise({
    request,
    expectation: baseline,
    candidates: [],
  });
  assertEqual(
    missingActual.status,
    "MISSING",
    "missing actual remains explicit",
  );

  const partialBaseline = assessEventSurprise({
    request,
    expectation: expectation(
      [
        result(
          "missing-period",
          "2026-10-15T12:20:00.000Z",
          { period: undefined },
        ),
      ],
    ),
    candidates: [actual],
  });
  assertEqual(
    partialBaseline.status,
    "PARTIAL",
    "partial expectation cannot be promoted into valid surprise",
  );

  let mismatchedAsOfRejected = false;
  try {
    assessEventSurprise({
      request: {
        ...request,
        asOf: "2026-10-15T12:24:00.000Z",
      },
      expectation: baseline,
      candidates: [],
    });
  } catch (error) {
    mismatchedAsOfRejected = error instanceof Error
      && error.message
        === "Event Surprise expectation baseline must use the same point-in-time as-of cutoff.";
  }
  assertEqual(
    mismatchedAsOfRejected,
    true,
    "expectation baseline from another as-of knowledge state is rejected",
  );

  const preReleaseRequest: EventSurpriseRequest = {
    ...request,
    asOf: "2026-10-15T12:25:00.000Z",
  };
  const preReleaseAssessment = assessEventSurprise({
    request: preReleaseRequest,
    expectation: selectExpectationBaseline(
      preReleaseRequest,
      [forecast],
    ),
    candidates: [actual],
  });
  assertEqual(
    preReleaseAssessment.status,
    "MISSING",
    "pre-release as-of has no factual outcome yet",
  );

  const stableA = assessEventSurprise({
    request,
    expectation: baseline,
    candidates: [actual, afterAsOf],
  });
  const stableB = assessEventSurprise({
    request,
    expectation: baseline,
    candidates: [afterAsOf, actual],
  });
  assertEqual(
    stableA.id,
    stableB.id,
    "candidate ordering does not change deterministic identity",
  );

  const repository = new StaticRepository([
    forecast,
    actual,
    laterRevision,
    afterAsOf,
  ]);
  const repositoryAssessment = await assessRepositoryBackedEventSurprise(
    request,
    repository,
  );
  assertEqual(
    repositoryAssessment.actualEventResultId,
    laterRevision.id,
    "repository-backed SUR-001 uses latest point-in-time actual",
  );
  assertEqual(
    repository.queries[0],
    {
      eventIdentityKey,
      sourceId: "biquote",
      expectedType: "FORECAST",
      retrievedAtOnOrBefore: "2026-10-15T12:29:59.999Z",
      order: "DESC",
      limit: 500,
    },
    "first query is the existing EXP-001 strict pre-release selection",
  );
  assertEqual(
    repository.queries[1],
    {
      eventIdentityKey,
      sourceId: "biquote",
      retrievedAtOnOrAfter: "2026-10-15T12:30:00.000Z",
      retrievedAtOnOrBefore: "2026-10-15T12:35:00.000Z",
      order: "DESC",
      limit: 500,
    },
    "actual query is bounded by release and as-of availability",
  );

  const actualReadFailure = await assessRepositoryBackedEventSurprise(
    request,
    new StaticRepository([forecast], 1),
  );
  assertEqual(
    actualReadFailure.status,
    "UNKNOWN",
    "actual repository failure degrades without fabrication",
  );
  assertEqual(
    actualReadFailure.reason,
    "Historical EventResult repository read failed; actual outcome is unavailable.",
    "repository failure reason is stable",
  );
}

void main();
