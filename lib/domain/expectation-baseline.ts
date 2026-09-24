import type { EconomicEventResult, EventExpectedType } from "./event-result";

export type ExpectationBaselineStatus = "VALID" | "PARTIAL" | "MISSING" | "UNKNOWN";

export const EXPECTATION_BASELINE_SELECTION_POLICY =
  "latest-qualified-pre-release-v1" as const;

export type ExpectationBaselineRequest = {
  eventIdentityKey: string;
  sourceId: string;
  /** Exact qualified event release/schedule instant. */
  releaseAt: string;
  /** Knowledge-state cutoff requested by the caller. */
  asOf: string;
  expectedType?: EventExpectedType;
};

export type ExpectationBaseline = {
  kind: "EXPECTATION";
  status: ExpectationBaselineStatus;
  eventIdentityKey: string;
  sourceId: string;
  releaseAt: string;
  asOf: string;
  selectionCutoff: string;
  baselineEventResultId: string | null;
  expected: number | null;
  expectedType: EventExpectedType | null;
  unit: string | null;
  period: string | null;
  retrievedAt: string | null;
  evidenceId: string | null;
  selectionPolicy: typeof EXPECTATION_BASELINE_SELECTION_POLICY;
  reason?: string;
};

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Expectation Baseline requires valid " + field + ".");
  }
  return parsed;
}

function nonEmpty(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function validateExpectationBaselineRequest(
  request: ExpectationBaselineRequest,
): { releaseAtMs: number; asOfMs: number; cutoffMs: number } {
  if (!request.eventIdentityKey?.trim()) {
    throw new Error("Expectation Baseline requires eventIdentityKey.");
  }
  if (!request.sourceId?.trim()) {
    throw new Error("Expectation Baseline requires sourceId.");
  }
  const releaseAtMs = timestamp(request.releaseAt, "releaseAt");
  const asOfMs = timestamp(request.asOf, "asOf");
  const cutoffMs = Math.min(asOfMs, releaseAtMs - 1);
  return { releaseAtMs, asOfMs, cutoffMs };
}

export function expectationBaselineCutoff(
  request: ExpectationBaselineRequest,
): string {
  return new Date(validateExpectationBaselineRequest(request).cutoffMs).toISOString();
}

function eligible(
  request: ExpectationBaselineRequest,
  cutoffMs: number,
  result: EconomicEventResult,
): boolean {
  if (
    result.eventIdentityKey !== request.eventIdentityKey
    || result.sourceId !== request.sourceId
    || result.expected === undefined
    || !Number.isFinite(result.expected)
    || result.expectedType === undefined
    || (
      request.expectedType !== undefined
      && result.expectedType !== request.expectedType
    )
  ) {
    return false;
  }

  const retrievedAt = Date.parse(result.retrievedAt);
  return Number.isFinite(retrievedAt) && retrievedAt <= cutoffMs;
}

function missingBaseline(
  request: ExpectationBaselineRequest,
  selectionCutoff: string,
  reason: string,
  status: "MISSING" | "UNKNOWN" = "MISSING",
): ExpectationBaseline {
  return {
    kind: "EXPECTATION",
    status,
    eventIdentityKey: request.eventIdentityKey,
    sourceId: request.sourceId,
    releaseAt: new Date(Date.parse(request.releaseAt)).toISOString(),
    asOf: new Date(Date.parse(request.asOf)).toISOString(),
    selectionCutoff,
    baselineEventResultId: null,
    expected: null,
    expectedType: null,
    unit: null,
    period: null,
    retrievedAt: null,
    evidenceId: null,
    selectionPolicy: EXPECTATION_BASELINE_SELECTION_POLICY,
    reason,
  };
}

export function expectationRepositoryFailureBaseline(
  request: ExpectationBaselineRequest,
): ExpectationBaseline {
  const selectionCutoff = expectationBaselineCutoff(request);
  return missingBaseline(
    request,
    selectionCutoff,
    "Historical EventResult repository read failed; expectation baseline is unavailable.",
    "UNKNOWN",
  );
}

export function selectExpectationBaseline(
  request: ExpectationBaselineRequest,
  candidates: EconomicEventResult[],
): ExpectationBaseline {
  const cutoffMs = validateExpectationBaselineRequest(request).cutoffMs;
  const selectionCutoff = new Date(cutoffMs).toISOString();
  const baseline = candidates
    .filter((result) => eligible(request, cutoffMs, result))
    .sort((a, b) => {
      const time = Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt);
      return time !== 0 ? time : b.id.localeCompare(a.id);
    })[0];

  if (!baseline || baseline.expected === undefined || baseline.expectedType === undefined) {
    return missingBaseline(
      request,
      selectionCutoff,
      "No compatible expectation snapshot was available before the point-in-time cutoff.",
    );
  }

  const unit = nonEmpty(baseline.unit);
  const period = nonEmpty(baseline.period);
  const status: ExpectationBaselineStatus = unit && period ? "VALID" : "PARTIAL";
  const missing = [
    ...(unit ? [] : ["unit"]),
    ...(period ? [] : ["period"]),
  ];

  return {
    kind: "EXPECTATION",
    status,
    eventIdentityKey: request.eventIdentityKey,
    sourceId: request.sourceId,
    releaseAt: new Date(Date.parse(request.releaseAt)).toISOString(),
    asOf: new Date(Date.parse(request.asOf)).toISOString(),
    selectionCutoff,
    baselineEventResultId: baseline.id,
    expected: baseline.expected,
    expectedType: baseline.expectedType,
    unit,
    period,
    retrievedAt: new Date(Date.parse(baseline.retrievedAt)).toISOString(),
    evidenceId: baseline.evidenceId,
    selectionPolicy: EXPECTATION_BASELINE_SELECTION_POLICY,
    ...(missing.length > 0
      ? {
          reason:
            "Selected expectation is incomplete for downstream surprise use: missing "
            + missing.join(" and ")
            + ".",
        }
      : {}),
  };
}
