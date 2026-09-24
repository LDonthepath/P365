import {
  findEventWindowContaminants,
  matchSnapshotToEventWindow,
  type EventWindowContaminant,
  type EventWindowRole,
  type EventWindowSnapshotMatch,
  type QualifiedEventWindow,
} from "../domain/event-window";
import type { MarketSnapshot } from "../domain/market-snapshot";
import {
  compareMarketSnapshots,
  type SnapshotComparison,
} from "../domain/snapshot-comparison";
import type { Event, Observation } from "../domain/types";
import type { ObservationRepository } from "../repositories/types";

export type EventWindowSnapshotComparison = {
  windowId: string;
  eventIdentityKey: string;
  beforeRole: "PRE";
  afterRole: Exclude<EventWindowRole, "PRE">;
  beforeMatch: EventWindowSnapshotMatch;
  afterMatch: EventWindowSnapshotMatch;
  contaminationStatus: "CLEAN" | "CONTAMINATED";
  contaminants: EventWindowContaminant[];
  comparison: SnapshotComparison;
};

function assertWindowMatch(
  match: EventWindowSnapshotMatch,
  expectedRole: EventWindowRole | "POST",
  label: string,
): asserts match is EventWindowSnapshotMatch & {
  role: EventWindowRole;
} {
  if (match.status !== "QUALIFIED" && match.status !== "DEGRADED") {
    throw new Error(
      "Snapshot Comparison "
      + label
      + " Snapshot is not event-window eligible: "
      + match.status
      + ".",
    );
  }
  if (match.role === null) {
    throw new Error(
      "Snapshot Comparison "
      + label
      + " Snapshot has no event-window role.",
    );
  }
  if (expectedRole === "POST") {
    if (match.role === "PRE") {
      throw new Error(
        "Snapshot Comparison after Snapshot must use a post-event role.",
      );
    }
    return;
  }
  if (match.role !== expectedRole) {
    throw new Error(
      "Snapshot Comparison "
      + label
      + " Snapshot must match "
      + expectedRole
      + ".",
    );
  }
}

async function resolveSnapshotObservations(
  before: MarketSnapshot,
  after: MarketSnapshot,
  repository: ObservationRepository,
): Promise<Observation[]> {
  const ids = [
    ...new Set([
      ...before.observationRefs.map((ref) => ref.observationId),
      ...after.observationRefs.map((ref) => ref.observationId),
    ]),
  ].sort();

  const resolved = await Promise.all(
    ids.map((id) => repository.findById(id)),
  );

  return resolved.filter(
    (observation): observation is Observation => observation !== null,
  );
}

/**
 * Compares one PRE Snapshot with one qualified post-event Snapshot.
 *
 * Observation values are resolved through the canonical repository because
 * Snapshots intentionally store references only. Intervening HIGH point-events
 * are carried as contamination metadata; no causal or repricing conclusion is
 * produced here.
 */
export async function compareRepositoryBackedEventWindowSnapshots(input: {
  window: QualifiedEventWindow;
  before: MarketSnapshot;
  after: MarketSnapshot;
  events: Event[];
  observationRepository: ObservationRepository;
}): Promise<EventWindowSnapshotComparison> {
  const beforeMatch = matchSnapshotToEventWindow(
    input.window,
    input.before,
  );
  const afterMatch = matchSnapshotToEventWindow(
    input.window,
    input.after,
  );

  assertWindowMatch(beforeMatch, "PRE", "before");
  assertWindowMatch(afterMatch, "POST", "after");

  const observations = await resolveSnapshotObservations(
    input.before,
    input.after,
    input.observationRepository,
  );

  const comparison = compareMarketSnapshots({
    before: input.before,
    after: input.after,
    observations,
  });

  const contaminants = findEventWindowContaminants({
    primary: input.window,
    baselineCapturedAt: input.before.capturedAt,
    evaluatedCapturedAt: input.after.capturedAt,
    events: input.events,
  });

  return {
    windowId: input.window.id,
    eventIdentityKey: input.window.eventIdentityKey,
    beforeRole: "PRE",
    afterRole: afterMatch.role as Exclude<EventWindowRole, "PRE">,
    beforeMatch,
    afterMatch,
    contaminationStatus: contaminants.length > 0
      ? "CONTAMINATED"
      : "CLEAN",
    contaminants,
    comparison,
  };
}
