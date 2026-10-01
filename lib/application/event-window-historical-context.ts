import {
  buildEventWindowHistoricalContext,
  type EventWindowHistoricalContext,
  type EventWindowHistoricalSeriesContext,
} from "../domain/event-window-historical-context";
import type {
  HistoricalBaselineTransformation,
} from "../domain/historical-baseline";
import type { QualifiedEventWindow } from "../domain/event-window";
import type { MarketSnapshot } from "../domain/market-snapshot";
import type { Event, Observation } from "../domain/types";
import { observationSemanticSeriesKey } from "../repositories/observation-history";
import type {
  HistoricalObservationRepository,
  ObservationRepository,
} from "../repositories/types";
import { measureRepositoryBackedHistoricalBaseline } from "./historical-baseline";
import { compareRepositoryBackedEventWindowSnapshots } from "./snapshot-comparison";

export type EventWindowHistoricalSeriesRequest = {
  observationKey: string;
  transformation: Exclude<HistoricalBaselineTransformation, "LEVEL">;
  lookbackMs: number;
  minimumSampleSize: number;
  methodologyId: string;
  methodologyVersion: string;
};

function validateRequest(request: EventWindowHistoricalSeriesRequest): void {
  if (!request.observationKey.trim()) {
    throw new Error("HIST-001C requires a non-empty observationKey.");
  }
  if (!Number.isInteger(request.lookbackMs) || request.lookbackMs <= 0) {
    throw new Error("HIST-001C lookbackMs must be a positive integer.");
  }
  if (!Number.isInteger(request.minimumSampleSize) || request.minimumSampleSize < 1) {
    throw new Error("HIST-001C minimumSampleSize must be an integer >= 1.");
  }
  if (!request.methodologyId.trim() || !request.methodologyVersion.trim()) {
    throw new Error("HIST-001C requires explicit methodology identity and version.");
  }
}

function seriesKey(observation: Observation): string | undefined {
  return observation.identity?.seriesKey
    ?? observationSemanticSeriesKey(observation)
    ?? undefined;
}

async function resolveByIds(
  repository: ObservationRepository,
  ids: string[],
): Promise<Map<string, Observation>> {
  const unique = [...new Set(ids)];
  const observations = repository.findManyByIds
    ? await repository.findManyByIds(unique)
    : (await Promise.all(unique.map((id) => repository.findById(id))))
        .filter((item): item is Observation => item !== null);
  return new Map(observations.map((observation) => [observation.id, observation]));
}

/**
 * HIST-001C binds one qualified PRE -> post-event Snapshot comparison to
 * same-series historical distribution evidence.
 *
 * Historical comparison horizons are derived from the exact canonical
 * Observation timestamps used by the Snapshot comparison, never from the role
 * label itself. This preserves the real move interval when provider timestamps
 * differ slightly from nominal event-window targets.
 */
export async function buildRepositoryBackedEventWindowHistoricalContext(input: {
  window: QualifiedEventWindow;
  before: MarketSnapshot;
  after: MarketSnapshot;
  events: Event[];
  observationRepository: ObservationRepository;
  historicalObservationRepository: HistoricalObservationRepository;
  series: EventWindowHistoricalSeriesRequest[];
}): Promise<EventWindowHistoricalContext> {
  if (!input.series.length) {
    throw new Error("HIST-001C requires at least one requested series.");
  }

  const requests = [...input.series];
  const requestKeys = new Set<string>();
  for (const request of requests) {
    validateRequest(request);
    if (requestKeys.has(request.observationKey)) {
      throw new Error("HIST-001C observationKey requests must be unique.");
    }
    requestKeys.add(request.observationKey);
  }

  const comparison = await compareRepositoryBackedEventWindowSnapshots({
    window: input.window,
    before: input.before,
    after: input.after,
    events: input.events,
    observationRepository: input.observationRepository,
  });

  const changeByKey = new Map(
    comparison.comparison.observationChanges.map((change) => [change.key, change]),
  );

  const targetIds = requests.flatMap((request) => {
    const change = changeByKey.get(request.observationKey);
    return change
      ? [change.beforeObservationId, change.afterObservationId]
          .filter((id): id is string => Boolean(id))
      : [];
  });
  const resolved = await resolveByIds(input.observationRepository, targetIds);

  const contexts: EventWindowHistoricalSeriesContext[] = [];
  const missingObservationKeys: string[] = [];

  await Promise.all(requests.map(async (request) => {
    const change = changeByKey.get(request.observationKey);
    if (
      !change
      || !change.beforeObservationId
      || !change.afterObservationId
      || (change.status !== "CHANGED" && change.status !== "UNCHANGED")
    ) {
      missingObservationKeys.push(request.observationKey);
      return;
    }

    const beforeObservation = resolved.get(change.beforeObservationId);
    const afterObservation = resolved.get(change.afterObservationId);
    if (!beforeObservation || !afterObservation) {
      missingObservationKeys.push(request.observationKey);
      return;
    }

    const stableSeriesKey = seriesKey(beforeObservation);
    const afterSeriesKey = seriesKey(afterObservation);
    if (!stableSeriesKey || stableSeriesKey !== afterSeriesKey) {
      missingObservationKeys.push(request.observationKey);
      return;
    }

    const beforeObservedAt = Date.parse(beforeObservation.observedAt);
    const afterObservedAt = Date.parse(afterObservation.observedAt);
    if (
      !Number.isFinite(beforeObservedAt)
      || !Number.isFinite(afterObservedAt)
      || afterObservedAt <= beforeObservedAt
    ) {
      missingObservationKeys.push(request.observationKey);
      return;
    }

    const comparisonHorizonMs = afterObservedAt - beforeObservedAt;
    const historyStartMs = beforeObservedAt - request.lookbackMs;
    if (!Number.isFinite(historyStartMs)) {
      throw new Error("HIST-001C historical lookback produced an invalid timestamp.");
    }

    const historicalBaseline = await measureRepositoryBackedHistoricalBaseline({
      methodology: {
        methodologyId: request.methodologyId,
        methodologyVersion: request.methodologyVersion,
        identity: {
          domain: beforeObservation.domain,
          seriesKey: stableSeriesKey,
        },
        sourceId: beforeObservation.sourceId,
        transformation: request.transformation,
        observedAtOnOrAfter: new Date(historyStartMs).toISOString(),
        observedAtOnOrBefore: new Date(beforeObservedAt - 1).toISOString(),
        asOf: input.after.capturedAt,
        minimumSampleSize: request.minimumSampleSize,
        comparisonHorizonMs,
      },
      repository: input.historicalObservationRepository,
      targetStart: beforeObservation,
      targetEnd: afterObservation,
    });

    contexts.push({
      observationKey: request.observationKey,
      seriesKey: stableSeriesKey,
      sourceId: beforeObservation.sourceId,
      beforeObservationId: beforeObservation.id,
      afterObservationId: afterObservation.id,
      comparisonHorizonMs,
      historicalBaseline,
    });
  }));

  return buildEventWindowHistoricalContext({
    eventIdentityKey: comparison.eventIdentityKey,
    windowId: comparison.windowId,
    comparisonId: comparison.comparison.id,
    afterRole: comparison.afterRole,
    knowledgeAt: input.after.capturedAt,
    contaminationStatus: comparison.contaminationStatus,
    contaminantEventIdentityKeys: comparison.contaminants.map(
      (contaminant) => contaminant.eventIdentityKey,
    ),
    requestedObservationKeys: requests.map((request) => request.observationKey),
    missingObservationKeys,
    series: contexts,
  });
}
