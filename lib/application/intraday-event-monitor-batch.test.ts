import assert from "node:assert/strict";
import test from "node:test";
import type { EconomicEventResult } from "../domain/event-result";
import type { Event, Evidence, Observation } from "../domain/types";
import type {
  EventRepository,
  HistoricalEconomicEventResultRepository,
  HistoricalEvidenceRepository,
  ObservationRepository,
} from "../repositories/types";
import {
  resolveIntradayMonitorDependencies,
  resolveIntradayObservations,
  resolveIntradayResultEvidence,
} from "./intraday-event-monitor";

function observation(id: string): Observation {
  return {
    id,
    domain: "MARKET",
    subject: id,
    value: "1",
    observedAt: "2026-09-30T12:30:00.000Z",
    retrievedAt: "2026-09-30T12:31:00.000Z",
    sourceId: "test",
    quality: "FRESH",
    evidenceId: `evidence-${id}`,
    metadata: { metricId: id },
  };
}

test("intraday resolution uses one batch call when repository supports it", async () => {
  let batchCalls = 0;
  let singleCalls = 0;
  const repository: ObservationRepository = {
    async save() {},
    async saveMany() {},
    async findById() {
      singleCalls += 1;
      throw new Error("single lookup must not be used when batch lookup exists");
    },
    async findManyByIds(ids) {
      batchCalls += 1;
      assert.deepEqual(ids, ["obs-a", "obs-b", "missing"]);
      return [observation("obs-a"), observation("obs-b")];
    },
  };

  const result = await resolveIntradayObservations(repository, [
    "obs-a",
    "obs-b",
    "obs-a",
    "missing",
  ]);

  assert.equal(batchCalls, 1);
  assert.equal(singleCalls, 0);
  assert.deepEqual([...result.keys()], ["obs-a", "obs-b"]);
});

test("intraday resolution keeps the compatible findById fallback", async () => {
  let singleCalls = 0;
  const rows = new Map([
    ["obs-a", observation("obs-a")],
    ["obs-b", observation("obs-b")],
  ]);
  const repository: ObservationRepository = {
    async save() {},
    async saveMany() {},
    async findById(id) {
      singleCalls += 1;
      return rows.get(id) ?? null;
    },
  };

  const result = await resolveIntradayObservations(repository, [
    "obs-b",
    "missing",
    "obs-b",
    "obs-a",
  ]);

  assert.equal(singleCalls, 3, "duplicate IDs are resolved once even on fallback");
  assert.deepEqual([...result.keys()], ["obs-b", "obs-a"]);
});


test("intraday monitor starts independent canonical reads concurrently", async () => {
  const started: string[] = [];
  let resolveEvent!: (value: Event | null) => void;
  let resolveObservations!: (value: Observation[]) => void;
  let resolveResults!: (value: EconomicEventResult[]) => void;

  const eventRepository: EventRepository = {
    async save() {},
    async saveMany() {},
    findById() {
      started.push("event");
      return new Promise<Event | null>((resolve) => {
        resolveEvent = resolve;
      });
    },
  };
  const observationRepository: ObservationRepository = {
    async save() {},
    async saveMany() {},
    async findById() {
      throw new Error("batch path expected");
    },
    findManyByIds(ids) {
      started.push("observations");
      assert.deepEqual(ids, ["obs-a", "obs-b"]);
      return new Promise<Observation[]>((resolve) => {
        resolveObservations = resolve;
      });
    },
  };
  const eventResultRepository: HistoricalEconomicEventResultRepository = {
    findHistory(query) {
      started.push("results");
      assert.deepEqual(query, {
        eventIdentityKey: "event:v1:US:2026-09-30T14:30:00.000Z:test-event",
        retrievedAtOnOrBefore: "2026-09-30T15:30:00.000Z",
        order: "DESC",
        limit: 500,
      });
      return new Promise<EconomicEventResult[]>((resolve) => {
        resolveResults = resolve;
      });
    },
  };

  const pending = resolveIntradayMonitorDependencies({
    eventRepository,
    observationRepository,
    eventResultRepository,
    eventId: "event-a",
    observationIds: ["obs-a", "obs-b"],
    eventIdentityKey: "event:v1:US:2026-09-30T14:30:00.000Z:test-event",
    latestCapturedAt: "2026-09-30T15:30:00.000Z",
  });

  assert.deepEqual(
    started,
    ["event", "observations", "results"],
    "all independent reads must start before any one of them resolves",
  );

  resolveEvent(null);
  resolveObservations([observation("obs-a"), observation("obs-b")]);
  resolveResults([]);

  const result = await pending;
  assert.equal(result.event, null);
  assert.deepEqual([...result.observations.keys()], ["obs-a", "obs-b"]);
  assert.deepEqual(result.results, []);
});


test("intraday result evidence respects the same point-in-time cutoff", async () => {
  const queries: Parameters<HistoricalEvidenceRepository["findHistory"]>[0][] = [];
  const result: EconomicEventResult = {
    id: "result-a",
    eventId: "event-a",
    eventIdentityKey: "event:v1:US:2026-10-02T12:30:00.000Z:nonfarm-payrolls",
    actual: 29,
    expected: 52,
    expectedType: "FORECAST",
    previous: 162,
    unit: "job",
    releasedAt: "2026-10-02T12:30:00.000Z",
    retrievedAt: "2026-10-02T12:34:00.000Z",
    sourceId: "biquote",
    evidenceId: "biquote-economic-event-evidence-mql5:318234",
  };
  const evidence: Evidence = {
    id: result.evidenceId,
    sourceId: "biquote",
    kind: "EVENT",
    subject: "Nonfarm Payrolls",
    content: "{}",
    capturedAt: "2026-10-02T12:34:00.000Z",
    retrievedAt: "2026-10-02T12:34:00.000Z",
    releasedAt: "2026-10-02T12:30:00.000Z",
    metadata: {
      eventIdentityKey: result.eventIdentityKey ?? "",
      multiplier: "thousands",
    },
  };
  const repository: HistoricalEvidenceRepository = {
    async findHistory(query) {
      queries.push(query);
      return [evidence];
    },
  };

  const resolved = await resolveIntradayResultEvidence(
    repository,
    result,
    result.eventIdentityKey ?? "",
    "2026-10-02T13:30:00.000Z",
  );

  assert.equal(resolved?.id, result.evidenceId);
  assert.deepEqual(queries, [{
    sourceId: "biquote",
    kind: "EVENT",
    metadataEquals: {
      eventIdentityKey: "event:v1:US:2026-10-02T12:30:00.000Z:nonfarm-payrolls",
    },
    retrievedAtOnOrBefore: "2026-10-02T13:30:00.000Z",
    order: "DESC",
    limit: 1,
  }]);
});

test("intraday result evidence fails closed when the evidence ID does not match", async () => {
  const repository: HistoricalEvidenceRepository = {
    async findHistory() {
      return [{
        id: "different-evidence",
        sourceId: "biquote",
        kind: "EVENT",
        subject: "Nonfarm Payrolls",
        content: "{}",
        capturedAt: "2026-10-02T12:34:00.000Z",
        retrievedAt: "2026-10-02T12:34:00.000Z",
        metadata: {
          eventIdentityKey: "event:v1:US:2026-10-02T12:30:00.000Z:nonfarm-payrolls",
          multiplier: "thousands",
        },
      }];
    },
  };
  const result: EconomicEventResult = {
    id: "result-a",
    eventId: "event-a",
    actual: 29,
    retrievedAt: "2026-10-02T12:34:00.000Z",
    sourceId: "biquote",
    evidenceId: "expected-evidence",
  };

  const resolved = await resolveIntradayResultEvidence(
    repository,
    result,
    "event:v1:US:2026-10-02T12:30:00.000Z:nonfarm-payrolls",
    "2026-10-02T13:30:00.000Z",
  );

  assert.equal(resolved, null);
});


test("intraday result multiplier evidence failure does not fail the monitor enrichment", async () => {
  const repository: HistoricalEvidenceRepository = {
    async findHistory() {
      throw new Error("optional evidence unavailable");
    },
  };
  const result: EconomicEventResult = {
    id: "result-a",
    eventId: "event-a",
    actual: 29,
    retrievedAt: "2026-10-02T12:34:00.000Z",
    sourceId: "biquote",
    evidenceId: "expected-evidence",
  };

  const resolved = await resolveIntradayResultEvidence(
    repository,
    result,
    "event:v1:US:2026-10-02T12:30:00.000Z:nonfarm-payrolls",
    "2026-10-02T13:30:00.000Z",
  );

  assert.equal(resolved, null);
});
