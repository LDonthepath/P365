import type { BiquoteEconomicCalendarRecord } from "../data/biquote-economic-calendar";
import { biquoteCountryCode, type EventIngestionJurisdiction } from "../data/event-jurisdiction";
import type { FomcEventInput } from "../data/federal-reserve-events";
import type { CalendarEvent, ProviderId, ProviderResult } from "../data/types";
import type { EconomicEventResult } from "../domain/event-result";
import { calendarToCanonicalRecords, fomcToCanonicalRecords, P365_SOURCES } from "../normalization/provider-canonical";
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
  "forex-factory": () => Promise<ProviderResult<Cal¶»§q«^