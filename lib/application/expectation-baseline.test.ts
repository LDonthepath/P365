import type { EconomicEventResult, EventExpectedType } from "../domain/event-result";
import {
  EXPECTATION_BASELINE_SELECTION_POLICY,
  selectExpectationBaseline,
  type ExpectationBaselineRequest,
} from "../domain/expectation-baseline";
import type {
  EconomicEventResultHistoryQuery,
  HistoricalEconomicEventResultRepository,
} from "../repositories/types";
import { buildRepositoryBackedExpectationBaseline } from "./expectation-baseline";

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

function result(
  id: string,
  retrievedAt: string,
  expected = 2.8,
  overrides: Partial<EconomicEventResult> = {},
): EconomicEventResult {
  return {
    id,
    eventId: "biquote-event-cpi",
    eventIdentityKey: "event:v1:US:2026-10-15T12:30:00.000Z:cpi",
    expected,
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
    private readonly fail = false,
  ) {}

  async findHistory(
    query: EconomicEventResultHistoryQuery,
  ): Promise<EconomicEventResult[]> {
    this.queries.push(query);
    if (this.fail) throw new Error("repository unavailable");
    return this.items;
  }
}

const request: ExpectationBaselineRequest = {
  eventIdentityKey: "event:v1:US:2026-10-15T12:30:00.000Z:cpi",
  sourceId: "biquote",
  releaseAt: "2026-10-15T12:30:00.000Z",
  asOf: "2026-10-15T12:30:00.000Z",
};

async function main(): Promise<void> {
  const early = result("forecast-early", "2026-10-15T10:00:00.000Z", 2.9);
  const latest = result("forecast-latest", "2026-10-15T12:20:00.000Z", 2.8);
  const postRelease = result(
    "forecast-post",
    "2026-10-15T12:31:00.000Z",
    2.7,
    {
      actual: 2.5,
      releasedAt: "2026-10-15T12:30:00.000Z",
    },
  );

  const selected = selectExpectationBaseline(
    request,
    [postRelease, early, latest],
  );
  assertEqual(
    selected.status,
    "VALID",
    "latest qualified pre-release expectation is valid",
  );
  assertEqual(
    selected.baselineEventResultId,
    latest.id,
    "post-release snapshot cannot leak into baseline",
  );
  assertEqual(selected.expected, 2.8, "latest pre-release value is selected");
  assertEqual(
    selected.expectedType,
    "FORECAST",
    "forecast remains forecast",
  );
  assertEqual(
    selected.selectionCutoff,
    "2026-10-15T12:29:59.999Z",
    "release cutoff is strict",
  );
  assertEqual(
    selected.selectionPolicy,
    EXPECTATION_BASELINE_SELECTION_POLICY,
    "selection policy is explicit",
  );

  const exactlyAtRelease = result(
    "at-release",
    "2026-10-15T12:30:00.000Z",
    2.6,
  );
  assertEqual(
    selectExpectationBaseline(request, [exactlyAtRelease]).status,
    "MISSING",
    "snapshot retrieved exactly at release is not a pre-release baseline",
  );

  const earlierAsOfRequest = {
    ...request,
    asOf: "2026-10-15T11:00:00.000Z",
  };
  const earlierAsOf = selectExpectationBaseline(
    earlierAsOfRequest,
    [latest, early],
  );
  assertEqual(
    earlierAsOf.baselineEventResultId,
    early.id,
    "caller as-of can be stricter than release cutoff",
  );
  assertEqual(
    earlierAsOf.selectionCutoff,
    "2026-10-15T11:00:00.000Z",
    "as-of cutoff is preserved",
  );

  const revised = result(
    "forecast-revised",
    "2026-10-15T12:25:00.000Z",
    2.75,
  );
  assertEqual(
    selectExpectationBaseline(
      request,
      [early, latest, revised],
    ).baselineEventResultId,
    revised.id,
    "latest pre-release forecast revision wins deterministically",
  );

  const wrongProvider = result(
    "other-provider",
    "2026-10-15T12:29:00.000Z",
    2.6,
    { sourceId: "other" },
  );
  assertEqual(
    selectExpectationBaseline(
      request,
      [wrongProvider, latest],
    ).baselineEventResultId,
    latest.id,
    "providers are never blended implicitly",
  );

  const consensus = result(
    "consensus",
    "2026-10-15T12:25:00.000Z",
    2.7,
    { expectedType: "CONSENSUS" },
  );
  const forecastRequest = {
    ...request,
    expectedType: "FORECAST" as EventExpectedType,
  };
  assertEqual(
    selectExpectationBaseline(
      forecastRequest,
      [consensus, latest],
    ).baselineEventResultId,
    latest.id,
    "requested expectation type remains semantically isolated",
  );

  const partial = selectExpectationBaseline(
    request,
    [
      result(
        "missing-period",
        "2026-10-15T12:25:00.000Z",
        2.8,
        { period: undefined },
      ),
    ],
  );
  assertEqual(
    partial.status,
    "PARTIAL",
    "missing period is not valid for downstream surprise",
  );
  assertEqual(
    partial.reason,
    "Selected expectation is incomplete for downstream surprise use: missing period.",
    "partial qualification reason is explicit",
  );

  const queryRepository = new StaticRepository([latest, early]);
  const repositoryBaseline = await buildRepositoryBackedExpectationBaseline(
    request,
    queryRepository,
  );
  assertEqual(
    repositoryBaseline.baselineEventResultId,
    latest.id,
    "repository-backed baseline selects durable history",
  );
  assertEqual(
    queryRepository.queries[0],
    {
      eventIdentityKey: request.eventIdentityKey,
      sourceId: "biquote",
      retrievedAtOnOrBefore: "2026-10-15T12:29:59.999Z",
      order: "DESC",
      limit: 500,
    },
    "repository query uses provider identity and strict point-in-time cutoff",
  );

  const failure = await buildRepositoryBackedExpectationBaseline(
    request,
    new StaticRepository([], true),
  );
  assertEqual(
    failure.status,
    "UNKNOWN",
    "repository outage degrades without fabricating expectation",
  );
  assertEqual(
    failure.baselineEventResultId,
    null,
    "repository outage has no baseline result",
  );
  assertEqual(
    failure.reason,
    "Historical EventResult repository read failed; expectation baseline is unavailable.",
    "repository failure reason is stable",
  );
}

void main();
