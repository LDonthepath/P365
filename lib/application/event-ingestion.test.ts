import assert from "node:assert/strict";
import type { BiquoteEconomicCalendarRecord } from "../data/biquote-economic-calendar";
import {
  biquoteJurisdiction,
  forexFactoryJurisdiction,
} from "../data/event-jurisdiction";
import { providerFetchPolicy } from "../data/provider-fetch-policy";
import { providerResult, type CalendarEvent, type ProviderResult } from "../data/types";
import { economicEventResultDedupeKey, type EconomicEventResult } from "../domain/event-result";
import { reconcileEvents } from "../domain/event-identity";
import type { Event } from "../domain/types";
import { calendarToCanonicalRecords, fomcToCanonicalRecords } from "../normalization/provider-canonical";
import { normalizeBiquoteEconomicCalendar } from "../normalization/biquote-economic-calendar";
import {
  InMemoryContextRepository,
  InMemoryEventRepository,
  InMemoryEvidenceRepository,
  InMemoryObservationRepository,
} from "../repositories/memory";
import type { EconomicEventResultRepository } from "../repositories/types";
import {
  createEventIngestionAcquisition,
  runEventIngestion,
  type EventIngestionAcquisition,
  type EventIngestionProvider,
  type EventRepositories,
} from "./event-ingestion";
import { parseEventIngestionRequest } from "./event-ingestion-request";

const retrievedAt = "2026-09-20T09:00:00.000Z";

function biquoteRecord(overrides: Partial<BiquoteEconomicCalendarRecord> = {}): BiquoteEconomicCalendarRecord {
  return {
    id: "us-cpi-2026-10",
    eventId: "us-cpi¶»§q«^