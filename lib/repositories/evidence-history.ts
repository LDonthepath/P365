import type { Evidence } from "../domain/types";
import type { EvidenceHistoryQuery } from "./types";

export const MAX_EVIDENCE_HISTORY_LIMIT = 500;

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field} timestamp: ${value}`);
  return parsed;
}

export function evidenceHistoryEffectiveAt(evidence: Evidence): number {
  const value = evidence.publishedAt ?? evidence.releasedAt ?? evidence.retrievedAt;
  return timestamp(value, "Evidence effective time");
}

export function validateEvidenceHistoryQuery(
  query: EvidenceHistoryQuery,
): {
  effectiveFrom?: number;
  effectiveThrough?: number;
  retrievedThrough?: number;
} {
  if (!query) throw new Error("Evidence history query is required.");
  if (query.sourceId !== undefined && !query.sourceId.trim()) {
    throw new Error("Evidence history sourceId must be non-empty when supplied.");
  }
  if (
    query.kind !== undefined
    && !["NEWS", "OBSERVATION", "EVENT"].includes(query.kind)
  ) {
    throw new Error("Evidence history kind is invalid.");
  }
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > MAX_EVIDENCE_HISTORY_LIMIT) {
    throw new Error(
      `Evidence history limit must be an integer between 1 and ${MAX_EVIDENCE_HISTORY_LIMIT}.`,
    );
  }
  if (query.order !== "ASC" && query.order !== "DESC") {
    throw new Error("Evidence history order must be ASC or DESC.");
  }

  for (const [key, value] of Object.entries(query.metadataEquals ?? {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      throw new Error("Evidence history metadata filter keys must be simple alphanumeric identifiers.");
    }
    if (!value.trim()) {
      throw new Error("Evidence history metadata filter values must be non-empty.");
    }
  }

  const effectiveFrom = query.effectiveAtOnOrAfter === undefined
    ? undefined
    : timestamp(query.effectiveAtOnOrAfter, "effectiveAtOnOrAfter");
  const effectiveThrough = query.effectiveAtOnOrBefore === undefined
    ? undefined
    : timestamp(query.effectiveAtOnOrBefore, "effectiveAtOnOrBefore");
  const retrievedThrough = query.retrievedAtOnOrBefore === undefined
    ? undefined
    : timestamp(query.retrievedAtOnOrBefore, "retrievedAtOnOrBefore");

  if (
    effectiveFrom !== undefined
    && effectiveThrough !== undefined
    && effectiveFrom > effectiveThrough
  ) {
    throw new Error("Evidence history effective lower bound must not be after upper bound.");
  }

  return { effectiveFrom, effectiveThrough, retrievedThrough };
}

export function compareEvidenceHistory(a: Evidence, b: Evidence): number {
  const effective = evidenceHistoryEffectiveAt(a) - evidenceHistoryEffectiveAt(b);
  if (effective !== 0) return effective;
  const retrieved = timestamp(a.retrievedAt, "Evidence.retrievedAt")
    - timestamp(b.retrievedAt, "Evidence.retrievedAt");
  if (retrieved !== 0) return retrieved;
  return a.id.localeCompare(b.id);
}
