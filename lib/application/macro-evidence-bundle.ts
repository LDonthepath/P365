import type { Observation } from "../domain/types";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";

/**
 * #370 only: reuse canonical Observation, preserving the SQL captured_at
 * alongside it. Legacy persisted payloads can lack retrievedAt.
 * This is a read port, not a second canonical Observation definition.
 */
export type StoredMacroObservation = Omit<Observation, "retrievedAt"> & {
  retrievedAt?: string | null;
};
export type CapturedMacroObservation = {
  observation: StoredMacroObservation;
  capturedAt: string;
};
export type MacroEvidenceHistoryPort = {
  findAsOf(input: {
    seriesId: string;
    asOf: string;
    limit: number;
  }): Promise<CapturedMacroObservation[]>;
};

const MACRO_SLOTS = [
  { seriesId: "GDPC1", family: "GROWTH", kind: "OBSERVED_FACT" },
  { seriesId: "PCEPI", family: "INFLATION", kind: "OBSERVED_FACT" },
  { seriesId: "PAYEMS", family: "LABOR", kind: "OBSERVED_FACT" },
  { seriesId: "FEDFUNDS", family: "POLICY", kind: "OBSERVED_FACT" },
  { seriesId: "SOFR", family: "FUNDING_RATES", kind: "OBSERVED_FACT" },
  { seriesId: "SAHMREALTIME", family: "PUBLISHED_INDICATOR", kind: "PUBLISHED_INDICATOR" },
] as const;

type Slot = (typeof MACRO_SLOTS)[number];
export type MacroEvidenceStatus =
  | "AVAILABLE" | "MISSING" | "STALE" | "PARTIAL" | "INCOMPATIBLE" | "UNAVAILABLE";
export type MacroEvidenceGapReason =
  | "NO_ELIGIBLE_HISTORY" | "NO_ADJACENT_HISTORY"
  | "STALE_QUALITY" | "PARTIAL_QUALITY" | "SOURCE_OR_METADATA_MISMATCH"
  | "DURABLE_READ_FAILED" | "EXPECTATION_NOT_QUALIFIED";

export type MacroEvidencePoint = {
  observationId: string;
  evidenceId: string;
  sourceId: "fred";
  seriesId: string;
  value: string;
  nativeUnit: string;
  cadence: string;
  quality: Observation["quality"];
  observedAt: string;
  observationPeriod: string;
  retrievedAt: string | null;
  capturedAt: string;
  /** Date-only FRED vintage; never an exact release timestamp. */
  vintageDate: string;
  /** Exact source release instant only when explicitly supplied and validated. */
  releasedAt: string | null;
  knownBy: "RETRIEVED_AND_CAPTURED" | "CAPTURED_ONLY";
  revisionFingerprint: string | null;
};

export type MacroEvidenceSlot = {
  seriesId: Slot["seriesId"];
  family: Slot["family"];
  kind: Slot["kind"];
  status: MacroEvidenceStatus;
  latest: MacroEvidencePoint | null;
  predecessor: MacroEvidencePoint | null;
  gap: MacroEvidenceGapReason | null;
};
export type MacroEvidenceBundle = {
  asOf: string;
  slots: MacroEvidenceSlot[];
  expectations: {
    status: "MISSING";
    gap: "EXPECTATION_NOT_QUALIFIED";
  };
};

const MAX_HISTORY_ROWS = 500;
function instant(value: string | undefined | null): number {
  if (typeof value !== "string" || !value.trim()) return NaN;
  return Date.parse(value);
}
function dateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(value + "T00:00:00.000Z");
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value
    ? value : null;
}
function empty(slot: Slot, status: MacroEvidenceStatus, gap: MacroEvidenceGapReason): MacroEvidenceSlot {
  return { ...slot, status, latest: null, predecessor: null, gap };
}

/**
 * A producer may persist duplicate captures and multiple vintages.
 * Select the newest *stored and known* version for each observed period at T.
 * Do not conflate observedAt, retrievedAt, captured_at, and releasedAt.
 */
function selectPoints(
  rows: CapturedMacroObservation[],
  slot: Slot,
  asOf: string,
  targetPeriod?: string,
): MacroEvidenceSlot {
  const registry = MACRO_SERIES_REGISTRY.find((r) => r.seriesId === slot.seriesId);
  if (!registry || registry.domain !== "MACRO" || registry.source !== "FRED") {
    return empty(slot, "INCOMPATIBLE", "SOURCE_OR_METADATA_MISMATCH");
  }
  const cutoff = instant(asOf);
  const qualified: Array<{ point: MacroEvidencePoint; observedMs: number; capturedMs: number }> = [];
  for (const row of rows) {
    const o = row.observation;
    const m = o.metadata;
    const observedMs = instant(o.observedAt);
    const capturedMs = instant(row.capturedAt);
    const retrievedMs = instant(o.retrievedAt);
    const vintage = dateOnly(m?.vintageDate);
    const observationPeriod = dateOnly(m?.observationDate);
    const releaseRaw = m?.releasedAt;
    const releasedAt = typeof releaseRaw === "string"
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(releaseRaw)
      && Number.isFinite(Date.parse(releaseRaw)) ? releaseRaw : null;
    const releasedMs = releasedAt ? instant(releasedAt) : NaN;
    const numeric = typeof o.value === "string" && o.value.trim() && Number.isFinite(Number(o.value));
    // No fallback to a different source, series, unit, cadence or semantic domain.
    if (o.domain !== "MACRO" || o.sourceId !== "fred"
      || m?.seriesId !== slot.seriesId || m?.unit !== registry.unit
      || m?.frequency !== registry.frequency
      || (o.identity && o.identity.seriesKey !== slot.seriesId)
      || (o.semantics && (o.semantics.marketDomain === "CRYPTO"
        || o.semantics.informationClass !== "OBSERVATION"
        || (o.semantics.jurisdiction && o.semantics.jurisdiction !== "US")))
      || !Number.isFinite(observedMs) || !Number.isFinite(capturedMs)
      || !vintage || !observationPeriod
      || observationPeriod !== o.observedAt.slice(0, 10) || !numeric
      || (o.retrievedAt != null && !Number.isFinite(retrievedMs))
      || (releasedAt !== null && !Number.isFinite(releasedMs))) {
      return empty(slot, "INCOMPATIBLE", "SOURCE_OR_METADATA_MISMATCH");
    }
    // An as-of query must be safe even when its transport is mocked or faulty.
    if (observedMs > cutoff || capturedMs > cutoff
      || (o.retrievedAt != null && retrievedMs > cutoff)
      || (releasedAt !== null && releasedMs > cutoff)
      || vintage > asOf.slice(0, 10)
      || (targetPeriod !== undefined && observationPeriod > targetPeriod)) continue;
    if (o.quality !== "FRESH" && o.quality !== "STALE" && o.quality !== "PARTIAL") {
      return empty(slot, "INCOMPATIBLE", "SOURCE_OR_METADATA_MISMATCH");
    }
    qualified.push({
      observedMs, capturedMs,
      point: {
        observationId: o.id, evidenceId: o.evidenceId, sourceId: "fred",
        seriesId: slot.seriesId, value: o.value, nativeUnit: registry.unit,
        cadence: registry.frequency, quality: o.quality, observedAt: o.observedAt,
        observationPeriod, retrievedAt: o.retrievedAt ?? null,
        capturedAt: row.capturedAt, vintageDate: vintage, releasedAt,
        knownBy: o.retrievedAt == null ? "CAPTURED_ONLY" : "RETRIEVED_AND_CAPTURED",
        revisionFingerprint: o.identity?.revisionFingerprint ?? null,
      },
    });
  }
  qualified.sort((a, b) => b.observedMs - a.observedMs
    || b.capturedMs - a.capturedMs
    || instant(b.point.retrievedAt || b.point.capturedAt)
      - instant(a.point.retrievedAt || a.point.capturedAt)
    || b.point.observationId.localeCompare(a.point.observationId));
  if (qualified.length === 0) return empty(slot, "MISSING", "NO_ELIGIBLE_HISTORY");
  const latest = qualified[0].point;
  if (targetPeriod !== undefined && latest.observationPeriod !== targetPeriod) {
    return empty(slot, "MISSING", "NO_ELIGIBLE_HISTORY");
  }
  if (latest.quality === "STALE") return empty(slot, "STALE", "STALE_QUALITY");
  if (latest.quality === "PARTIAL") return empty(slot, "PARTIAL", "PARTIAL_QUALITY");
  const predecessor = qualified.find((candidate) =>
    candidate.point.observationPeriod !== latest.observationPeriod)?.point ?? null;
  return {
    ...slot, status: "AVAILABLE", latest, predecessor,
    gap: predecessor ? null : "NO_ADJACENT_HISTORY",
  };
}

/**
 * Macro-only, source-qualified, bounded and read-only evidence assembly.
 * No economic change calculation, surprise, catalyst, causality or market price.
 */
export async function buildMacroEvidenceBundle(
  history: MacroEvidenceHistoryPort,
  asOf: Date,
): Promise<MacroEvidenceBundle> {
  if (!Number.isFinite(asOf.getTime())) throw new Error("Invalid macro knowledgeAsOf");
  const cutoff = asOf.toISOString();
  const slots = await Promise.all(MACRO_SLOTS.map(async (slot): Promise<MacroEvidenceSlot> => {
    try {
      const rows = await history.findAsOf({ seriesId: slot.seriesId, asOf: cutoff, limit: MAX_HISTORY_ROWS });
      if (!Array.isArray(rows) || rows.length >= MAX_HISTORY_ROWS) {
        return empty(slot, "UNAVAILABLE", "DURABLE_READ_FAILED");
      }
      return selectPoints(rows, slot, cutoff);
    } catch {
      return empty(slot, "UNAVAILABLE", "DURABLE_READ_FAILED");
    }
  }));
  return {
    asOf: cutoff, slots,
    // No unqualified survey/market expectation is silently inferred from levels.
    expectations: { status: "MISSING", gap: "EXPECTATION_NOT_QUALIFIED" },
  };
}

/**
 * #372 pilot-only: expose the same #370 qualified PIT point selection for a
 * specific PCEPI calendar month. No new historical identity or write path.
 * The comparison layer independently enforces the adjacent month and method.
 */
export function selectPcepiMacroEvidenceAt(
  rows: CapturedMacroObservation[],
  asOf: string,
  targetPeriod?: string,
): MacroEvidenceSlot {
  if (!Number.isFinite(instant(asOf)) || new Date(instant(asOf)).toISOString() !== asOf) {
    throw new Error("Invalid PCEPI shared knowledge cutoff");
  }
  if (targetPeriod !== undefined
    && (dateOnly(targetPeriod) !== targetPeriod || !targetPeriod.endsWith("-01"))) {
    throw new Error("PCEPI target must be a first-of-month calendar period");
  }
  return selectPoints(rows, MACRO_SLOTS[1], asOf, targetPeriod);
}
