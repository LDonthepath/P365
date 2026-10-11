import type { DashboardIngestion } from "../ingestion/dashboard-ingestion";
import type { CalendarEvent, NewsItem } from "../data/types";
import type { Context, Evidence, Event, Observation, ProviderHealth } from "../domain/types";
import type { EconomicEventResult } from "../domain/event-result";
import { buildDashboardContexts } from "../domain/context";
import { reconcileEvents } from "../domain/event-identity";
import { normalizeBiquoteEconomicCalendar } from "./biquote-economic-calendar";
import { calendarToCanonicalRecords, cryptoMarketToObservations, fomcToCanonicalRecords, macroToCanonicalRecords, newsToEvidence, providerHealthForResult, P365_SOURCES } from "./provider-canonical";
export type NormalizedDashboardData = { macroNews: NewsItem[]; cryptoNews: NewsItem[]; calendarEvents: CalendarEvent[]; calendarProviderMessage?: string; unavailableSources: string[]; observations: Observation[]; macroObservations: Observation[]; events: Event[]; economicEventResults: EconomicEventResult[]; contexts: Context[]; evidence: Evidence[]; providerHealth: ProviderHealth[] };
function normalizeNewsUrl(url: string): string { return url.trim().replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase(); }
function dedupeNewsBySource(items: NewsItem[], sourceId: string): NewsItem[] { const seen = new Set<string>(); return items.filter((item) => { const key = `${sourceId}:${normalizeNewsUrl(item.url)}`; if (!normalizeNewsUrl(item.url) || seen.has(key)) return false; seen.add(key); return true¶»§q«^