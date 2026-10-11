/**
 * PERSIST-CONS-001 (#320): qualification-only fault injection.
 * These exercises use in-memory repositories and NEVER touch production DB/cron.
 * They intentionally document a cross-record-family non-atomic persistence gap.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { BiquoteEconomicCalendarRecord } from "../data/biquote-economic-calendar";
import type { MacroObservationInput } from "../data/fred";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { providerResult } from "../data/types";
import type { EconomicEventResult } from "../domain/event-result";
import { macroToCanonicalRecords, P365_SOURCES } from "../domain/normalize";
import type { Event, Observation } from "../domain/types";
import {
  InMemoryContextRepository,
  InMemoryEventRepository,
  InMemoryEvidenceRepository,
  InMemoryObservationRepository,
} from "../repositories/memory";
import type { CanonicalRepositories } from "../repositories/dashboard-repository";
import type {
  EconomicEventResultRepository,
  EventRepository,
  ObservationRepository,
} from "../repositories/types";
import {
  runHistoricalIngestion,
  type HistoricalIngestionAcquisition,
} from "./historical-ingestion";
import {
  runEventIngestion,
  type EventIngestionAcquisition,
  type EventRepositories,
} from "./event-ingestion";

const RETRIEVED = "2026-10-11T07:00:00.000Z";

function stores() {
  const observations = new InMemoryObservationRepository();
  const evidence = new InMemoryEvidenceRepository();
  const events = new InMemoryEventRepository();
  const canonical: CanonicalRepositories = {
    observations,
    evidence,
    events,
    contexts: new InMemoryContextRepository(),
  };
  return { observations, evidence, events, canonical };
}

function fredFixture(): MacroObservationInput {
  const series = MACRO_SERIES_REGISTRY.find((item) => item.seriesId === "DGS2");
  assert.ok(series, "fixture requires existing qualified FRED series");
  return {
    series,
    value: "4.75",
    observationDate: "2026-10-08",
    previousValue: null,
    vintageDate: "2026-10-08",
    releasedAt: null,
    retrievedAt: RETRIEVED,
    provenance: {
      version: "v1",
      providerResource: "/fred/series/observations",
      nativeSeriesId: "DGS2",
      observationDate: "2026-10-08",
      vintageDate: "2026-10-08",
    },
  };
}

test("PERSIST-CONS-001: Evidence commit survives an Observation failure and retry repairs lineage", async () => {
  const s = stores();
  const input = fredFixture();
  const canonical = macroToCanonicalRecords([input], P365_SOURCES.fred.id);
  assert.equal(canonical.observations.length, 1);
  assert.equal(canonical.evidence.length, 1);
  const observation = canonical.observations[0];
  const evidence = canonical.evidence[0];
  assert.equal(observation.evidenceId, evidence.id);

  let failOnce = true;
  const faultyObservationWriter: ObservationRepository = {
    save: (item: Observation) => s.observations.save(item),
    saveMany: async (items: Observation[]) => {
      if (failOnce) {
        failOnce = false;
        throw new Error("injected observation write failure");
      }
      await s.observations.saveMany(items);
    },
    findById: (id: string) => s.observations.findById(id),
  };
  const acquisition = {
    fred: async () => providerResult("fred", "SUCCESS", [input], undefined, undefined, RETRIEVED),
  } as HistoricalIngestionAcquisition;
  const repositories: CanonicalRepositories = {
    ...s.canonical,
    observations: faultyObservationWriter,
  };
  const options = { mode: "FORWARD" as const, providers: ["fred" as const] };
  const originalFlag = process.env.P365_FRED_TRANSACTIONAL_REVISIONS;
  process.env.P365_FRED_TRANSACTIONAL_REVISIONS = "0";
  try {
    const failed = await runHistoricalIngestion(options, { acquisition, repositories });
    assert.equal(failed.status, "FAILED");
    assert.equal(failed.providers[0]?.status, "PERSISTENCE_ERROR");
    assert.equal(failed.persistedObservations, 0);
    assert.equal(failed.persistedEvidence, 0, "report zeros do NOT prove no physical commit");
    assert.ok(await s.evidence.findById(evidence.id), "Evidence physically exists after failed report");
    assert.equal(await s.observations.findById(observation.id), null);

    const retried = await runHistoricalIngestion(options, { acquisition, repositories });
    assert.equal(retried.status, "SUCCESS");
    assert.equal(retried.persistedObservations, 1);
    assert.ok(await s.observations.findById(observation.id));
    assert.ok(await s.evidence.findById(observation.evidenceId));

    const replay = await runHistoricalIngestion(options, { acquisition, repositories });
    assert.equal(replay.status, "SUCCESS");
    const observationHistory = await s.observations.findHistory({
      identity: { domain: "ASSET", seriesKey: "DGS2" },
      order: "ASC",
      limit: 10,
    });
    // The registry owns the FRED series domain, not the test.
    if (observationHistory.length === 0) {
      const macroHistory = await s.observations.findHistory({
        identity: { domain: "MACRO", seriesKey: "DGS2" },
        order: "ASC",
        limit: 10,
      });
      assert.equal(macroHistory.length, 1, "same canonical Observation on retry/replay");
    } else {
      assert.equal(observationHistory.length, 1, "same canonical Observation on retry/replay");
    }
    assert.equal((await s.evidence.findHistory({
      evidenceId: evidence.id,
      order: "ASC",
      limit: 10,
    })).length, 1, "same canonical Evidence on retry/replay");
  } finally {
    if (originalFlag === undefined) delete process.env.P365_FRED_TRANSACTIONAL_REVISIONS;
    else process.env.P365_FRED_TRANSACTIONAL_REVISIONS = originalFlag;
  }
});

test("PERSIST-CONS-001: Event write failure leaves Evidence, recoverable by idempotent retry", async () => {
  const s = stores();
  let failOnce = true;
  const faultyEvents: EventRepository = {
    save: (item: Event) => s.events.save(item),
    saveMany: async (items: Event[]) => {
      if (failOnce) {
        failOnce = false;
        throw new Error("injected event write failure");
      }
      await s.events.saveMany(items);
    },
    findById: (id: string) => s.events.findById(id),
  };
  const eventResults: EconomicEventResultRepository = {
    save: async () => undefined,
    saveMany: async () => undefined,
    findById: async () => null,
  };
  const event = {
    scheduledAt: "2026-11-05T00:00:00.000Z",
    label: "November 4-5",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  };
  const acquisition = {
    "federal-reserve": async () => providerResult("federal-reserve", "SUCCESS", [event], undefined, undefined, RETRIEVED),
  } as EventIngestionAcquisition;
  const repositories: EventRepositories = {
    canonical: { ...s.canonical, events: faultyEvents },
    eventResults,
  };
  const options = { providers: ["federal-reserve" as const], jurisdictions: ["US" as const] };

  const failed = await runEventIngestion(options, { acquisition, repositories });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.providers[0]?.status, "PERSISTENCE_ERROR");
  assert.equal(failed.persistedEvidence, 0);
  assert.equal(s.events.all().length, 0);
  const evidenceBeforeRetry = await s.evidence.findHistory({ order: "ASC", limit: 10 });
  assert.equal(evidenceBeforeRetry.length, 1, "Evidence survived Event write failure");

  const retried = await runEventIngestion(options, { acquisition, repositories });
  assert.equal(retried.status, "SUCCESS");
  assert.equal(s.events.all().length, 1);
  assert.equal(s.events.all()[0]?.evidenceId, evidenceBeforeRetry[0].id);
  await runEventIngestion(options, { acquisition, repositories });
  assert.equal(s.events.all().length, 1);
  assert.equal((await s.evidence.findHistory({ order: "ASC", limit: 10 })).length, 1);
});

test("PERSIST-CONS-001: EventResult failure can leave Event and Evidence; retry completes third family", async () => {
  const s = stores();
  const record: BiquoteEconomicCalendarRecord = {
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
  };
  const results = new Map<string, EconomicEventResult>();
  let failOnce = true;
  const eventResults: EconomicEventResultRepository = {
    save: async (item) => { results.set(item.id, item); },
    saveMany: async (items) => {
      if (failOnce) {
        failOnce = false;
        throw new Error("injected EventResult write failure");
      }
      for (const item of items) results.set(item.id, item);
    },
    findById: async (id) => results.get(id) ?? null,
  };
  const acquisition = {
    biquote: async () => providerResult("biquote", "SUCCESS", [record], undefined, undefined, RETRIEVED),
  } as EventIngestionAcquisition;
  const repositories: EventRepositories = { canonical: s.canonical, eventResults };
  const options = { providers: ["biquote" as const], jurisdictions: ["US" as const] };

  const failed = await runEventIngestion(options, { acquisition, repositories });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.providers[0]?.status, "PERSISTENCE_ERROR");
  assert.equal(s.events.all().length, 1, "Event persisted before EventResult failure");
  assert.equal((await s.evidence.findHistory({ order: "ASC", limit: 10 })).length, 1);
  assert.equal(results.size, 0);

  const retried = await runEventIngestion(options, { acquisition, repositories });
  assert.equal(retried.status, "SUCCESS");
  assert.equal(results.size, 1);
  assert.equal([...results.values()][0]?.eventId, s.events.all()[0]?.id);
  await runEventIngestion(options, { acquisition, repositories });
  assert.equal(results.size, 1);
  assert.equal(s.events.all().length, 1);
  assert.equal((await s.evidence.findHistory({ order: "ASC", limit: 10 })).length, 1);
});
