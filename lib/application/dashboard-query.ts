import "server-only";
import type { FactualBaseline } from "../domain/baseline";
import { ingestDashboardData } from "../ingestion/dashboard-ingestion";
import { normalizeDashboardData, type NormalizedDashboardData } from "../normalization/dashboard-normalization";
import { historicalEventRepository, historicalObservationRepository } from "../repositories/dashboard-repository";
import type { Event } from "../domain/types";
import { buildRepositoryBackedMacroFactualBaselines } from "./factual-baseline";
import { getIntradayEventMonitor, type IntradayEventMonitorResult } from "./intraday-event-monitor";

export type DashboardData = NormalizedDashboardData & {
  macroBaselines: Record<string, FactualBaseline>;
  intradayEventMonitor: IntradayEventMonitorResult;
  durableHighImpactEvents: Event[];
};

async function getDurableHighImpactEvents(now = new Date()): Promise<Event[]> {
  const from = new Date(now.getTime() - 30 * 60_000).toISOString();
  const through = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  try {
    const history = await historicalEventRepository.findHistory({ scheduledAtOnOrAfter: from, scheduledAtOnOrBefore: through, retrievedAtOnOrBefore: now.toISOString(), importance: "HIGH", order: "ASC", limit: 100 });
    const latest = new Map<string, Event>();
    for (const event of history) {
      const key = event.identity?.key ?? event.id;
      const current = latest.get(key);
      if (!current || Date.parse(event.retrievedAt) >= Date.parse(current.retrievedAt)) latest.set(key, event);
    }
    return [...latest.values()].sort((a, b) => Date.parse(a.scheduledAt ?? "") - Date.parse(b.scheduledAt ?? ""));
  } catch (error) {
    console.error("Durable high-impact event read failed:", error instanceof Error ? error.message : "unknown error");
    return [];
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  // Start the independent durable event-response read immediately so it runs
  // alongside provider ingestion/normalization and baseline work.
  const intradayEventMonitorPromise = getIntradayEventMonitor();
  const durableHighImpactEventsPromise = getDurableHighImpactEvents();
  const ingestion = await ingestDashboardData();
  const normalized = normalizeDashboardData(ingestion);

  const [macroBaselines, intradayEventMonitor, durableHighImpactEvents] = await Promise.all([
    buildRepositoryBackedMacroFactualBaselines(
      normalized.macroObservations,
      historicalObservationRepository,
    ),
    intradayEventMonitorPromise,
    durableHighImpactEventsPromise,
  ]);

  // Dashboard rendering is a read/presentation path. Durable canonical writes
  // are owned by the authenticated cron ingestion workers so a page visit
  // cannot become a second ingestion/persistence clock.
  return { ...normalized, macroBaselines, intradayEventMonitor, durableHighImpactEvents };
}
