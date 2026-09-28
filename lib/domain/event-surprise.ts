import { createHash } from "node:crypto";
import type { EconomicEventResult, EventExpectedType } from "./event-result";
import type { ExpectationBaseline } from "./expectation-baseline";

export const EVENT_SURPRISE_POLICY_V1 =
  "point-in-time-factual-event-surprise-v1" as const;

export type EventSurpriseStatus = "VALID" | "PARTIAL" | "MISSING" | "UNKNOWN";

export type EventSurpriseRelation =
  | "ABOVE_EXPECTATION"
  | "BELOW_EXPECTATION"
  | "INLINE"
  | "UNKNOWN";

export type EventSurpriseRequest = {
  eventIdentityKey: string;
  sourceId: string;
  /** Exact qualified event release/schedule instant. */
  releaseAt: string;
  /** Knowledge-state cutoff requested by the caller. */
  asOf: string;
  expectedType?: EventExpectedType;
};

export type EventSurpriseAssessment = {
  id: string;
  version: "v1";
  policy: typeof EVENT_SURPRISE_POLICY_V1;
  status: EventSurpriseStatus;
  eventIdentityKey: string;
  sourceId: string;
  releaseAt: string;
  asOf: string;
  expectedType: EventExpectedType | null;
  baselineEventResultId: string | null;
  actualEventResultId: string | null;
  expected: number | null;
  actual: number | null;
  unit: string | null;
  period: string | null;
  absoluteSurprise: number | null;
  percentSurprise: number | null;
  relation: EventSurpriseRelation;
  expectationRetrievedAt: string | null;
  actualRetrievedAt: string | null;
  evidenceIds: string[];
  causalAttribution: "NOT_EVALUATED";
  reason?: string;
};

export type EventSurpriseInput = {
  request: EventSurpriseRequest;
  expectation: ExpectationBaseline;
  candidates: EconomicEventResult[];
};

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Event Surprise requires valid " + field + ".");
  }
  return parsed;
}

function nonEmpty(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function stableEvidenceIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string =>
    typeof value === "string" && value.trim().length > 0
  ))].sort();
}

export function validateEventSurpriseRequest(
  request: EventSurpriseRequest,
): { releaseAtMs: number; asOfMs: number } {
  if (!request.eventIdentityKey?.trim()) {
    throw new Error("Event Surprise requires eventIdentityKey.");
  }
  if (!request.sourceId?.trim()) {
    throw new Error("Event Surprise requires sourceId.");
  }

  return {
    releaseAtMs: timestamp(request.releaseAt, "releaseAt"),
    asOfMs: timestamp(request.asOf, "asOf"),
  };
}

function actualEligible(
  request: EventSurpriseRequest,
  releaseAtMs: number,
  asOfMs: number,
  result: EconomicEventResult,
): boolean {
  if (
    result.eventIdentityKey !== request.eventIdentityKey
    || result.sourceId !== request.sourceId
    || result.actual === undefined
    || !Number.isFinite(result.actual)
  ) {
    return false;
  }

  const retrievedAtMs = Date.parse(result.retrievedAt);
  if (
    !Number.isFinite(retrievedAtMs)
    || retrievedAtMs < releaseAtMs
    || retrievedAtMs > asOfMs
  ) {
    return false;
  }

  if (result.releasedAt !== undefined) {
    const releasedAtMs = Date.parse(result.releasedAt);
    if (!Number.isFinite(releasedAtMs) || releasedAtMs > asOfMs) {
      return false;
    }
  }

  return true;
}

export function selectActualEventResult(
  request: EventSurpriseRequest,
  candidates: EconomicEventResult[],
): EconomicEventResult | null {
  const { releaseAtMs, asOfMs } = validateEventSurpriseRequest(request);
  if (asOfMs < releaseAtMs) return null;

  return candidates
    .filter((result) =>
      actualEligible(request, releaseAtMs, asOfMs, result)
    )
    .sort((a, b) => {
      const time = Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt);
      return time !== 0 ? time : b.id.localeCompare(a.id);
    })[0] ?? null;
}

function assessmentId(
  assessment: Omit<EventSurpriseAssessment, "id">,
): string {
  return "event-surprise-v1-" + stableHash(assessment);
}

function finish(
  assessment: Omit<EventSurpriseAssessment, "id">,
): EventSurpriseAssessment {
  return {
    id: assessmentId(assessment),
    ...assessment,
  };
}

function relationFor(delta: number): Exclude<EventSurpriseRelation, "UNKNOWN"> {
  if (delta > 0) return "ABOVE_EXPECTATION";
  if (delta < 0) return "BELOW_EXPECTATION";
  return "INLINE";
}

function baseAssessment(
  request: EventSurpriseRequest,
  expectation: ExpectationBaseline,
  actualResult: EconomicEventResult | null,
): Omit<
  EventSurpriseAssessment,
  "id" | "status" | "absoluteSurprise" | "percentSurprise" | "relation"
> {
  return {
    version: "v1",
    policy: EVENT_SURPRISE_POLICY_V1,
    eventIdentityKey: request.eventIdentityKey,
    sourceId: request.sourceId,
    releaseAt: new Date(Date.parse(request.releaseAt)).toISOString(),
    asOf: new Date(Date.parse(request.asOf)).toISOString(),
    expectedType: expectation.expectedType,
    baselineEventResultId: expectation.baselineEventResultId,
    actualEventResultId: actualResult?.id ?? null,
    expected: expectation.expected,
    actual: actualResult?.actual ?? null,
    unit: expectation.unit,
    period: expectation.period,
    expectationRetrievedAt: expectation.retrievedAt,
    actualRetrievedAt: actualResult
      ? new Date(Date.parse(actualResult.retrievedAt)).toISOString()
      : null,
    evidenceIds: stableEvidenceIds([
      expectation.evidenceId,
      actualResult?.evidenceId,
    ]),
    causalAttribution: "NOT_EVALUATED",
  };
}

function failClosed(
  request: EventSurpriseRequest,
  expectation: ExpectationBaseline,
  actualResult: EconomicEventResult | null,
  status: Exclude<EventSurpriseStatus, "VALID">,
  reason: string,
): EventSurpriseAssessment {
  return finish({
    ...baseAssessment(request, expectation, actualResult),
    status,
    absoluteSurprise: null,
    percentSurprise: null,
    relation: "UNKNOWN",
    reason,
  });
}

function assertExpectationLineage(
  request: EventSurpriseRequest,
  expectation: ExpectationBaseline,
): void {
  if (
    expectation.eventIdentityKey !== request.eventIdentityKey
    || expectation.sourceId !== request.sourceId
  ) {
    throw new Error(
      "Event Surprise expectation baseline must match Event identity and source.",
    );
  }

  if (Date.parse(expectation.releaseAt) !== Date.parse(request.releaseAt)) {
    throw new Error(
      "Event Surprise expectation baseline must use the same qualified release instant.",
    );
  }

  if (Date.parse(expectation.asOf) !== Date.parse(request.asOf)) {
    throw new Error(
      "Event Surprise expectation baseline must use the same point-in-time as-of cutoff.",
    );
  }

  if (
    request.expectedType !== undefined
    && expectation.expectedType !== null
    && expectation.expectedType !== request.expectedType
  ) {
    throw new Error(
      "Event Surprise expectation type must match the requested expectation type.",
    );
  }
}

/**
 * Measures the factual difference between one point-in-time EXP-001 expectation
 * and the latest actual EventResult that P365 knew by the requested as-of time.
 *
 * SUR-001 does not classify materiality, infer market meaning, or claim that
 * the event caused any subsequent market response.
 */
export function assessEventSurprise(
  input: EventSurpriseInput,
): EventSurpriseAssessment {
  const { releaseAtMs, asOfMs } = validateEventSurpriseRequest(input.request);
  assertExpectationLineage(input.request, input.expectation);

  const actualResult = selectActualEventResult(
    input.request,
    input.candidates,
  );

  if (asOfMs < releaseAtMs) {
    return failClosed(
      input.request,
      input.expectation,
      null,
      "MISSING",
      "The requested as-of time precedes the qualified event release; actual outcome is not yet available.",
    );
  }

  if (input.expectation.status === "UNKNOWN") {
    return failClosed(
      input.request,
      input.expectation,
      actualResult,
      "UNKNOWN",
      input.expectation.reason
        ?? "Expectation baseline is unavailable.",
    );
  }

  if (
    input.expectation.status === "MISSING"
    || input.expectation.expected === null
    || input.expectation.expectedType === null
  ) {
    return failClosed(
      input.request,
      input.expectation,
      actualResult,
      "MISSING",
      input.expectation.reason
        ?? "No qualified pre-release expectation is available.",
    );
  }

  if (!actualResult || actualResult.actual === undefined) {
    return failClosed(
      input.request,
      input.expectation,
      null,
      "MISSING",
      "No compatible actual EventResult was available by the requested as-of time.",
    );
  }

  if (input.expectation.status !== "VALID") {
    return failClosed(
      input.request,
      input.expectation,
      actualResult,
      "PARTIAL",
      input.expectation.reason
        ?? "Expectation baseline is incomplete for factual surprise measurement.",
    );
  }

  const actualUnit = nonEmpty(actualResult.unit);
  const actualPeriod = nonEmpty(actualResult.period);
  if (!actualUnit || !actualPeriod) {
    const missing = [
      ...(actualUnit ? [] : ["unit"]),
      ...(actualPeriod ? [] : ["period"]),
    ];
    return failClosed(
      input.request,
      input.expectation,
      actualResult,
      "PARTIAL",
      "Actual EventResult is incomplete for factual surprise measurement: missing "
        + missing.join(" and ")
        + ".",
    );
  }

  if (
    actualUnit !== input.expectation.unit
    || actualPeriod !== input.expectation.period
  ) {
    return failClosed(
      input.request,
      input.expectation,
      actualResult,
      "PARTIAL",
      "Expectation and actual EventResult must use identical unit and period.",
    );
  }

  const absoluteSurprise = actualResult.actual - input.expectation.expected;
  const percentSurprise = input.expectation.expected === 0
    ? null
    : (absoluteSurprise / Math.abs(input.expectation.expected)) * 100;

  return finish({
    ...baseAssessment(input.request, input.expectation, actualResult),
    status: "VALID",
    unit: actualUnit,
    period: actualPeriod,
    absoluteSurprise,
    percentSurprise,
    relation: relationFor(absoluteSurprise),
  });
}

export function eventSurpriseRepositoryFailureAssessment(
  request: EventSurpriseRequest,
  expectation: ExpectationBaseline,
): EventSurpriseAssessment {
  validateEventSurpriseRequest(request);
  assertExpectationLineage(request, expectation);
  return failClosed(
    request,
    expectation,
    null,
    "UNKNOWN",
    "Historical EventResult repository read failed; actual outcome is unavailable.",
  );
}
