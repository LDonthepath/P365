import type { Observation } from "../domain/types";
import { canonicalObservationValue } from "../domain/observation-identity";

/**
 * OBS-FRED-001C: OFFLINE / READ-ONLY proof. Not connected to ingestion.
 *
 * The calling workflow MUST independently prove:
 * - the candidate actually appeared in the database INSERT RETURNING set;
 * - capturedAt is the durable DB write time, not retrievedAt;
 * - a bounded history read includes all earlier modern AND legacy versions;
 * - concurrency did not obscure the write ordering.
 *
 * This function performs NO network access and writes NO canonical records.
 */
export type FredRevisionProofStatus =
  | "PROVEN_FACTUAL_REVISION"
  | "IDENTITY_ONLY_OR_EQUIVALENT"
  | "PROVEN_NEW_MEASUREMENT"
  | "NOT_EVALUATED";

export type FredRevisionEvidenceRow = {
  observation: Observation;
  /** Trusted persisted write timestamp, not the provider's retrievedAt. */
  capturedAt: string;
};

export type FredRevisionProofInput = {
  candidate: FredRevisionEvidenceRow;
  /** Rows returned by an independently bounded, read-only history query. */
  history: readonly FredRevisionEvidenceRow[];
  /** Must derive from exact keys returned by a database INSERT. */
  physicallyInserted: boolean;
  /** Modern + legacy history scanned exhaustively within a qualified bound. */
  historyComplete: boolean;
  /** Same-write tie/race and preceding write chronology independently resolved. */
  orderingProven: boolean;
};

export type FredRevisionProof = {
  status: FredRevisionProofStatus;
  /** No claim of "revised" can be made from a NOT_EVALUATED classification. */
  revised: boolean | null;
  priorObservationId: string | null;
  reason:
    | "VALUE_CHANGED"
    | "VALUE_EQUIVALENT"
    | "NO_EARLIER_VERSION"
    | "INSUFFICIENT_INSERT_OR_HISTORY_PROOF"
    | "AMBIGUOUS_IDENTITY_OR_SEMANTICS"
    | "AMBIGUOUS_WRITE_ORDER";
};

const MAX_BOUNDED_HISTORY = 64;

/** Explicitly unqualified until the wrong persisted unit-base is remediated. */
const UNQUALIFIED_BASE_SERIES = new Set(["DTWEXBGS"]);

function validTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validValue(value: string): string | null {
  const numeric = canonicalObservationValue(value);
  return numeric && Number.isFinite(Number(numeric)) ? numeric : null;
}

function seriesKey(observation: Observation): string | null {
  const modern = observation.identity?.seriesKey;
  const legacy = observation.metadata?.seriesId;
  if (modern !== undefined && (typeof modern !== "string" || modern.length === 0)) return null;
  if (legacy !== undefined && (typeof legacy !== "string" || legacy.length === 0)) return null;
  if (modern && legacy && modern !== legacy) return null;
  return modern ?? (typeof legacy === "string" ? legacy : null);
}

function semanticUnits(observation: Observation): { unit: string; frequency: string } | null {
  const unit = observation.metadata?.unit;
  const frequency = observation.metadata?.frequency;
  if (typeof unit !== "string" || !unit || typeof frequency !== "string" || !frequency) return null;
  return { unit, frequency };
}

function unknown(reason: FredRevisionProof["reason"]): FredRevisionProof {
  return { status: "NOT_EVALUATED", revised: null, priorObservationId: null, reason };
}

/**
 * Conservative revision proof based on the immediately preceding durable
 * version. Never count an ID migration, formatting change, or unqualified unit
 * as a factual value revision.
 */
export function proveFredRevision(input: FredRevisionProofInput): FredRevisionProof {
  if (!input.physicallyInserted || !input.historyComplete || !input.orderingProven
      || input.history.length > MAX_BOUNDED_HISTORY) {
    return unknown("INSUFFICIENT_INSERT_OR_HISTORY_PROOF");
  }

  const candidate = input.candidate.observation;
  const currentTime = validTimestamp(input.candidate.capturedAt);
  const currentObservationTime = validTimestamp(candidate.observedAt);
  const currentSeries = seriesKey(candidate);
  const currentUnits = semanticUnits(candidate);
  const currentValue = validValue(candidate.value);

  if (candidate.sourceId !== "fred" || candidate.domain !== "MACRO"
      || !candidate.id || !candidate.identity?.measurementId
      || candidate.identity.version !== "v1"
      || !currentSeries || UNQUALIFIED_BASE_SERIES.has(currentSeries)
      || currentTime === null || currentObservationTime === null
      || !currentUnits || currentValue === null) {
    return unknown("AMBIGUOUS_IDENTITY_OR_SEMANTICS");
  }

  const preceding: FredRevisionEvidenceRow[] = [];
  for (const entry of input.history) {
    const old = entry.observation;
    const oldCapturedTime = validTimestamp(entry.capturedAt);
    if (old.id === candidate.id && entry.capturedAt === input.candidate.capturedAt) {
      // The candidate itself is included in a normal post-write history read.
      continue;
    }
    if (oldCapturedTime === null || oldCapturedTime >= currentTime
        || old.id === candidate.id) return unknown("AMBIGUOUS_WRITE_ORDER");

    if (old.sourceId !== candidate.sourceId || old.domain !== candidate.domain
        || seriesKey(old) !== currentSeries
        || validTimestamp(old.observedAt) !== currentObservationTime) {
      return unknown("AMBIGUOUS_IDENTITY_OR_SEMANTICS");
    }
    const oldUnits = semanticUnits(old);
    if (!oldUnits || oldUnits.unit !== currentUnits.unit
        || oldUnits.frequency !== currentUnits.frequency
        || validValue(old.value) === null) {
      return unknown("AMBIGUOUS_IDENTITY_OR_SEMANTICS");
    }
    // A current/legacy comparison is legal only when machine identity and
    // semantic measurement period are proven compatible.
    if (old.identity && (old.identity.version !== "v1"
        || old.identity.measurementId !== candidate.identity.measurementId)) {
      return unknown("AMBIGUOUS_IDENTITY_OR_SEMANTICS");
    }
    preceding.push(entry);
  }

  if (preceding.length === 0) {
    return {
      status: "PROVEN_NEW_MEASUREMENT", revised: false,
      priorObservationId: null, reason: "NO_EARLIER_VERSION",
    };
  }

  preceding.sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));
  if (preceding.length > 1
      && Date.parse(preceding[0].capturedAt) === Date.parse(preceding[1].capturedAt)) {
    return unknown("AMBIGUOUS_WRITE_ORDER");
  }

  const latest = preceding[0].observation;
  const factualChange = validValue(latest.value) !== currentValue;
  return {
    status: factualChange ? "PROVEN_FACTUAL_REVISION" : "IDENTITY_ONLY_OR_EQUIVALENT",
    revised: factualChange,
    priorObservationId: latest.id,
    reason: factualChange ? "VALUE_CHANGED" : "VALUE_EQUIVALENT",
  };
}

export type FredBatchRevisionProof = {
  revised: number | null;
  evaluated: number;
  notEvaluated: number;
  /** Does not become COMPLETE merely because all submitted rows were seen. */
  coverage: "COMPLETE" | "NOT_EVALUATED";
};

export function summarizeFredRevisionProofs(
  proofs: readonly FredRevisionProof[],
): FredBatchRevisionProof {
  const notEvaluated = proofs.filter((p) => p.status === "NOT_EVALUATED").length;
  return {
    revised: notEvaluated === 0 ? proofs.filter((p) => p.revised).length : null,
    evaluated: proofs.length - notEvaluated,
    notEvaluated,
    coverage: notEvaluated === 0 ? "COMPLETE" : "NOT_EVALUATED",
  };
}
