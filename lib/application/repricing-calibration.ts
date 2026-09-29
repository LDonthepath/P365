import type { EventWindowRole } from "../domain/event-window";
import type { MarketSnapshot } from "../domain/market-snapshot";
import type { ObservationRepository } from "../repositories/types";

const ROLES: EventWindowRole[] = ["PRE", "T_PLUS_5", "T_PLUS_15", "T_PLUS_30", "T_PLUS_60"];

export type RepricingCalibrationPoint = {
  eventIdentityKey: string;
  afterRole: Exclude<EventWindowRole, "PRE">;
  observationKey: string;
  beforeCapturedAt: string;
  afterCapturedAt: string;
  beforeValue: number;
  afterValue: number;
  absoluteDelta: number;
  percentDelta: number | null;
  beforeQuality: MarketSnapshot["quality"];
  afterQuality: MarketSnapshot["quality"];
};

function roleOf(snapshot: MarketSnapshot): EventWindowRole | null {
  const role = snapshot.metadata?.eventWindowRole;
  return typeof role === "string" && ROLES.includes(role as EventWindowRole)
    ? role as EventWindowRole
    : null;
}

function identityOf(snapshot: MarketSnapshot): string | null {
  const identity = snapshot.metadata?.eventIdentityKey;
  return typeof identity === "string" && identity.trim() ? identity : null;
}

function preferSnapshot(a: MarketSnapshot, b: MarketSnapshot): MarketSnapshot {
  const score = (snapshot: MarketSnapshot) =>
    snapshot.quality === "COMPLETE" ? 4
      : snapshot.quality === "STALE" ? 3
      : snapshot.quality === "PARTIAL" ? 2
      : 1;
  const aScore = score(a);
  const bScore = score(b);
  return bScore > aScore || (bScore === aScore && b.id > a.id) ? b : a;
}

/**
 * Produces factual PRE -> post-event move samples for later RPR threshold research.
 *
 * This is deliberately not a threshold selector. It does not classify a move as
 * repricing, infer causality, or persist a methodology. Snapshot quality remains
 * attached to every point so calibration research can explicitly choose its
 * admissibility policy instead of silently discarding degraded evidence.
 */
export async function buildRepricingCalibrationDataset(input: {
  snapshots: MarketSnapshot[];
  observationRepository: ObservationRepository;
}): Promise<RepricingCalibrationPoint[]> {
  const byEvent = new Map<string, Map<EventWindowRole, MarketSnapshot>>();

  for (const snapshot of input.snapshots) {
    const identity = identityOf(snapshot);
    const role = roleOf(snapshot);
    if (!identity || !role) continue;
    const byRole = byEvent.get(identity) ?? new Map<EventWindowRole, MarketSnapshot>();
    const current = byRole.get(role);
    byRole.set(role, current ? preferSnapshot(current, snapshot) : snapshot);
    byEvent.set(identity, byRole);
  }

  const selected = [...byEvent.values()].flatMap((byRole) => [...byRole.values()]);
  const ids = [...new Set(selected.flatMap((snapshot) =>
    snapshot.observationRefs.map((ref) => ref.observationId)
  ))].sort();
  const resolved = await Promise.all(ids.map((id) => input.observationRepository.findById(id)));
  const observations = new Map(
    resolved.filter((item) => item !== null).map((item) => [item!.id, item!]),
  );

  function values(snapshot: MarketSnapshot): Map<string, number> {
    const result = new Map<string, number>();
    for (const ref of snapshot.observationRefs) {
      const observation = observations.get(ref.observationId);
      const key = observation?.identity?.seriesKey
        ?? String(observation?.metadata?.metricId ?? "");
      const value = Number(observation?.value);
      if (key && Number.isFinite(value)) result.set(key, value);
    }
    return result;
  }

  const points: RepricingCalibrationPoint[] = [];
  for (const [eventIdentityKey, byRole] of byEvent) {
    const before = byRole.get("PRE");
    if (!before) continue;
    const beforeValues = values(before);

    for (const role of ROLES) {
      if (role === "PRE") continue;
      const after = byRole.get(role);
      if (!after) continue;
      const afterValues = values(after);

      for (const [observationKey, beforeValue] of beforeValues) {
        const afterValue = afterValues.get(observationKey);
        if (afterValue === undefined) continue;
        const absoluteDelta = afterValue - beforeValue;
        points.push({
          eventIdentityKey,
          afterRole: role,
          observationKey,
          beforeCapturedAt: before.capturedAt,
          afterCapturedAt: after.capturedAt,
          beforeValue,
          afterValue,
          absoluteDelta,
          percentDelta: beforeValue === 0 ? null : (absoluteDelta / Math.abs(beforeValue)) * 100,
          beforeQuality: before.quality,
          afterQuality: after.quality,
        });
      }
    }
  }

  return points.sort((a, b) =>
    a.eventIdentityKey.localeCompare(b.eventIdentityKey)
    || ROLES.indexOf(a.afterRole) - ROLES.indexOf(b.afterRole)
    || a.observationKey.localeCompare(b.observationKey)
  );
}
