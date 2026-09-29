import type { Observation } from "../domain/types";
import {
  buildHistoricalRelationshipEvidence,
  type HistoricalRelationshipEvidence,
  type HistoricalRelationshipMethodology,
  type HistoricalRelationshipPoint,
} from "../domain/historical-relationship";
import type { HistoricalObservationRepository } from "../repositories/types";

function numeric(observation: Observation): number | undefined {
  const value = Number(observation.value);
  return Number.isFinite(value) ? value : undefined;
}

function latestByObservedAt(observations: Observation[]): Map<string, Observation> {
  const map = new Map<string, Observation>();
  for (const observation of observations) {
    const existing = map.get(observation.observedAt);
    if (!existing
      || observation.retrievedAt > existing.retrievedAt
      || (observation.retrievedAt === existing.retrievedAt && observation.id > existing.id)) {
      map.set(observation.observedAt, observation);
    }
  }
  return map;
}

function transformPairs(
  raw: HistoricalRelationshipPoint[],
  transformation: HistoricalRelationshipMethodology["transformation"],
): HistoricalRelationshipPoint[] {
  if (transformation === "LEVEL") return raw;
  const changed: HistoricalRelationshipPoint[] = [];
  for (let i = 1; i < raw.length; i += 1) {
    changed.push({
      observedAt: raw[i].observedAt,
      leftObservationId: raw[i].leftObservationId,
      rightObservationId: raw[i].rightObservationId,
      leftValue: raw[i].leftValue - raw[i - 1].leftValue,
      rightValue: raw[i].rightValue - raw[i - 1].rightValue,
    });
  }
  return changed;
}

/**
 * REL-001 read-only historical relationship measurement.
 * Pairing is deliberately strict: both series must have an Observation at the
 * exact same observedAt. The repository as-of cutoff prevents later-known
 * revisions from entering an earlier reconstruction.
 */
export async function measureRepositoryBackedHistoricalRelationship(input: {
  methodology: HistoricalRelationshipMethodology;
  repository: HistoricalObservationRepository;
}): Promise<HistoricalRelationshipEvidence> {
  const m = input.methodology;
  const query = (identity: HistoricalRelationshipMethodology["left"], sourceId?: string) => ({
    identity,
    ...(sourceId ? { sourceId } : {}),
    observedAtOnOrAfter: m.observedAtOnOrAfter,
    observedAtOnOrBefore: m.observedAtOnOrBefore,
    retrievedAtOnOrBefore: m.asOf,
    order: "ASC" as const,
    limit: 500,
  });
  const [left, right] = await Promise.all([
    input.repository.findHistory(query(m.left, m.leftSourceId)),
    input.repository.findHistory(query(m.right, m.rightSourceId)),
  ]);

  const leftMap = latestByObservedAt(left);
  const rightMap = latestByObservedAt(right);
  const raw: HistoricalRelationshipPoint[] = [];
  for (const [observedAt, l] of leftMap) {
    const r = rightMap.get(observedAt);
    if (!r) continue;
    const leftValue = numeric(l), rightValue = numeric(r);
    if (leftValue === undefined || rightValue === undefined) continue;
    raw.push({
      observedAt,
      leftObservationId: l.id,
      rightObservationId: r.id,
      leftValue,
      rightValue,
    });
  }
  raw.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  return buildHistoricalRelationshipEvidence({
    methodology: m,
    points: transformPairs(raw, m.transformation),
  });
}
