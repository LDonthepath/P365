import "server-only";
import { unstable_cache } from "next/cache";
import { EVENT_WINDOW_POLICY_V1, type EventWindowRole } from "../domain/event-window";
import type { MarketSnapshot } from "../domain/market-snapshot";
import { selectActiveMarketSnapshot } from "../domain/snapshot-supersession";
import type { EventSurpriseAssessment } from "../domain/event-surprise";
import { assessRepositoryBackedEventSurprise } from "./event-surprise";
import {
  reconstructHistoricalZtEvent,
  type RatesReconstructionPoint,
} from "./rates-historical-reconstruction";
import {
  canonicalRepositories,
  historicalEconomicEventResultRepository,
  historicalMarketSnapshotRepository,
} from "../repositories/dashboard-repository";

const ROLES: EventWindowRole[] = ["PRE", "T_PLUS_5", "T_PLUS_15", "T_PLUS_30", "T_PLUS_60"];
const SERIES = ["btc.spot.usd", "eth.spot.usd", "dxy.index.usd", "gold.futures.usd"] as const;
const MONITOR_TIMEOUT_MS = 4_000;
const MASSIVE_HISTORICAL_DELAY_MS = 8 * 60 * 60 * 1000;
const RATES_CONTEXT_TIMEOUT_MS = 1_500;
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
  resultSource?: string;
  surprise?: EventSurpriseAssessment;
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

async function buildMonitorForIdentity(
  latestIdentity: string,
  snapshots: MarketSnapshot[],
  now: Date,
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
  const event = await canonicalRepositories.events.findById(eventRef.eventId);
  if (!event) throw new Error("Intraday event snapshot references an unavailable canonical event.");

  const observationIds = [...new Set(ordered.flatMap(({ snapshot }) =>
    snapshot.observationRefs.map((ref) => ref.observationId)))];
  const resolved = await Promise.all(
    observationIds.map((id) => canonicalRepositories.observations.findById(id)),
  );
  const observations = new Map(
    resolved.filter((item) => item !== null).map((item) => [item!.id, item!]),
  );

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

  const latestCapturedAt = ordered[ordered.length - 1].snapshot.capturedAt;
  const results = await historicalEconomicEventResultRepository.findHistory({
    eventIdentityKey: latestIdentity,
    retrievedAtOnOrBefore: latestCapturedAt,
    order: "DESC",
    limit: 20,
  });
  const result = results.find((item) =>
    item.actual !== undefined || item.expected !== undefined || item.previous !== undefined);
  const t0 = String(ordered[0].snapshot.metadata?.t0 ?? event.releasedAt ?? event.scheduledAt ?? "");
  const surprise = result?.sourceId && t0
    ? await assessRepositoryBackedEventSurprise({
        eventIdentityKey: latestIdentity,
        sourceId: result.sourceId,
        releaseAt: t0,
        asOf: latestCapturedAt,
        ...(result.expectedType ? { expectedType: result.expectedType } : {}),
      }, historicalEconomicEventResultRepository)
    : undefined;
  const missingRequirements = ordered.reduce(
    (sum, item) => sum + item.snapshot.missingRequirements.length, 0);

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
    ...(result?.sourceId ? { resultSource: result.sourceId } : {}),
    ...(surprise ? { surprise } : {}),
    moves,
    missingRequirements,
    windowStatus: windowStatus({ t0, byRole, missingRequirements, now }),
  };
}

const cachedHistoricalRatesReconstruction = unstable_cache(
  (t0: string) => reconstructHistoricalZtEvent(t0),
  ["cal-001-historical-zt-reconstruction"],
  { revalidate: 24 * 60 * 60 },
);

async function reconstructRatesContext(
  t0: string,
): Promise<IntradayRatesReconstruction | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutResult = new Promise<null>((resolve) => {
      timeout = setTimeout(() => resolve(null), RATES_CONTEXT_TIMEOUT_MS);
    });
    const reconstruction = cachedHistoricalRatesReconstruction(t0)
      .then((result): IntradayRatesReconstruction | null =>
        result.status === "OK"
          ? {
              instrument: result.instrument,
              productCode: result.productCode,
              ticker: result.ticker,
              points: result.points,
            }
          : null)
      .catch(() => null);
    return await Promise.race([reconstruction, timeoutResult]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function loadIntradayEventMonitor(now: Date): Promise<IntradayEventMonitorResult> {
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
    selectedIdentities.map((identity) => buildMonitorForIdentity(identity, snapshots, now)),
  );

  // Massive free-tier futures data is historical/delayed. Reconstruct once per
  // release cohort so simultaneous events do not duplicate provider requests.
  // Failure or unavailability is intentionally fail-soft: canonical event
  // response evidence remains usable without this research-only context.
  const historicalT0s = [...new Set(
    data
      .map((monitor) => monitor.t0)
      .filter((t0) => {
        const t0Ms = Date.parse(t0);
        return Number.isFinite(t0Ms) && now.getTime() - t0Ms >= MASSIVE_HISTORICAL_DELAY_MS;
      }),
  )];
  const ratesByT0 = new Map<string, IntradayRatesReconstruction>();
  for (const t0 of historicalT0s) {
    const rates = await reconstructRatesContext(t0);
    if (rates) ratesByT0.set(t0, rates);
  }
  for (const monitor of data) {
    const ratesReconstruction = ratesByT0.get(monitor.t0);
    if (ratesReconstruction) monitor.ratesReconstruction = ratesReconstruction;
  }

  data.sort((a, b) => a.subject.localeCompare(b.subject));
  return data.length ? { status: "OK", data } : { status: "EMPTY" };
}

export async function getIntradayEventMonitor(
  now = new Date(),
): Promise<IntradayEventMonitorResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutResult = new Promise<IntradayEventMonitorResult>((resolve) => {
      timeout = setTimeout(() => resolve({ status: "ERROR" }), MONITOR_TIMEOUT_MS);
    });
    const result = await Promise.race([loadIntradayEventMonitor(now), timeoutResult]);
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
