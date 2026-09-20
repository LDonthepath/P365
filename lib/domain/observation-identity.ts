import { createHash } from "node:crypto";
import type { ObservationDomain, ObservationIdentity } from "./types";

export const OBSERVATION_IDENTITY_VERSION = "v1" as const;

type ObservationIdentityInput = {
  domain: ObservationDomain;
  seriesKey: string;
  observedAt: string;
  sourceId: string;
  value: string;
  unit?: string | null;
  frequency?: string | null;
};

function sha256(parts: Array<string | null>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

/** Numeric formatting alone is not a factual revision. */
export function canonicalObservationValue(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match) return trimmed;

  const exponent = Number(match[4] ?? "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1_000) return trimmed;

  const sign = match[1] === "-" ? "-" : "";
  const fraction = match[3] ?? "";
  let digits = `${match[2]}${fraction}`.replace(/^0+/, "");
  if (!digits) return "0";

  let scale = fraction.length - exponent;
  while (scale > 0 && digits.endsWith("0")) {
    digits = digits.slice(0, -1);
    scale -= 1;
  }

  if (scale <= 0) return `${sign}${digits}${"0".repeat(-scale)}`;
  if (digits.length <= scale) return `${sign}0.${"0".repeat(scale - digits.length)}${digits}`;
  const split = digits.length - scale;
  return `${sign}${digits.slice(0, split)}.${digits.slice(split)}`;
}

/**
 * Identity for future Observation writes. Logical series identity remains the
 * FND-001 domain + seriesKey contract; sourceId qualifies revision provenance.
 * retrievedAt is intentionally excluded so an identical refetch stays one
 * factual version.
 */
export function buildObservationIdentity(input: ObservationIdentityInput): ObservationIdentity {
  const seriesKey = input.seriesKey.trim();
  if (!seriesKey) throw new Error("Observation identity requires a non-empty semantic series key.");

  const observedAt = new Date(input.observedAt);
  if (!Number.isFinite(observedAt.getTime())) {
    throw new Error("Observation identity requires a valid observedAt timestamp.");
  }

  const measurementId = `measurement-v1-${sha256([
    input.domain,
    seriesKey,
    observedAt.toISOString(),
  ])}`;
  const revisionFingerprint = sha256([
    measurementId,
    input.sourceId,
    canonicalObservationValue(input.value),
    input.unit ?? null,
    input.frequency ?? null,
  ]);

  return {
    version: OBSERVATION_IDENTITY_VERSION,
    seriesKey,
    measurementId,
    revisionFingerprint,
  };
}

export function observationRevisionId(identity: ObservationIdentity): string {
  return `observation-v1-${identity.revisionFingerprint}`;
}

export function observationEvidenceId(identity: ObservationIdentity): string {
  return `evidence-observation-v1-${identity.revisionFingerprint}`;
}
