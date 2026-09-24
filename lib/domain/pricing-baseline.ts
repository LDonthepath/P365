import { observationSemanticsForSeriesKey, resolveObservationSemantics } from "./observation-semantics";
import type {
  DataQuality,
  MarketDomain,
  Observation,
  ObservationDomain,
  ObservationSemantics,
} from "./types";
import { compareObservationHistory, observationSemanticSeriesKey } from "../repositories/observation-history";

export type PricingBaselineStatus =
  | "VALID"
  | "PARTIAL"
  | "STALE"
  | "MISSING"
  | "INCOMPATIBLE"
  | "UNKNOWN";

export const PRICING_BASELINE_SELECTION_POLICY =
  "latest-qualified-pricing-as-of-v1" as const;

export type PricingBaselineRequest = {
  identity: {
    domain: ObservationDomain;
    seriesKey: string;
  };
  /**
   * Provenance is explicit in PRC-001 so pre/post comparisons do not silently
   * jump between providers with different quote conventions.
   */
  sourceId: string;
  /** Point-in-time knowledge/capture cutoff. */
  asOf: string;
  /**
   * Explicit caller-owned tolerance for the reasoning question. There is no
   * universal intraday/daily pricing window hidden inside the baseline.
   */
  maxObservationAgeMs: number;
};

export type PricingBaseline = {
  kind: "PRICING";
  status: PricingBaselineStatus;
  seriesKey: string;
  legacyDomain: ObservationDomain;
  sourceId: string;
  asOf: string;
  maxObservationAgeMs: number;
  observationId: string | null;
  value: number | null;
  unit: string | null;
  observedAt: string | null;
  retrievedAt: string | null;
  ageMs: number | null;
  quality: DataQuality | null;
  evidenceId: string | null;
  marketDomain: MarketDomain | null;
  semantics: ObservationSemantics | null;
  selectionPolicy: typeof PRICING_BASELINE_SELECTION_POLICY;
  reason?: string;
};

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Pricing Baseline requires valid " + field + ".");
  }
  return parsed;
}

function metadataString(observation: Observation, key: string): string | null {
  const value = observation.metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function validatePricingBaselineRequest(
  request: PricingBaselineRequest,
): { asOfMs: number } {
  if (!request?.identity?.seriesKey?.trim()) {
    throw new Error("Pricing Baseline requires a non-empty seriesKey.");
  }
  if (!["MARKET", "MACRO", "ASSET", "OTHER"].includes(request.identity.domain)) {
    throw new Error("Pricing Baseline requires a valid legacy Observation domain.");
  }
  if (!request.sourceId?.trim()) {
    throw new Error("Pricing Baseline requires sourceId.");
  }
  if (!Number.isInteger(request.maxObservationAgeMs) || request.maxObservationAgeMs < 0) {
    throw new Error("Pricing Baseline maxObservationAgeMs must be a non-negative integer.");
  }
  return { asOfMs: timestamp(request.asOf, "asOf") };
}

function emptyBaseline(
  request: PricingBaselineRequest,
  status: "MISSING" | "INCOMPATIBLE" | "UNKNOWN",
  reason: string,
): PricingBaseline {
  return {
    kind: "PRICING",
    status,
    seriesKey: request.identity.seriesKey,
    legacyDomain: request.identity.domain,
    sourceId: request.sourceId,
    asOf: new Date(Date.parse(request.asOf)).toISOString(),
    maxObservationAgeMs: request.maxObservationAgeMs,
    observationId: null,
    value: null,
    unit: null,
    observedAt: null,
    retrievedAt: null,
    ageMs: null,
    quality: null,
    evidenceId: null,
    marketDomain: null,
    semantics: null,
    selectionPolicy: PRICING_BASELINE_SELECTION_POLICY,
    reason,
  };
}

export function pricingRepositoryFailureBaseline(
  request: PricingBaselineRequest,
): PricingBaseline {
  validatePricingBaselineRequest(request);
  return emptyBaseline(
    request,
    "UNKNOWN",
    "Historical Observation repository read failed; pricing baseline is unavailable.",
  );
}

export function selectPricingBaseline(
  request: PricingBaselineRequest,
  candidates: Observation[],
): PricingBaseline {
  const { asOfMs } = validatePricingBaselineRequest(request);

  const requestedSemantics = observationSemanticsForSeriesKey(
    request.identity.seriesKey,
  );

  if (!requestedSemantics || requestedSemantics.informationClass !== "PRICING") {
    return emptyBaseline(
      request,
      "INCOMPATIBLE",
      "Requested series is not approved as canonical PRICING information.",
    );
  }

  const scoped = candidates
    .filter((candidate) => candidate.domain === request.identity.domain)
    .filter((candidate) => observationSemanticSeriesKey(candidate) === request.identity.seriesKey)
    .filter((candidate) => candidate.sourceId === request.sourceId)
    .filter((candidate) => {
      const observedAt = Date.parse(candidate.observedAt);
      const retrievedAt = Date.parse(candidate.retrievedAt);
      return Number.isFinite(observedAt)
        && Number.isFinite(retrievedAt)
        && observedAt <= asOfMs
        && retrievedAt <= asOfMs;
    })
    .sort((a, b) => compareObservationHistory(b, a));

  const selected = scoped[0];
  if (!selected) {
    return emptyBaseline(
      request,
      "MISSING",
      "No point-in-time-compatible pricing observation was available at the requested cutoff.",
    );
  }

  const semantics = resolveObservationSemantics(selected);
  if (!semantics || semantics.informationClass !== "PRICING") {
    return emptyBaseline(
      request,
      "INCOMPATIBLE",
      "Selected observation is not semantically qualified as PRICING.",
    );
  }

  const value = Number(selected.value);
  if (!Number.isFinite(value)) {
    return {
      ...emptyBaseline(
        request,
        "INCOMPATIBLE",
        "Selected pricing observation does not contain a finite numeric value.",
      ),
      observationId: selected.id,
      observedAt: selected.observedAt,
      retrievedAt: selected.retrievedAt,
      quality: selected.quality,
      evidenceId: selected.evidenceId,
      marketDomain: semantics.marketDomain,
      semantics,
    };
  }

  const observedAtMs = Date.parse(selected.observedAt);
  const ageMs = asOfMs - observedAtMs;
  const unit = metadataString(selected, "unit");

  let status: PricingBaselineStatus = "VALID";
  let reason: string | undefined;

  if (selected.quality === "UNKNOWN" || selected.quality === "PARTIAL") {
    status = "UNKNOWN";
    reason = "Selected pricing observation quality is insufficient for a valid baseline.";
  } else if (
    selected.quality === "STALE"
    || ageMs > request.maxObservationAgeMs
  ) {
    status = "STALE";
    reason = selected.quality === "STALE"
      ? "Selected pricing observation was stored as stale."
      : "Selected pricing observation exceeds the caller-defined age tolerance.";
  } else if (!unit) {
    status = "PARTIAL";
    reason = "Selected pricing observation is missing an explicit unit.";
  }

  return {
    kind: "PRICING",
    status,
    seriesKey: request.identity.seriesKey,
    legacyDomain: request.identity.domain,
    sourceId: request.sourceId,
    asOf: new Date(asOfMs).toISOString(),
    maxObservationAgeMs: request.maxObservationAgeMs,
    observationId: selected.id,
    value,
    unit,
    observedAt: new Date(observedAtMs).toISOString(),
    retrievedAt: new Date(Date.parse(selected.retrievedAt)).toISOString(),
    ageMs,
    quality: selected.quality,
    evidenceId: selected.evidenceId,
    marketDomain: semantics.marketDomain,
    semantics,
    selectionPolicy: PRICING_BASELINE_SELECTION_POLICY,
    ...(reason ? { reason } : {}),
  };
}
