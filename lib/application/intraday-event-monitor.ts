import "server-only";
import { EVENT_WINDOW_POLICY_V1, type EventWindowRole } from "../domain/event-window";
import type { MarketSnapshot } from "../domain/market-snapshot";
import {
  canonicalRepositories,
  historicalEconomicEventResultRepository,
  historicalMarketSnapshotRepository,
} from "../repositories/dashboard-repository";

const ROLES: EventWindowRole[] = ["PRE", "T_PLUS_5", "T_PLUS_15", "T_PLUS_30", "T_PLUS_60"];
const SERIES = ["btc.spot.usd", "eth.spot.usd", "dxy.index.usd", "gold.futures.usd"] as const;
export type IntradaySeriesKey = typeof SERIES[number];

export type IntradayEventMove = {
  role: EventWindowRole;
  capturedAt: string;
  quality: MarketSnapshot["quality"];
  values: Partial<Record<IntradaySeriesKey, number>>;
  changePct: Partial<Record<IntradaySeriesKey, number>>;
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
  moves: IntradayEventMove[];
  missingRequirements: number;
};

function roleOf(snapshot: MarketSnapshot): EventWindowRole | null {
  const role = snapshot.metadata?.eventWindowRole;
  return typeof role === "string" && ROLES.includes(role as EventWindowRole)
    ? role as EventWindowRole : null;
}

function identityOf(snapshot: MarketSnapshot): string | null {
  const value = snapshot.metadata?.eventIdentityKey;
  return typeof value === "string" && value.trim() ? value : null;
}

function preferSnapshot(a: MarketSnapshot, b: MarketSnapshot): MarketSnapshot {
  const score = (s: MarketSnapshot) =>
    (s.quality === "COMPLETE" ? 4 : s.quality === "STALE" ? 3 : s.quality === "PARTIAL" ? 2 : 1)
    + (s.metadata?.captureOwner === "CAP-001C" ? 0.5 : 0);
  return score(b) > score(a) || (score(b) === score(a) && b.id > a.id) ? b : a;
}

export async function getIntradayEventMonitor(now = new Date()): Promise<IntradayEventMonitor | null> {
  try {
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const snapshots = await historicalMarketSnapshotRepository.findHistory({
      scope: EVENT_WINDOW_POLICY_V1.snapshotScope,
      capturedAtOnOrAfter: since,
      capturedAtOnOrBefore: now.toISOString(),
      order: "DESC",
      limit: 100,
    });
    const latestIdentity = snapshots.map(identityOf).find((value): value is string => Boolean(value));
    if (!latestIdentity) return null;

    const sameEvent = snapshots.filter((snapshot) => identityOf(snapshot) === latestIdentity);
    const byRole = new Map<EventWindowRole, MarketSnapshot>();
    for (const snapshot of sameEvent) {
      const role = roleOf(snapshot);
      if (!role) continue;
      const current = byRole.get(role);
      byRole.set(role, current ? preferSnapshot(current, snapshot) : snapshot);
    }
    const ordered = ROLES.flatMap((role) => {
      const snapshot = byRole.get(role);
      return snapshot ? [{ role, snapshot }] : [];
    });
    if (!ordered.length) return null;

    const eventRef = ordered[0].snapshot.eventRefs.find((ref) => ref.key === latestIdentity);
    if (!eventRef) return null;
    const event = await canonicalRepositories.events.findById(eventRef.eventId);
    if (!event) return null;

    const observationIds = [...new Set(ordered.flatMap(({ snapshot }) =>
      snapshot.observationRefs.map((ref) => ref.observationId)))];
    const resolved = await Promise.all(observationIds.map((id) => canonicalRepositories.observations.findById(id)));
    const observations = new Map(resolved.filter((item) => item !== null).map((item) => [item!.id, item!]));

    const valuesFor = (snapshot: MarketSnapshot): Partial<Record<IntradaySeriesKey, number>> => {
      const values: Partial<Record<IntradaySeriesKey, number>> = {};
      for (const ref of snapshot.observationRefs) {
        const observation = observations.get(ref.observationId);
        const key = observation?.identity?.seriesKey ?? String(observation?.metadata?.metricId ?? "");
        if (!SERIES.includes(key as IntradaySeriesKey)) continue;
        const value = Number(observation?.value);
        if (Number.isFinite(value)) values[key as IntradaySeriesKey] = value;
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
      sourceId: event.sourceId,
      retrievedAtOnOrBefore: latestCapturedAt,
      order: "DESC",
      limit: 20,
    });
    const result = results.find((item) => item.actual !== undefined || item.expected !== undefined || item.previous !== undefined);

    return {
      eventIdentityKey: latestIdentity,
      eventId: event.id,
      subject: event.subject,
      jurisdiction: event.identity?.jurisdiction ?? event.jurisdiction ?? "UNKNOWN",
      t0: String(ordered[0].snapshot.metadata?.t0 ?? event.releasedAt ?? event.scheduledAt ?? ""),
      ...(result?.actual !== undefined ? { actual: result.actual } : {}),
      ...(result?.expected !== undefined ? { expected: result.expected } : {}),
      ...(result?.previous !== undefined ? { previous: result.previous } : {}),
      ...(result?.unit ? { unit: result.unit } : {}),
      ...(result?.sourceId ? { resultSource: result.sourceId } : {}),
      moves,
      missingRequirements: ordered.reduce((sum, item) => sum + item.snapshot.missingRequirements.length, 0),
    };
  } catch {
    return null;
  }
}
