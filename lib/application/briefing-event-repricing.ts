import "server-only";
import {
  EVENT_WINDOW_POLICY_V1,
  qualifyEventWindow,
  type EventWindowRole,
} from "../domain/event-window";
import type { EventRepricingAssessment } from "../domain/event-repricing";
import type { MarketSnapshot } from "../domain/market-snapshot";
import { selectActiveMarketSnapshot } from "../domain/snapshot-supersession";
import type { Event } from "../domain/types";
import {
  canonicalRepositories,
  historicalEventRepository,
  historicalMarketSnapshotRepository,
} from "../repositories/dashboard-repository";
import { assessRepositoryBackedProductionEventRepricing } from "./event-repricing";
import type { IntradayEventMonitorResult } from "./intraday-event-monitor";

const ROLES: EventWindowRole[] = [
  "PRE",
  "T_PLUS_5",
  "T_PLUS_15",
  "T_PLUS_30",
  "T_PLUS_60",
];
const POST_ROLES: Exclude<EventWindowRole, "PRE">[] = [
  "T_PLUS_5",
  "T_PLUS_15",
  "T_PLUS_30",
  "T_PLUS_60",
];
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export type BriefingEventRepricingWindow =
  | {
      status: "ASSESSED";
      role: Exclude<EventWindowRole, "PRE">;
      capturedAt: string;
      assessment: EventRepricingAssessment;
    }
  | {
      status: "INSUFFICIENT_THRESHOLDS";
      role: Exclude<EventWindowRole, "PRE">;
      capturedAt: string;
      reason: string;
    };

export type BriefingEventRepricingItem = {
  eventIdentityKey: string;
  eventId: string;
  subject: string;
  jurisdiction: string;
  t0: string;
  windows: BriefingEventRepricingWindow[];
};

export type BriefingEventRepricingResult =
  | { status: "OK"; data: BriefingEventRepricingItem[] }
  | { status: "EMPTY" }
  | { status: "ERROR" };

function roleOf(snapshot: MarketSnapshot): EventWindowRole | null {
  const role = snapshot.metadata?.eventWindowRole;
  return typeof role === "string" && ROLES.includes(role as EventWindowRole)
    ? role as EventWindowRole
    : null;
}

function identityOf(snapshot: MarketSnapshot): string | null {
  const value = snapshot.metadata?.eventIdentityKey;
  return typeof value === "string" && value.trim() ? value : null;
}

function activeSnapshotsByRole(
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
    const slots = new Map<number, MarketSnapshot[]>();
    for (const snapshot of history) {
      const capturedAt = Date.parse(snapshot.capturedAt);
      if (!Number.isFinite(capturedAt)) {
        throw new Error("Briefing repricing Snapshot has an invalid capturedAt.");
      }
      const slot = slots.get(capturedAt) ?? [];
      slot.push(snapshot);
      slots.set(capturedAt, slot);
    }

    if (slots.size !== 1) {
      throw new Error(
        "Briefing repricing role contains multiple logical capture slots.",
      );
    }

    const active = selectActiveMarketSnapshot([...slots.values()][0]);
    if (!active) {
      throw new Error("Briefing repricing role has no active canonical Snapshot.");
    }
    byRole.set(role, active);
  }
  return byRole;
}

function latestEventsAsOf(events: Event[], asOf: string): Event[] {
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff)) return [];

  const latest = new Map<string, Event>();
  for (const event of events) {
    const retrievedAt = Date.parse(event.retrievedAt);
    if (!Number.isFinite(retrievedAt) || retrievedAt > cutoff) continue;

    const key = event.identity?.key ?? event.id;
    const current = latest.get(key);
    if (
      !current
      || Date.parse(event.retrievedAt) > Date.parse(current.retrievedAt)
      || (
        event.retrievedAt === current.retrievedAt
        && event.id.localeCompare(current.id) < 0
      )
    ) {
      latest.set(key, event);
    }
  }

  return [...latest.values()];
}

function eventVersionAsOf(
  events: Event[],
  eventIdentityKey: string,
  asOf: string,
): Event | null {
  return latestEventsAsOf(events, asOf)
    .find((event) => event.identity?.key === eventIdentityKey)
    ?? null;
}

async function loadBriefingEventRepricing(
  monitor: IntradayEventMonitorResult,
  now: Date,
): Promise<BriefingEventRepricingResult> {
  if (monitor.status === "ERROR") return { status: "ERROR" };
  if (monitor.status !== "OK" || monitor.data.length === 0) {
    return { status: "EMPTY" };
  }

  const since = new Date(now.getTime() - LOOKBACK_MS).toISOString();
  const through = now.toISOString();
  const identities = new Set(monitor.data.map((item) => item.eventIdentityKey));

  const [snapshots, eventHistory] = await Promise.all([
    historicalMarketSnapshotRepository.findHistory({
      scope: EVENT_WINDOW_POLICY_V1.snapshotScope,
      capturedAtOnOrAfter: since,
      capturedAtOnOrBefore: through,
      order: "DESC",
      limit: 100,
    }),
    historicalEventRepository.findHistory({
      scheduledAtOnOrAfter: since,
      scheduledAtOnOrBefore: through,
      retrievedAtOnOrBefore: through,
      importance: "HIGH",
      order: "ASC",
      limit: 500,
    }),
  ]);

  if (eventHistory.length >= 500) {
    throw new Error(
      "Briefing repricing Event history reached the bounded read limit; contamination evidence is not complete.",
    );
  }

  const relevantSnapshots = snapshots.filter((snapshot) => {
    const identity = identityOf(snapshot);
    return identity ? identities.has(identity) : false;
  });

  const data = await Promise.all(monitor.data.map(async (item) => {
    const sameEvent = relevantSnapshots.filter(
      (snapshot) => identityOf(snapshot) === item.eventIdentityKey,
    );
    const byRole = activeSnapshotsByRole(sameEvent);
    const pre = byRole.get("PRE");

    if (!pre) {
      return {
        eventIdentityKey: item.eventIdentityKey,
        eventId: item.eventId,
        subject: item.subject,
        jurisdiction: item.jurisdiction,
        t0: item.t0,
        windows: [],
      } satisfies BriefingEventRepricingItem;
    }

    const windows: BriefingEventRepricingWindow[] = [];

    for (const role of POST_ROLES) {
      const after = byRole.get(role);
      if (!after) continue;

      const event = eventVersionAsOf(
        eventHistory,
        item.eventIdentityKey,
        after.capturedAt,
      );
      if (!event) continue;

      const qualification = qualifyEventWindow(event);
      if (
        !qualification.eligible
        || qualification.window.eventIdentityKey !== item.eventIdentityKey
      ) {
        continue;
      }

      const result = await assessRepositoryBackedProductionEventRepricing({
        window: qualification.window,
        before: pre,
        after,
        events: latestEventsAsOf(eventHistory, after.capturedAt),
        observationRepository: canonicalRepositories.observations,
      });

      windows.push(
        result.status === "ASSESSED"
          ? {
              status: "ASSESSED",
              role,
              capturedAt: after.capturedAt,
              assessment: result.assessment,
            }
          : {
              status: "INSUFFICIENT_THRESHOLDS",
              role,
              capturedAt: after.capturedAt,
              reason: result.reason,
            },
      );
    }

    return {
      eventIdentityKey: item.eventIdentityKey,
      eventId: item.eventId,
      subject: item.subject,
      jurisdiction: item.jurisdiction,
      t0: item.t0,
      windows,
    } satisfies BriefingEventRepricingItem;
  }));

  return data.length ? { status: "OK", data } : { status: "EMPTY" };
}

export async function getBriefingEventRepricing(
  monitor: IntradayEventMonitorResult,
  now = new Date(),
): Promise<BriefingEventRepricingResult> {
  try {
    return await loadBriefingEventRepricing(monitor, now);
  } catch (error) {
    console.error(
      "Failed to load briefing event repricing:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return { status: "ERROR" };
  }
}
