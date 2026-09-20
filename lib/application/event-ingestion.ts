import type { BiquoteEconomicCalendarRecord } from "../data/biquote-economic-calendar";
import { biquoteCountryCode, type EventIngestionJurisdiction } from "../data/event-jurisdiction";
import type { FomcEventInput } from "../data/federal-reserve-events";
import type { CalendarEvent, ProviderId, ProviderResult } from "../data/types";
import type { EconomicEventResult } from "../domain/event-result";
import { calendarToCanonicalRecords, fomcToCanonicalRecords, P365_SOURCES } from "../domain/normalize";
import type { Evidence, Event } from "../domain/types";
import { normalizeBiquoteEconomicCalendar } from "../normalization/biquote-economic-calendar";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import type { EconomicEventResultRepository } from "../repositories/types";

export const EVENT_INGESTION_PROVIDERS = ["forex-factory", "biquote", "federal-reserve"] as const;
export type EventIngestionProvider = typeof EVENT_INGESTION_PROVIDERS[number];

export type EventIngestionBiquoteOptions = {
  from?: string;
  to?: string;
  importance?: "low" | "medium" | "high";
  limit?: number;
};

export type EventIngestionOptions = {
  providers: EventIngestionProvider[];
  jurisdictions: EventIngestionJurisdiction[];
  /** Optional Biquote-only acquisition bounds for operational scheduler lanes. */
  biquote?: EventIngestionBiquoteOptions;
};

export type EventIngestionAcquisition = {
  "forex-factory": () => Promise<ProviderResult<CalendarEvent>>;
  biquote: () => Promise<ProviderResult<BiquoteEconomicCalendarRecord>>;
  "federal-reserve": () => Promise<ProviderResult<FomcEventInput>>;
};

export type EventIngestionProviderReport = {
  provider: EventIngestionProvider;
  status: ProviderResult<unknown>["status"] | "PERSISTENCE_ERROR";
  acquired: number;
  normalized: number;
  persistedEvents: number;
  persistedEvidence: number;
  persistedResults: number;
  message?: string;
  error?: string;
};

export type EventIngestionReport = {
  status: "SUCCESS" | "PARTIAL" | "EMPTY" | "FAILED";
  jurisdictions: EventIngestionJurisdiction[];
  providers: EventIngestionProviderReport[];
  persistedEvents: number;
  persistedEvidence: number;
  persistedResults: number;
};

export type EventRepositories = {
  canonical: CanonicalRepositories;
  eventResults: EconomicEventResultRepository;
};

type CanonicalEventRecords = { events: Event[]; evidence: Evidence[]; results: EconomicEventResult[] };

type EventProviderClients = {
  fetchEconomicCalendar: (limit: number | undefined, mode: "FRESH") => Promise<ProviderResult<CalendarEvent>>;
  fetchBiquoteEconomicCalendar: (options: {
    from?: string;
    to?: string;
    countries: string[];
    importance?: "low" | "medium" | "high";
    limit: number;
    acquisitionMode: "FRESH";
  }) => Promise<ProviderResult<BiquoteEconomicCalendarRecord>>;
  fetchFomcEvents: (limit: number | undefined, mode: "FRESH") => Promise<ProviderResult<FomcEventInput>>;
};

export function createEventIngestionAcquisition(
  options: EventIngestionOptions,
  clients: EventProviderClients,
): EventIngestionAcquisition {
  return {
    "forex-factory": () => clients.fetchEconomicCalendar(undefined, "FRESH"),
    biquote: () => clients.fetchBiquoteEconomicCalendar({
      countries: options.jurisdictions.map(biquoteCountryCode),
      ...(options.biquote?.from ? { from: options.biquote.from } : {}),
      ...(options.biquote?.to ? { to: options.biquote.to } : {}),
      ...(options.biquote?.importance ? { importance: options.biquote.importance } : {}),
      limit: options.biquote?.limit ?? 500,
      acquisitionMode: "FRESH",
    }),
    "federal-reserve": () => clients.fetchFomcEvents(undefined, "FRESH"),
  };
}

async function defaultDependencies(options: EventIngestionOptions): Promise<{
  acquisition: EventIngestionAcquisition;
  repositories: EventRepositories;
}> {
  const [forexFactory, biquote, federalReserve, repositories] = await Promise.all([
    import("../data/economic-calendar"),
    import("../data/biquote-economic-calendar"),
    import("../data/federal-reserve-events"),
    import("../repositories/dashboard-repository"),
  ]);
  return {
    acquisition: createEventIngestionAcquisition(options, {
      fetchEconomicCalendar: forexFactory.fetchEconomicCalendar,
      fetchBiquoteEconomicCalendar: biquote.fetchBiquoteEconomicCalendar,
      fetchFomcEvents: federalReserve.fetchFomcEvents,
    }),
    repositories: {
      canonical: repositories.canonicalRepositories,
      eventResults: repositories.economicEventResultRepository,
    },
  };
}

function providerId(provider: EventIngestionProvider): ProviderId {
  return provider;
}

function canonicalize(
  provider: EventIngestionProvider,
  result: ProviderResult<unknown>,
): CanonicalEventRecords {
  if (provider === "forex-factory") {
    const canonical = calendarToCanonicalRecords(result.data as CalendarEvent[], P365_SOURCES.forexFactory.id);
    return { ...canonical, results: [] };
  }
  if (provider === "federal-reserve") {
    const canonical = fomcToCanonicalRecords(result.data as FomcEventInput[], P365_SOURCES.federalReserve.id);
    return { ...canonical, results: [] };
  }
  const canonical = normalizeBiquoteEconomicCalendar(
    result.data as BiquoteEconomicCalendarRecord[],
    result.retrievedAt,
  );
  return {
    events: canonical.map((item) => item.event),
    evidence: canonical.map((item) => item.evidence),
    results: canonical.map((item) => item.result),
  };
}

function selectJurisdictions(
  canonical: CanonicalEventRecords,
  jurisdictions: ReadonlySet<string>,
): CanonicalEventRecords {
  const events = canonical.events.filter((event) => event.jurisdiction && jurisdictions.has(event.jurisdiction));
  const eventIds = new Set(events.map((event) => event.id));
  const evidenceIds = new Set(events.map((event) => event.evidenceId));
  return {
    events,
    evidence: canonical.evidence.filter((item) => evidenceIds.has(item.id)),
    results: canonical.results.filter((item) => eventIds.has(item.eventId)),
  };
}

async function acquire(
  provider: EventIngestionProvider,
  acquisition: EventIngestionAcquisition,
): Promise<ProviderResult<unknown>> {
  try {
    return await acquisition[provider]();
  } catch (error) {
    return {
      providerId: providerId(provider),
      status: "ERROR",
      data: [],
      retrievedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Provider acquisition failed",
    };
  }
}

async function executeProvider(
  provider: EventIngestionProvider,
  jurisdictions: ReadonlySet<string>,
  acquisition: EventIngestionAcquisition,
  repositories: EventRepositories,
): Promise<EventIngestionProviderReport> {
  const result = await acquire(provider, acquisition);
  const canonical = selectJurisdictions(canonicalize(provider, result), jurisdictions);
  const normalized = canonical.events.length;
  if (normalized === 0) {
    return {
      provider,
      status: result.status,
      acquired: result.data.length,
      normalized: 0,
      persistedEvents: 0,
      persistedEvidence: 0,
      persistedResults: 0,
      message: result.message,
      error: result.status === "ERROR" || result.status === "UNAVAILABLE" ? result.message : undefined,
    };
  }
  try {
    await repositories.canonical.evidence.saveMany(canonical.evidence);
    await repositories.canonical.events.saveMany(canonical.events);
    await repositories.eventResults.saveMany(canonical.results);
    return {
      provider,
      status: result.status,
      acquired: result.data.length,
      normalized,
      persistedEvents: canonical.events.length,
      persistedEvidence: canonical.evidence.length,
      persistedResults: canonical.results.length,
      message: result.message,
      error: result.status === "ERROR" || result.status === "UNAVAILABLE" ? result.message : undefined,
    };
  } catch (error) {
    return {
      provider,
      status: "PERSISTENCE_ERROR",
      acquired: result.data.length,
      normalized,
      persistedEvents: 0,
      persistedEvidence: 0,
      persistedResults: 0,
      message: result.message,
      error: error instanceof Error ? error.message : "Event persistence failed",
    };
  }
}

export async function runEventIngestion(
  options: EventIngestionOptions,
  dependencies: { acquisition?: EventIngestionAcquisition; repositories?: EventRepositories } = {},
): Promise<EventIngestionReport> {
  if (options.providers.length === 0) throw new Error("At least one event provider is required");
  if (options.jurisdictions.length === 0) throw new Error("At least one event jurisdiction is required");
  const defaults = dependencies.acquisition && dependencies.repositories
    ? { acquisition: dependencies.acquisition, repositories: dependencies.repositories }
    : await defaultDependencies(options);
  const acquisition = dependencies.acquisition ?? defaults.acquisition;
  const repositories = dependencies.repositories ?? defaults.repositories;
  const providers = [...new Set(options.providers)];
  const jurisdictions = [...new Set(options.jurisdictions)];
  const requestedJurisdictions = new Set<string>(jurisdictions);
  const reports = await Promise.all(
    providers.map((provider) => executeProvider(provider, requestedJurisdictions, acquisition, repositories)),
  );
  const persistedEvents = reports.reduce((total, report) => total + report.persistedEvents, 0);
  const persistedEvidence = reports.reduce((total, report) => total + report.persistedEvidence, 0);
  const persistedResults = reports.reduce((total, report) => total + report.persistedResults, 0);
  const failures = reports.filter((report) =>
    report.status === "ERROR" || report.status === "UNAVAILABLE" || report.status === "PERSISTENCE_ERROR");
  const hasPersisted = persistedEvents > 0 || persistedEvidence > 0 || persistedResults > 0;
  const status = hasPersisted
    ? failures.length > 0 ? "PARTIAL" : "SUCCESS"
    : failures.length === reports.length ? "FAILED" : failures.length > 0 ? "PARTIAL" : "EMPTY";
  return { status, jurisdictions, providers: reports, persistedEvents, persistedEvidence, persistedResults };
}
