import { resolveIntradayResultEvidence } from "./intraday-result-evidence";
export { resolveIntradayResultEvidence } from "./intraday-result-evidence";
import "server-only";
import {
  EVENT_WINDOW_POLICY_V1,
  matchSnapshotToEventWindow,
  qualifyEventWindow,
  type EventWindowRole,
  type QualifiedEventWindow,
} from "../domain/event-window";
import type { MarketSnapshot } from "../domain/market-snapshot";
import {
  compareMarketSnapshots,
  type SnapshotComparison,
} from "../domain/snapshot-comparison";
import type { EconomicEventResult } from "../domain/event-result";
import type { Event, Observation } from "../domain/types";
import type {
  EventRepository,
  HistoricalEconomicEventResultRepository,
  ObservationRepository,
} from "../repositories/types";
import { selectActiveMarketSnapshot } from "../domain/snapshot-supersession";
import { assessEventSurprise, type EventSurpriseAssessment } from "../domain/event-surprise";
import { selectExpectationBaseline } from "../domain/expectation-baseline";
import type { RatesReconstructionPoint } from "./rates-historical-reconstruction";
import {
  canonicalRepositories,
  historicalEconomicEventResultRepository,
  historicalEvidenceRepository,
  historicalMarketSnapshotRepository,
} from "../repositories/dashboard-repository";

const ROLES: EventWindowRole[] = ["PRE", "T_PLUS_5", "T_PLUS_15", "T_PLUS_30", "T_PLUS_60"];
const SERIES = ["btc.spot.usd", "eth.spot.usd", "dxy.index.usd", "gold.futures.usd"] as const;
const MONITOR_TIMEOUT_MS = 4_000;
export type IntradaySeriesKey = typeof SERIES[number];

export type IntradayEventMove = {
  role: EventWindowRole;
  capturedAt: string;
  quality: MarketSnapshot["quality"];
  values: Partial<Record<IntradaySeriesKey, number>>;
  changePct: Partial<Record<IntradaySeriesKey, number>>;
};

export type IntradayWindowStatus =
  | { status: "COMPLETE" }
  | { status: "RUNNING"; nextRole: EventWindowRole }
  | { status: "INCOMPLETE"; missingRole: EventWindowRole | null };

export type IntradayRatesReconstruction = {
  instrument: "2-Year Treasury Note futures";
  productCode: "ZT";
  ticker: string;
  points: RatesReconstructionPoint[];
};

export type IntradayExpectationBaselineEvidence = {
  status: string;
  policy: string;
  eventResultId: string | null;
  sourceId: string | null;
  expected: number | null;
  expectedType: EconomicEventResult["expectedType"] | null;
  unit: string | null;
  period: string | null;
  retrievedAt: string | null;
  evidenceId: string | null;
};

export type IntradayPricingBaselineEvidence = {
  status: string;
  policy: string;
  observationId: string | null;
  seriesKey: string | null;
  sourceId: string | null;
  value: number | null;
  unit: string | null;
  observedAt: string | null;
  retrievedAt: string | null;
  evidenceId: string | null;
  quality: Observation["quality"] | null;
};

export type IntradayBaselineEvidence = {
  snapshotId: string;
  capturedAt: string;
  expectation: IntradayExpectationBaselineEvidence | null;
  pricing: IntradayPricingBaselineEvidence[];
};

export type IntradayRepricingComparisonSource = {
  role: Exclude<EventWindowRole, "PRE">;
  comparison: SnapshotComparison;
};

export type IntradayRepricingSource = {
  window: QualifiedEventWindow;
  comparisons: IntradayRepricingComparisonSource[];
};

export type IntradayEventMonitor = {
  eventIdentityKey: string;
  eventId: string;
  subject: string;
  jurisdiction: string;
  t0: string;
  actual?: number;
  expected?: number;
  previous?: number;
  unit?: string;
  unitMultiplier?: string;
  resultSource?: string;
  surprise?: EventSurpriseAssessment;
  baselineEvidence?: IntradayBaselineEvidence;
  repricingSource?: IntradayRepricingSource;
  ratesReconstruction?: IntradayRatesReconstruction;
  moves: IntradayEventMove[];
  missingRequirements: number;
  windowStatus: IntradayWindowStatus;
};

export type IntradayEventMonitorResult =
  | { status: "OK"; data: IntradayEventMonitor[] }
  | { status: "EMPTY" }
  | { status: "ERROR" };

function roleOf(snapshot: MarketSnapshot): EventWindowRole | null {
  const role = snapshot.metadata?.eventWindowRole;
  return typeof role === "string" && ROLES.includes(role as EventWindowRole)
    ? role as EventWindowRole : null;
}

function identityOf(snapshot: MarketSnapshot): string | null {
  const value = snapshot.metadata?.eventIdentityKey;
  return typeof value === "string" && value.trim() ? value : null;
}

function selectActiveSnapshotsByRole(
  snapshots: MarketSnapshot[],
): Map<EventWindowRole, MarketSnapshot> {
  const historyByRole = new Map<EventWindowRole, MarketSnapshot[]>();
  for (const snapshot of snapshots) {
    const role = roleOf(snapshot);
    if (!role) continue;
    const history = historyByRole.get(role) ?? [];
    history.push(snapshot);
    historyByRole.set(role, history);
  }

  const byRole = new Map<EventWindowRole, MarketSnapshot>();
  for (const [role, history] of historyByRole) {
    const capturedAtSlots = new Map<number, MarketSnapshot[]>();
    for (const snapshot of history) {
      const capturedAt = Date.parse(snapshot.capturedAt);
      if (!Number.isFinite(capturedAt)) {
        throw new Error("Intraday event snapshot has an invalid capturedAt.");
      }
      const slot = capturedAtSlots.get(capturedAt) ?? [];
      slot.push(snapshot);
      capturedAtSlots.set(capturedAt, slot);
    }

    if (capturedAtSlots.size !== 1) {
      throw new Error("Intraday event role contains multiple logical capture slots.");
    }

    const active = selectActiveMarketSnapshot([...capturedAtSlots.values()][0]);
    if (!active) {
      throw new Error("Intraday event role has no active canonical snapshot.");
    }
    byRole.set(role, active);
  }
  return byRole;
}

export function buildIntradayRepricingSource(input: {
  event: Event;
  byRole: Map<EventWindowRole, MarketSnapshot>;
  observations: Map<string, Observation>;
}): IntradayRepricingSource | undefined {
  const qualification = qualifyEventWindow(input.event);
  if (!qualification.eligible) return undefined;

  const pre = input.byRole.get("PRE");
  if (!pre) return undefined;

  const beforeMatch = matchSnapshotToEventWindow(
    qualification.window,
    pre,
  );
  if (beforeMatch.status !== "QUALIFIED" && beforeMatch.status !== "DEGRADED") {
    return undefined;
  }

  const canonical = [...input.observations.values()];
  const comparisons: IntradayRepricingComparisonSource[] = [];

  for (const role of ROLES) {
    if (role === "PRE") continue;
    const after = input.byRole.get(role);
    if (!after) continue;

    const afterMatch = matchSnapshotToEventWindow(
      qualification.window,
      after,
    );
    if (afterMatch.status !== "QUALIFIED" && afterMatch.status !== "DEGRADED") {
      continue;
    }

    comparisons.push({
      role,
      comparison: compareMarketSnapshots({
        before: pre,
        after,
        observations: canonical,
      }),
    });
  }

  return {
    window: qualification.window,
    comparisons,
  };
}

function windowStatus(input: {
  t0: string;
  byRole: Map<EventWindowRole, MarketSnapshot>;
  missingRequirements: number;
  now: Date;
}): IntradayWindowStatus {
  const missingRole = ROLES.find((role) => !input.byRole.has(role)) ?? null;
  if (missingRole === null && input.missingRequirements === 0) return { status: "COMPLETE" };

  const finalSlot = EVENT_WINDOW_POLICY_V1.slots.find((slot) => slot.role === "T_PLUS_60");
  const t0Ms = Date.parse(input.t0);
  const closesAt = Number.isFinite(t0Ms) && finalSlot
    ? t0Ms + finalSlot.offsetMs + EVENT_WINDOW_POLICY_V1.toleranceMs
    : Number.NEGATIVE_INFINITY;

  if (missingRole !== null && input.now.getTime() <= closesAt) {
    return { status: "RUNNING", nextRole: missingRole };
  }
  return { status: "INCOMPLETE", missingRole };
}

export async function resolveIntradayObservations(
  repository: ObservationRepository,
  observationIds: string[],
): Promise<Map<string, Observation>> {
  const uniqueIds = [...new Set(observationIds)];
  const resolved = repository.findManyByIds
    ? await repository.findManyByIds(uniqueIds)
    : (await Promise.all(
        uniqueIds.map((id) => repository.findById(id)),
      )).filter((item): item is Observation => item !== null);
  return new Map(resolved.map((item) => [item.id, item]));
}

function seriesKeyOf(observation: Observation | undefined): string | null {
  const key = observation?.identity?.seriesKey
    ?? observation?.metadata?.seriesId
    ?? observation?.metadata?.metricId;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function numericObservationValue(observation: Observation | undefined): number | null {
  if (!observation) return null;
  const value = Number(observation.value);
  return Number.isFinite(value) ? value : null;
}

/**
 * Resolves only the baseline lineage already frozen into the PRE Snapshot.
 * No new baseline selection, repricing threshold, or interpretation is added.
 */
export function resolveIntradayBaselineEvidence(
  pre: MarketSnapshot,
  observations: Map<string, Observation>,
  results: EconomicEventResult[],
): IntradayBaselineEvidence {
  const expectationRef = pre.baselineRefs.find((ref) => ref.kind === "EXPECTATION") ?? null;
  const expectationResultId = expectationRef?.eventResultIds[0] ?? null;
  const expectationResult = expectationResultId
    ? results.find((item) => item.id === expectationResultId) ?? null
    : null;

  const expectation = expectationRef
    ? {
        status: expectationRef.status,
        policy: expectationRef.policy,
        eventResultId: expectationResultId,
        sourceId: expectationResult?.sourceId ?? null,
        expected: expectationResult?.expected ?? null,
        expectedType: expectationResult?.expectedType ?? null,
        unit: expectationResult?.unit ?? null,
        period: expectationResult?.period ?? null,
        retrievedAt: expectationResult?.retrievedAt ?? null,
        evidenceId: expectationResult?.evidenceId ?? expectationRef.evidenceIds[0] ?? null,
      }
    : null;

  const pricing = pre.baselineRefs
    .filter((ref) => ref.kind === "PRICING")
    .map((ref): IntradayPricingBaselineEvidence => {
      const observationId = ref.observationIds[0] ?? null;
      const observation = observationId ? observations.get(observationId) : undefined;
      const unit = observation?.metadata?.unit;
      return {
        status: ref.status,
        policy: ref.policy,
        observationId,
        seriesKey: seriesKeyOf(observation),
        sourceId: observation?.sourceId ?? null,
        value: numericObservationValue(observation),
        unit: typeof unit === "string" && unit.trim() ? unit.trim() : null,
        observedAt: observation?.observedAt ?? null,
        retrievedAt: observation?.retrievedAt ?? null,
        evidenceId: observation?.evidenceId ?? ref.evidenceIds[0] ?? null,
        quality: observation?.quality ?? null,
      };
    })
    .sort((a, b) => (a.seriesKey ?? "").localeCompare(b.seriesKey ?? ""));

  return {
    snapshotId: pre.id,
    capturedAt: pre.capturedAt,
    expectation,
    pricing,
  };
}

export async function resolveIntradayMonitorDependencies(input: {
  eventRepository: EventRepository;
  observationRepository: ObservationRepository;
  eventResultRepository: HistoricalEconomicEventResultRepository;
  eventId: string;
  observationIds: string[];
  eventIdentityKey: string;
  latestCapturedAt: string;
}): Promise<{
  event: Event | null;
  observations: Map<string, Observation>;
  results: EconomicEventResult[];
}> {
  const [event, observations, results] = await Promise.all([
    input.eventRepository.findById(input.eventId),
    resolveIntradayObservations(input.observationRepository, input.observationIds),
    input.eventResultRepository.findHistory({
      eventIdentityKey: input.eventIdentityKey,
      retrievedAtOnOrBefore: input.latestCapturedAt,
      order: "DESC",
      // One bounded superset serves result display plus canonical EXP/SUR selection.
      // Keep the existing SUR/EXP history bound so pre-release expectations cannot
      // be hidden by a dense post-release revision history.
      limit: 500,
    }),
  ]);
  return { event, observations, results };
}

async function buildMonitorForIdentity(
  latestIdentity: string,
  snapshots: MarketSnapshot[],
  now: Date,
  deadline: number,
): Promise<IntradayEventMonitor> {
  const sameEvent = snapshots.filter((snapshot) => identityOf(snapshot) === latestIdentity);
  const byRole = selectActiveSnapshotsByRole(sameEvent);
  const ordered = ROLES.flatMap((role) => {
    const snapshot = byRole.get(role);
    return snapshot ? [{ role, snapshot }] : [];
  });
  if (!ordered.length) throw new Error("Intraday event has no recognized capture roles.");

  const eventRef = ordered[0].snapshot.eventRefs.find((ref) => ref.key === latestIdentity);
  if (!eventRef) throw new Error("Intraday event snapshot is missing its primary event reference.");

  const observationIds = [...new Set(ordered.flatMap(({ snapshot }) =>
    snapshot.observationRefs.map((ref) => ref.observationId)))];
  const latestCapturedAt = ordered[ordered.length - 1].snapshot.capturedAt;
  const { event, observations, results } = await resolveIntradayMonitorDependencies({
    eventRepository: canonicalRepositories.events,
    observationRepository: canonicalRepositories.observations,
    eventResultRepository: historicalEconomicEventResultRepository,
    eventId: eventRef.eventId,
    observationIds,
    eventIdentityKey: latestIdentity,
    latestCapturedAt,
  });
  if (!event) throw new Error("Intraday event snapshot references an unavailable canonical event.");

  const valuesFor = (snapshot: MarketSnapshot): Partial<Record<IntradaySeriesKey, number>> => {
    const values: Partial<Record<IntradaySeriesKey, number>> = {};
    for (const ref of snapshot.observationRefs) {
      const observation = observations.get(ref.observationId);
      const key = observation?.identity?.seriesKey ?? String(observation?.metadata?.metricId ?? "");
      if (!SERIES.includes(key as IntradaySeriesKey)) continue;
      const numeric = Number(observation?.value);
      if (Number.isFinite(numeric)) values[key as IntradaySeriesKey] = numeric;
    }
    return values;
  };

  const pre = byRole.get("PRE");
  const preValues = pre ? valuesFor(pre) : {};
  const moves = ordered.map(({ role, snapshot }) => {
    const values = valuesFor(snapshot);
    const changePct: Partial<Record<IntradaySeriesKey, number>> = {};
    if (role !== "PRE") {
      for (const key of SERIES) {
        const before = preValues[key], after = values[key];
        if (before !== undefined && after !== undefined && before !== 0) {
          changePct[key] = ((after - before) / before) * 100;
        }
      }
    }
    return { role, capturedAt: snapshot.capturedAt, quality: snapshot.quality, values, changePct };
  });

  const result = results.find((item) =>
    item.actual !== undefined || item.expected !== undefined || item.previous !== undefined);
  const resultEvidence = await resolveIntradayResultEvidence(
    historicalEvidenceRepository,
    result,
    latestIdentity,
    latestCapturedAt,
    deadline,
  );
  const rawUnitMultiplier = resultEvidence?.metadata?.multiplier;
  const unitMultiplier = typeof rawUnitMultiplier === "string" && rawUnitMultiplier.trim()
    ? rawUnitMultiplier.trim()
    : undefined;
  const t0 = String(ordered[0].snapshot.metadata?.t0 ?? event.releasedAt ?? event.scheduledAt ?? "");
  const surprise = result?.sourceId && t0
    ? (() => {
        const request = {
          eventIdentityKey: latestIdentity,
          sourceId: result.sourceId,
          releaseAt: t0,
          asOf: latestCapturedAt,
          ...(result.expectedType ? { expectedType: result.expectedType } : {}),
        };
        const sourceHistory = results.filter((item) => item.sourceId === result.sourceId);
        return assessEventSurprise({
          request,
          expectation: selectExpectationBaseline(request, sourceHistory),
          candidates: sourceHistory,
        });
      })()
    : undefined;
  const missingRequirements = ordered.reduce(
    (sum, item) => sum + item.snapshot.missingRequirements.length, 0);

  const repricingSource = buildIntradayRepricingSource({
    event,
    byRole,
    observations,
  });

  return {
    eventIdentityKey: latestIdentity,
    eventId: event.id,
    subject: event.subject,
    jurisdiction: event.identity?.jurisdiction ?? event.jurisdiction ?? "UNKNOWN",
    t0,
    ...(result?.actual !== undefined ? { actual: result.actual } : {}),
    ...(result?.expected !== undefined ? { expected: result.expected } : {}),
    ...(result?.previous !== undefined ? { previous: result.previous } : {}),
    ...(result?.unit ? { unit: result.unit } : {}),
    ...(unitMultiplier ? { unitMultiplier } : {}),
    ...(result?.sourceId ? { resultSource: result.sourceId } : {}),
    ...(surprise ? { surprise } : {}),
    ...(pre ? { baselineEvidence: resolveIntradayBaselineEvidence(pre, observations, results) } : {}),
    ...(repricingSource ? { repricingSource } : {}),
    moves,
    missingRequirements,
    windowStatus: windowStatus({ t0, byRole, missingRequirements, now }),
  };
}

async function loadIntradayEventMonitor(now: Date, deadline: number): Promise<IntradayEventMonitorResult> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const snapshots = await historicalMarketSnapshotRepository.findHistory({
    scope: EVENT_WINDOW_POLICY_V1.snapshotScope,
    capturedAtOnOrAfter: since,
    capturedAtOnOrBefore: now.toISOString(),
    order: "DESC",
    limit: 100,
  });

  const identities = [...new Set(snapshots.map(identityOf).filter((value): value is string => Boolean(value)))];
  if (!identities.length) return { status: "EMPTY" };

  // The panel represents the latest release cohort, not one arbitrary latest snapshot.
  // Events sharing the same t0 remain independent monitor cards with independent evidence.
  const t0ByIdentity = new Map<string, number>();
  for (const snapshot of snapshots) {
    const identity = identityOf(snapshot);
    if (!identity || t0ByIdentity.has(identity)) continue;
    const rawT0 = snapshot.metadata?.t0;
    const parsed = typeof rawT0 === "string" ? Date.parse(rawT0) : Number.NaN;
    if (Number.isFinite(parsed)) t0ByIdentity.set(identity, parsed);
  }
  const latestT0 = Math.max(...t0ByIdentity.values());
  const selectedIdentities = Number.isFinite(latestT0)
    ? identities.filter((identity) => t0ByIdentity.get(identity) === latestT0)
    : identities.slice(0, 1);

  const data = await Promise.all(
    selectedIdentities.map((identity) => buildMonitorForIdentity(identity, snapshots, now, deadline)),
  );

  // Optional historical ZT reconstruction is intentionally excluded from the
  // critical dashboard path. Canonical event-response evidence must remain
  // available even when the external research-only futures source is slow or
  // unavailable. A separate enrichment surface may reintroduce this context.
  data.sort((a, b) => a.subject.localeCompare(b.subject));
  return data.length ? { status: "OK", data } : { status: "EMPTY" };
}

export async function getIntradayEventMonitor(
  now = new Date(),
): Promise<IntradayEventMonitorResult> {
  const deadline = Date.now() + MONITOR_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutResult = new Promise<IntradayEventMonitorResult>((resolve) => {
      timeout = setTimeout(() => resolve({ status: "ERROR" }), MONITOR_TIMEOUT_MS);
    });
    const result = await Promise.race([loadIntradayEventMonitor(now, deadline), timeoutResult]);
    if (result.status === "ERROR") {
      console.error("Intraday event response read timed out after 4000ms.");
    }
    return result;
  } catch (error) {
    console.error(
      "Failed to load intraday event response:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return { status: "ERROR" };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
