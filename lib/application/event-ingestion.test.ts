import assert from "node:assert/strict";
import type { BiquoteEconomicCalendarRecord } from "../data/biquote-economic-calendar";
import {
  biquoteJurisdiction,
  forexFactoryJurisdiction,
} from "../data/event-jurisdiction";
import { providerFetchPolicy } from "../data/provider-fetch-policy";
import { providerResult, type CalendarEvent, type ProviderResult } from "../data/types";
import { economicEventResultDedupeKey, type EconomicEventResult } from "../domain/event-result";
import type { Event } from "../domain/types";
import { fomcToCanonicalRecords } from "../domain/normalize";
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
    eventId: "us-cpi",
    time: "2026-10-15T12:30:00.000Z",
    period: "Sep",
    countryCode: "US",
    currency: "USD",
    name: "CPI",
    importance: "high",
    type: "economic",
    unit: "%",
    actual: null,
    forecast: 2.8,
    previous: 2.9,
    revisedPrevious: null,
    revision: null,
    timeMode: "exact",
    sourceUrl: "https://provider.test/us-cpi",
    source: "BLS",
    ...overrides,
  };
}

class MemoryEventResultRepository implements EconomicEventResultRepository {
  readonly items = new Map<string, EconomicEventResult>();
  async save(item: EconomicEventResult): Promise<void> { this.items.set(item.id, item); }
  async saveMany(items: EconomicEventResult[]): Promise<void> { items.forEach((item) => this.items.set(item.id, item)); }
  async findById(id: string): Promise<EconomicEventResult | null> { return this.items.get(id) ?? null; }
}

function repositories(): { repositories: EventRepositories; events: InMemoryEventRepository; results: MemoryEventResultRepository } {
  const events = new InMemoryEventRepository();
  const results = new MemoryEventResultRepository();
  return {
    events,
    results,
    repositories: {
      canonical: {
        observations: new InMemoryObservationRepository(),
        events,
        evidence: new InMemoryEvidenceRepository(),
        contexts: new InMemoryContextRepository(),
      },
      eventResults: results,
    },
  };
}

function calendarEvent(index: number, country = "USD"): CalendarEvent {
  return {
    id: `calendar-${index}`,
    time: "19:30",
    event: `Calendar event ${index}`,
    country,
    impact: "HIGH",
    status: "UPCOMING",
    dateISO: `2026-10-${String(index + 1).padStart(2, "0")}T12:30:00.000Z`,
  };
}

function acquisition(
  calls: EventIngestionProvider[],
  overrides: Partial<EventIngestionAcquisition> = {},
): EventIngestionAcquisition {
  const record = <T>(provider: EventIngestionProvider, result: ProviderResult<T>) => async () => {
    calls.push(provider);
    return result;
  };
  return {
    "forex-factory": record("forex-factory", providerResult("forex-factory", "SUCCESS", Array.from({ length: 8 }, (_, index) => calendarEvent(index)), undefined, undefined, retrievedAt)),
    biquote: record("biquote", providerResult("biquote", "SUCCESS", [biquoteRecord()], undefined, undefined, retrievedAt)),
    "federal-reserve": record("federal-reserve", providerResult("federal-reserve", "SUCCESS", [{ scheduledAt: "2026-11-05T00:00:00.000Z", label: "November 4-5", sourceUrl: "https://federalreserve.gov" }], undefined, undefined, retrievedAt)),
    ...overrides,
  };
}

async function main(): Promise<void> {
  assert.deepEqual(parseEventIngestionRequest(new URLSearchParams("jurisdictions=US")), { ok: false, error: "providers is required" });
  assert.deepEqual(parseEventIngestionRequest(new URLSearchParams("providers=unknown&jurisdictions=US")), { ok: false, error: "Unsupported providers: unknown" });
  assert.deepEqual(parseEventIngestionRequest(new URLSearchParams("providers=biquote")), { ok: false, error: "jurisdictions is required" });
  assert.deepEqual(parseEventIngestionRequest(new URLSearchParams("providers=biquote&jurisdictions=EURO_AREA")), { ok: false, error: "Unsupported jurisdictions: EURO_AREA" });
  assert.deepEqual(
    parseEventIngestionRequest(new URLSearchParams("providers=biquote,BIQUOTE,forex-factory&jurisdictions=us,CHINA,US,JAPAN")),
    { ok: true, options: { providers: ["biquote", "forex-factory"], jurisdictions: ["US", "CHINA", "JAPAN"] } },
  );
  assert.deepEqual(
    parseEventIngestionRequest(new URLSearchParams(
      "providers=biquote&jurisdictions=US,CHINA,JAPAN&biquoteFrom=2026-09-20T03:00:00Z&biquoteTo=2026-09-20T15:00:00Z&biquoteImportance=HIGH&biquoteLimit=20",
    )),
    {
      ok: true,
      options: {
        providers: ["biquote"],
        jurisdictions: ["US", "CHINA", "JAPAN"],
        biquote: {
          from: "2026-09-20T03:00:00.000Z",
          to: "2026-09-20T15:00:00.000Z",
          importance: "high",
          limit: 20,
        },
      },
    },
  );
  assert.deepEqual(
    parseEventIngestionRequest(new URLSearchParams("providers=forex-factory&jurisdictions=US&biquoteLimit=20")),
    { ok: false, error: "Biquote filters require providers to include biquote" },
  );
  assert.deepEqual(
    parseEventIngestionRequest(new URLSearchParams("providers=biquote&jurisdictions=US&biquoteFrom=2026-09-20T03:00:00Z")),
    { ok: false, error: "biquoteFrom and biquoteTo must be provided together" },
  );
  assert.deepEqual(
    parseEventIngestionRequest(new URLSearchParams("providers=biquote&jurisdictions=US&biquoteFrom=bad&biquoteTo=2026-09-20T15:00:00Z")),
    { ok: false, error: "biquoteFrom/biquoteTo must be valid ordered timestamps" },
  );
  assert.deepEqual(
    parseEventIngestionRequest(new URLSearchParams("providers=biquote&jurisdictions=US&biquoteImportance=critical")),
    { ok: false, error: "biquoteImportance must be low, medium, or high" },
  );
  assert.deepEqual(
    parseEventIngestionRequest(new URLSearchParams("providers=biquote&jurisdictions=US&biquoteLimit=501")),
    { ok: false, error: "biquoteLimit must be an integer from 1 to 500" },
  );

  assert.equal(forexFactoryJurisdiction("USD"), "US");
  assert.equal(forexFactoryJurisdiction("CNY"), "CHINA");
  assert.equal(forexFactoryJurisdiction("JPY"), "JAPAN");
  assert.equal(forexFactoryJurisdiction("EUR"), "OTHER");
  assert.equal(biquoteJurisdiction("US"), "US");
  assert.equal(biquoteJurisdiction("CN"), "CHINA");
  assert.equal(biquoteJurisdiction("JP"), "JAPAN");
  assert.equal(biquoteJurisdiction("GB"), "OTHER");

  const fixtures = [
    biquoteRecord({ id: "us-nfp", eventId: "nfp", name: "Nonfarm Payrolls", countryCode: "US", currency: "USD" }),
    biquoteRecord({ id: "cn-pmi", eventId: "cn-pmi", name: "Manufacturing PMI", countryCode: "CN", currency: "CNY", timeMode: "exact", source: "National Bureau of Statistics" }),
    biquoteRecord({ id: "jp-boj", eventId: "jp-boj", name: "BoJ Interest Rate Decision", countryCode: "JP", currency: "JPY", timeMode: "tentative", source: "Bank of Japan" }),
  ];
  const normalized = normalizeBiquoteEconomicCalendar(fixtures, retrievedAt);
  assert.deepEqual(normalized.map((item) => item.event.jurisdiction), ["US", "CHINA", "JAPAN"]);
  normalized.forEach((item, index) => {
    assert.equal(item.event.scheduledAt, fixtures[index].time);
    assert.equal(item.event.importance, "HIGH");
    assert.equal(item.evidence.metadata?.countryCode, fixtures[index].countryCode);
    assert.equal(item.evidence.metadata?.timeMode, fixtures[index].timeMode);
    assert.equal(item.evidence.metadata?.source, fixtures[index].source);
  });
  assert.equal(normalized[2].event.scheduledAt, fixtures[2].time);
  assert.equal(normalized[2].event.occurredAt, undefined, "tentative pre-event schedule must not fabricate an occurrence time");
  assert.equal(normalized[2].event.releasedAt, undefined);
  assert.equal(normalized[2].result.releasedAt, undefined);
  assert.equal(normalized[2].evidence.releasedAt, undefined);

  const exactResult = normalizeBiquoteEconomicCalendar([
    biquoteRecord({ actual: 3.1, timeMode: "exact" }),
  ], retrievedAt)[0];
  assert.equal(exactResult.event.occurredAt, exactResult.event.scheduledAt);
  assert.equal(exactResult.event.releasedAt, exactResult.event.scheduledAt);
  assert.equal(exactResult.result.releasedAt, exactResult.event.scheduledAt);
  assert.equal(exactResult.evidence.releasedAt, exactResult.event.scheduledAt);

  for (const timeMode of ["tentative", "date", "notime", null, undefined, "unknown"] as const) {
    const nonExactResult = normalizeBiquoteEconomicCalendar([
      biquoteRecord({ id: `non-exact-${timeMode ?? "missing"}`, actual: 3.1, timeMode }),
    ], retrievedAt)[0];
    assert.equal(nonExactResult.event.scheduledAt, "2026-10-15T12:30:00.000Z");
    assert.equal(nonExactResult.result.actual, 3.1, `${timeMode ?? "missing"} actual must persist`);
    assert.equal(nonExactResult.event.occurredAt, undefined, `${timeMode ?? "missing"} must not fabricate occurredAt`);
    assert.equal(nonExactResult.event.releasedAt, undefined, `${timeMode ?? "missing"} must not fabricate Event.releasedAt`);
    assert.equal(nonExactResult.result.releasedAt, undefined, `${timeMode ?? "missing"} must not fabricate result.releasedAt`);
    assert.equal(nonExactResult.evidence.releasedAt, undefined, `${timeMode ?? "missing"} must not fabricate Evidence.releasedAt`);
    assert.equal(nonExactResult.evidence.metadata?.timeMode, timeMode ?? null);
  }

  const officialFomc = fomcToCanonicalRecords(
    [{ scheduledAt: "2026-11-05T00:00:00.000Z", label: "November 4-5", sourceUrl: "https://federalreserve.gov" }],
    "federal-reserve",
  );
  assert.equal(officialFomc.events[0].jurisdiction, "US");
  assert.equal(officialFomc.events[0].occurredAt, undefined);
  assert.equal(officialFomc.events[0].releasedAt, undefined);
  assert.equal(officialFomc.evidence[0].metadata?.scheduledAtIsDateAnchor, true);

  const preRelease = normalized[0];
  assert.equal(preRelease.event.status, "UPCOMING");
  assert.equal(preRelease.result.actual, undefined);
  assert.equal(preRelease.result.expected, 2.8);
  assert.equal(preRelease.result.previous, 2.9);
  const identical = normalizeBiquoteEconomicCalendar([fixtures[0]], "2026-09-20T10:00:00.000Z")[0];
  assert.equal(preRelease.result.id, identical.result.id, "identical snapshots must retain a stable id");
  assert.equal(
    economicEventResultDedupeKey(preRelease.result),
    economicEventResultDedupeKey(identical.result),
    "retrieval time must not defeat durable snapshot dedupe",
  );
  const actual = normalizeBiquoteEconomicCalendar([biquoteRecord({ id: "us-nfp", eventId: "nfp", name: "Nonfarm Payrolls", actual: 150 })], retrievedAt)[0];
  assert.equal(actual.result.actual, 150);
  assert.equal(actual.result.releasedAt, actual.event.scheduledAt);
  assert.notEqual(actual.result.id, preRelease.result.id, "a later actual must create a new result snapshot");
  assert.notEqual(economicEventResultDedupeKey(actual.result), economicEventResultDedupeKey(preRelease.result));
  const revised = normalizeBiquoteEconomicCalendar([biquoteRecord({ id: "us-nfp", eventId: "nfp", name: "Nonfarm Payrolls", actual: 150, revisedPrevious: 145, revision: -5 })], retrievedAt)[0];
  assert.notEqual(revised.result.id, actual.result.id, "a later revision must create a new result snapshot");

  const selectedCalls: EventIngestionProvider[] = [];
  const selectedStore = repositories();
  const selected = await runEventIngestion(
    { providers: ["forex-factory"], jurisdictions: ["US"] },
    { acquisition: acquisition(selectedCalls), repositories: selectedStore.repositories },
  );
  assert.deepEqual(selectedCalls, ["forex-factory"], "unselected providers must not execute");
  assert.equal(selected.status, "SUCCESS");
  assert.equal(selected.persistedEvents, 8, "durable ingestion must not inherit the six-event presentation cap");

  const multiJurisdictionStore = repositories();
  const multiJurisdiction = await runEventIngestion(
    { providers: ["biquote"], jurisdictions: ["US", "CHINA", "JAPAN"] },
    {
      acquisition: acquisition([], {
        biquote: async () => providerResult("biquote", "SUCCESS", fixtures, undefined, undefined, retrievedAt),
      }),
      repositories: multiJurisdictionStore.repositories,
    },
  );
  assert.equal(multiJurisdiction.persistedEvents, 3);
  assert.equal(multiJurisdiction.persistedEvidence, 3);
  assert.equal(multiJurisdiction.persistedResults, 3);
  assert.equal((await multiJurisdictionStore.events.findById("biquote-economic-event-cn-pmi"))?.jurisdiction, "CHINA");
  assert.equal((await multiJurisdictionStore.events.findById("biquote-economic-event-jp-boj"))?.jurisdiction, "JAPAN");

  const lifecycleStore = repositories();
  await runEventIngestion(
    { providers: ["biquote"], jurisdictions: ["US"] },
    { acquisition: acquisition([], { biquote: async () => providerResult("biquote", "SUCCESS", [fixtures[0]], undefined, undefined, retrievedAt) }), repositories: lifecycleStore.repositories },
  );
  await runEventIngestion(
    { providers: ["biquote"], jurisdictions: ["US"] },
    { acquisition: acquisition([], { biquote: async () => providerResult("biquote", "SUCCESS", [fixtures[0]], undefined, undefined, retrievedAt) }), repositories: lifecycleStore.repositories },
  );
  assert.equal(lifecycleStore.results.items.size, 1, "repeated identical ingestion must be idempotent");
  await runEventIngestion(
    { providers: ["biquote"], jurisdictions: ["US"] },
    { acquisition: acquisition([], { biquote: async () => providerResult("biquote", "SUCCESS", [biquoteRecord({ id: "us-nfp", eventId: "nfp", name: "Nonfarm Payrolls", actual: 150 })], undefined, undefined, retrievedAt) }), repositories: lifecycleStore.repositories },
  );
  await runEventIngestion(
    { providers: ["biquote"], jurisdictions: ["US"] },
    { acquisition: acquisition([], { biquote: async () => providerResult("biquote", "SUCCESS", [biquoteRecord({ id: "us-nfp", eventId: "nfp", name: "Nonfarm Payrolls", actual: 150, revisedPrevious: 145 })], undefined, undefined, retrievedAt) }), repositories: lifecycleStore.repositories },
  );
  assert.equal(lifecycleStore.results.items.size, 3, "actual and revision snapshots must remain append-only");

  const partialStore = repositories();
  const partial = await runEventIngestion(
    { providers: ["forex-factory", "biquote"], jurisdictions: ["US"] },
    {
      acquisition: acquisition([], { biquote: async () => providerResult("biquote", "ERROR", [], "provider failed") }),
      repositories: partialStore.repositories,
    },
  );
  assert.equal(partial.status, "PARTIAL");
  assert.equal(partial.persistedEvents, 8, "one provider failure must not suppress successful provider writes");
  const allFailed = await runEventIngestion(
    { providers: ["biquote"], jurisdictions: ["US"] },
    {
      acquisition: acquisition([], { biquote: async () => providerResult("biquote", "ERROR", [], "provider failed") }),
      repositories: repositories().repositories,
    },
  );
  assert.equal(allFailed.status, "FAILED");

  const fetchCalls: unknown[] = [];
  const fresh = createEventIngestionAcquisition(
    { providers: ["forex-factory", "biquote", "federal-reserve"], jurisdictions: ["US", "CHINA", "JAPAN"] },
    {
      fetchEconomicCalendar: async (...args) => { fetchCalls.push(args); return providerResult("forex-factory", "EMPTY", []); },
      fetchBiquoteEconomicCalendar: async (options) => { fetchCalls.push(options); return providerResult("biquote", "EMPTY", []); },
      fetchFomcEvents: async (...args) => { fetchCalls.push(args); return providerResult("federal-reserve", "EMPTY", []); },
    },
  );
  await Promise.all([fresh["forex-factory"](), fresh.biquote(), fresh["federal-reserve"]()]);
  assert.deepEqual(fetchCalls, [
    [undefined, "FRESH"],
    { countries: ["US", "CN", "JP"], limit: 500, acquisitionMode: "FRESH" },
    [undefined, "FRESH"],
  ]);

  const boundedFetchCalls: unknown[] = [];
  const bounded = createEventIngestionAcquisition(
    {
      providers: ["biquote"],
      jurisdictions: ["US", "CHINA", "JAPAN"],
      biquote: {
        from: "2026-09-20T03:00:00.000Z",
        to: "2026-09-20T15:00:00.000Z",
        importance: "high",
        limit: 20,
      },
    },
    {
      fetchEconomicCalendar: async () => providerResult("forex-factory", "EMPTY", []),
      fetchBiquoteEconomicCalendar: async (options) => {
        boundedFetchCalls.push(options);
        return providerResult("biquote", "EMPTY", []);
      },
      fetchFomcEvents: async () => providerResult("federal-reserve", "EMPTY", []),
    },
  );
  await bounded.biquote();
  assert.deepEqual(boundedFetchCalls, [{
    countries: ["US", "CN", "JP"],
    from: "2026-09-20T03:00:00.000Z",
    to: "2026-09-20T15:00:00.000Z",
    importance: "high",
    limit: 20,
    acquisitionMode: "FRESH",
  }]);

  assert.deepEqual(providerFetchPolicy("FRESH", 3600), { cache: "no-store" });
  assert.deepEqual(providerFetchPolicy("CACHED", 3600), { next: { revalidate: 3600, tags: ["p365-fast"] } });

  const legacyEvent: Event = {
    id: "legacy-event",
    subject: "Legacy",
    description: "No jurisdiction remains valid",
    retrievedAt,
    status: "UNKNOWN",
    importance: "LOW",
    sourceId: "legacy",
    evidenceId: "legacy-evidence",
  };
  assert.equal(legacyEvent.jurisdiction, undefined);
}

void main();
