import {
  selectPcepiMacroEvidenceAt,
  type MacroEvidenceHistoryPort,
  type MacroEvidencePoint,
  type MacroEvidenceSlot,
} from "./macro-evidence-bundle";

export const PCEPI_SA_MOM_METHOD_VERSION = "PCEPI_SA_MOM_V0_1" as const;
export type PcepiMoMGap =
  | "NO_ELIGIBLE_CURRENT"
  | "NO_ADJACENT_PREDECESSOR"
  | "UNQUALIFIED_SOURCE_OR_QUALITY"
  | "INCOMPATIBLE_VINTAGE"
  | "INVALID_INDEX_VALUE"
  | "DURABLE_READ_FAILED";
export type PcepiMoMEvidence = {
  observationId: string;
  evidenceId: string;
  seriesId: "PCEPI";
  sourceId: "fred";
  index: string;
  period: string;
  retrievedAt: string | null;
  capturedAt: string;
  vintageDate: string;
  releasedAt: string | null;
  knownBy: MacroEvidencePoint["knownBy"];
  revisionFingerprint: string | null;
};
export type PcepiSaMoMResult = {
  methodVersion: typeof PCEPI_SA_MOM_METHOD_VERSION;
  status: "AVAILABLE" | "INSUFFICIENT";
  reason: PcepiMoMGap | null;
  asOf: string;
  requestedPeriod: string | null;
  /** FRED PCEPI is the BEA seasonally adjusted native index (2017=100). */
  seriesId: "PCEPI";
  seasonality: "SEASONALLY_ADJUSTED";
  nativeIndexUnit: "Index 2017=100";
  outputUnit: "PERCENT_MONTH_OVER_MONTH";
  formula: "100 * (current / predecessor - 1)";
  current: PcepiMoMEvidence | null;
  predecessor: PcepiMoMEvidence | null;
  /** Exact rational percentage before formatting; integers prevent FP drift. */
  exactPercentFraction: { numerator: string; denominator: string } | null;
  roundedPercent: string | null;
  decimals: 6;
  rounding: "HALF_AWAY_FROM_ZERO";
  sourceReleaseInstant: "UNVERIFIED";
  sourceRights: "REVIEW_REQUIRED_BEFORE_PUBLIC_REDISTRIBUTION";
  significance: "NOT_EVALUATED";
  causality: "NOT_EVALUATED";
};
const BASIS = {
  methodVersion: PCEPI_SA_MOM_METHOD_VERSION,
  seriesId: "PCEPI",
  seasonality: "SEASONALLY_ADJUSTED",
  nativeIndexUnit: "Index 2017=100",
  outputUnit: "PERCENT_MONTH_OVER_MONTH",
  formula: "100 * (current / predecessor - 1)",
  decimals: 6,
  rounding: "HALF_AWAY_FROM_ZERO",
  sourceReleaseInstant: "UNVERIFIED",
  sourceRights: "REVIEW_REQUIRED_BEFORE_PUBLIC_REDISTRIBUTION",
  significance: "NOT_EVALUATED",
  causality: "NOT_EVALUATED",
} as const;

function missing(asOf: string, requestedPeriod: string | null, reason: PcepiMoMGap): PcepiSaMoMResult {
  return {
    ...BASIS, status: "INSUFFICIENT", reason, asOf, requestedPeriod,
    current: null, predecessor: null, exactPercentFraction: null, roundedPercent: null,
  };
}
function toEvidence(point: MacroEvidencePoint): PcepiMoMEvidence {
  return {
    observationId: point.observationId, evidenceId: point.evidenceId,
    seriesId: "PCEPI", sourceId: "fred", index: point.value,
    period: point.observationPeriod, retrievedAt: point.retrievedAt,
    capturedAt: point.capturedAt, vintageDate: point.vintageDate,
    releasedAt: point.releasedAt, knownBy: point.knownBy,
    revisionFingerprint: point.revisionFingerprint,
  };
}
function adjacentMonth(current: string, previous: string): boolean {
  if (!/^\d{4}-\d{2}-01$/.test(current) || !/^\d{4}-\d{2}-01$/.test(previous)) return false;
  const currentMs = Date.parse(current + "T00:00:00Z");
  const previousMs = Date.parse(previous + "T00:00:00Z");
  if (!Number.isFinite(currentMs) || !Number.isFinite(previousMs)) return false;
  const expected = new Date(currentMs);
  expected.setUTCMonth(expected.getUTCMonth() - 1);
  return expected.toISOString().slice(0, 10) === previous;
}
type IndexDecimal = { integer: bigint; scale: bigint };
function parseIndex(raw: string): IndexDecimal | null {
  // PCEPI is a positive index level. Never permit NaN, exponents, currency,
  // negative/zero values, excess precision, or float coercion.
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(raw)) return null;
  const [whole, decimals = ""] = raw.split(".");
  const scale = BigInt(10) ** BigInt(decimals.length);
  const integer = BigInt(whole + decimals);
  return integer > BigInt(0) ? { integer, scale } : null;
}
function bigintGcd(left: bigint, right: bigint): bigint {
  let a = left < BigInt(0) ? -left : left;
  let b = right < BigInt(0) ? -right : right;
  while (b !== BigInt(0)) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a === BigInt(0) ? BigInt(1) : a;
}
function formatRounded(numerator: bigint, denominator: bigint): string {
  if (denominator <= BigInt(0)) throw new Error("Invalid PCEPI denominator");
  const negative = numerator < BigInt(0);
  const absolute = negative ? -numerator : numerator;
  const micro = (absolute * BigInt(1000000) * BigInt(100) * BigInt(2) + denominator) / (BigInt(2) * denominator);
  const whole = micro / BigInt(1000000);
  const fraction = (micro % BigInt(1000000)).toString().padStart(6, "0");
  return (negative && micro !== BigInt(0) ? "-" : "") + whole.toString() + "." + fraction;
}
/**
 * Pure, exactly specified measurement. A #370 qualified current and same-as-of
 * predecessor are necessary but not sufficient: period adjacency, FRED source,
 * SA-index native unit, quality and compatible vintage must also hold.
 */
export function calculatePcepiSaMoM(
  slot: MacroEvidenceSlot,
  asOf: string,
  requestedPeriod: string | null = null,
): PcepiSaMoMResult {
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff) || new Date(cutoff).toISOString() !== asOf) {
    throw new Error("Invalid PCEPI MoM as-of clock");
  }
  if (slot.seriesId !== "PCEPI" || slot.family !== "INFLATION"
    || slot.kind !== "OBSERVED_FACT") {
    return missing(asOf, requestedPeriod, "UNQUALIFIED_SOURCE_OR_QUALITY");
  }
  if (slot.status !== "AVAILABLE" || !slot.latest) {
    return missing(asOf, requestedPeriod, slot.status === "UNAVAILABLE"
      ? "DURABLE_READ_FAILED" : slot.status === "MISSING"
        ? "NO_ELIGIBLE_CURRENT" : "UNQUALIFIED_SOURCE_OR_QUALITY");
  }
  const current = slot.latest;
  if (requestedPeriod && current.observationPeriod !== requestedPeriod) {
    return missing(asOf, requestedPeriod, "NO_ELIGIBLE_CURRENT");
  }
  const previous = slot.predecessor;
  if (!previous || !adjacentMonth(current.observationPeriod, previous.observationPeriod)) {
    return missing(asOf, requestedPeriod, "NO_ADJACENT_PREDECESSOR");
  }
  for (const row of [current, previous]) {
    if (row.seriesId !== "PCEPI" || row.sourceId !== "fred"
      || row.nativeUnit !== "Index 2017=100" || row.cadence !== "MONTHLY"
      || row.quality !== "FRESH" || !row.observationId || !row.evidenceId
      || !Number.isFinite(Date.parse(row.capturedAt))
      || Date.parse(row.capturedAt) > cutoff
      || (row.retrievedAt != null &&
        (!Number.isFinite(Date.parse(row.retrievedAt)) || Date.parse(row.retrievedAt) > cutoff))
      || !/^\d{4}-\d{2}-\d{2}$/.test(row.vintageDate)
      || row.vintageDate > asOf.slice(0, 10)
      || (row.releasedAt !== null &&
        (!Number.isFinite(Date.parse(row.releasedAt)) || Date.parse(row.releasedAt) > cutoff))) {
      return missing(asOf, requestedPeriod, "UNQUALIFIED_SOURCE_OR_QUALITY");
    }
  }
  if (current.vintageDate !== previous.vintageDate) {
    return missing(asOf, requestedPeriod, "INCOMPATIBLE_VINTAGE");
  }
  const now = parseIndex(current.value);
  const prior = parseIndex(previous.value);
  if (!now || !prior) return missing(asOf, requestedPeriod, "INVALID_INDEX_VALUE");
  // (a/b-1) exactly: a = now.integer / now.scale, b = prior.integer / prior.scale.
  const numerator = now.integer * prior.scale - prior.integer * now.scale;
  const denominator = prior.integer * now.scale;
  const percentNumerator = numerator * BigInt(100);
  // Canonical lowest-terms rational: independent of native input scale formatting.
  const divisor = bigintGcd(percentNumerator, denominator);
  return {
    ...BASIS, status: "AVAILABLE", reason: null, asOf, requestedPeriod,
    current: toEvidence(current), predecessor: toEvidence(previous),
    exactPercentFraction: {
      numerator: (percentNumerator / divisor).toString(),
      denominator: (denominator / divisor).toString(),
    },
    roundedPercent: formatRounded(numerator, denominator),
  };
}
/**
 * Read a single durable PCEPI series, never all markets or live providers.
 * Targeted historical replay uses the same #370 source/capture/retrieval/vintage
 * selector with a calendar-period ceiling. It does not make any DB writes.
 */
export async function buildPcepiSaMoM(
  source: MacroEvidenceHistoryPort,
  asOf: Date,
  targetPeriod?: string,
): Promise<PcepiSaMoMResult> {
  if (!Number.isFinite(asOf.getTime())) throw new Error("Invalid PCEPI cutoff");
  const cutoff = asOf.toISOString();
  if (targetPeriod !== undefined
    && (!/^\d{4}-(?:0[1-9]|1[0-2])-01$/.test(targetPeriod)
      || targetPeriod > cutoff.slice(0, 10))) {
    throw new Error("Invalid PCEPI target calendar month");
  }
  try {
    const rows = await source.findAsOf({ seriesId: "PCEPI", asOf: cutoff, limit: 500 });
    if (!Array.isArray(rows) || rows.length >= 500) {
      return missing(cutoff, targetPeriod ?? null, "DURABLE_READ_FAILED");
    }
    const slot = selectPcepiMacroEvidenceAt(rows, cutoff, targetPeriod);
    return calculatePcepiSaMoM(slot, cutoff, targetPeriod ?? null);
  } catch {
    return missing(cutoff, targetPeriod ?? null, "DURABLE_READ_FAILED");
  }
}
