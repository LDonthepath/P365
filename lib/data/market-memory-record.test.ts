import assert from "node:assert/strict";
import test from "node:test";
import type { Evidence } from "../domain/types";
import { marketMemoryDedupeKey } from "./market-memory-record";

function eventEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: "evidence-event-1",
    sourceId: "biquote",
    kind: "EVENT",
    subject: "Nonfarm Payrolls",
    content: JSON.stringify({
      actual: null,
      forecast: 180,
      previous: 175,
    }),
    capturedAt: "2026-10-07T00:00:00.000Z",
    retrievedAt: "2026-10-07T00:00:00.000Z",
    metadata: {
      eventIdentityKey: "event-key-1",
      countryCode: "US",
      status: "UPCOMING",
    },
    ...overrides,
  };
}

test("EVENT Evidence ignores retrieval-only changes in durable dedupe identity", () => {
  const first = eventEvidence();
  const repeated = eventEvidence({
    capturedAt: "2026-10-07T00:05:00.000Z",
    retrievedAt: "2026-10-07T00:05:00.000Z",
  });

  assert.equal(
    marketMemoryDedupeKey("EVIDENCE", first),
    marketMemoryDedupeKey("EVIDENCE", repeated),
  );
});

test("EVENT Evidence keeps forecast-to-actual and revision changes append-only", () => {
  const forecast = eventEvidence();
  const actual = eventEvidence({
    content: JSON.stringify({
      actual: 190,
      forecast: 180,
      previous: 175,
    }),
    retrievedAt: "2026-10-07T00:05:00.000Z",
    capturedAt: "2026-10-07T00:05:00.000Z",
  });
  const revision = eventEvidence({
    content: JSON.stringify({
      actual: 190,
      forecast: 180,
      previous: 177,
    }),
    retrievedAt: "2026-10-07T00:10:00.000Z",
    capturedAt: "2026-10-07T00:10:00.000Z",
  });

  assert.notEqual(
    marketMemoryDedupeKey("EVIDENCE", forecast),
    marketMemoryDedupeKey("EVIDENCE", actual),
  );
  assert.notEqual(
    marketMemoryDedupeKey("EVIDENCE", actual),
    marketMemoryDedupeKey("EVIDENCE", revision),
  );
});

test("EVENT Evidence preserves meaningful calendar status changes", () => {
  const tomorrow = eventEvidence({
    id: "forex-factory-event-evidence",
    sourceId: "forex-factory",
    content: "US · HIGH impact · TOMORROW",
    metadata: {
      country: "US",
      impact: "HIGH",
      status: "TOMORROW",
      scheduledAt: "2026-10-08T12:30:00.000Z",
    },
  });
  const today = eventEvidence({
    ...tomorrow,
    content: "US · HIGH impact · TODAY",
    retrievedAt: "2026-10-08T00:05:00.000Z",
    capturedAt: "2026-10-08T00:05:00.000Z",
    metadata: {
      country: "US",
      impact: "HIGH",
      status: "TODAY",
      scheduledAt: "2026-10-08T12:30:00.000Z",
    },
  });

  assert.notEqual(
    marketMemoryDedupeKey("EVIDENCE", tomorrow),
    marketMemoryDedupeKey("EVIDENCE", today),
  );
});

test("EVENT Evidence fingerprint is stable across metadata key order", () => {
  const first = eventEvidence({
    id: "fomc-calendar-evidence",
    sourceId: "federal-reserve",
    subject: "FOMC meeting",
    content: "FOMC meeting scheduled for November 4-5",
    metadata: {
      source: "Federal Reserve",
      scheduledAt: "2026-11-05T00:00:00.000Z",
      scheduledAtIsDateAnchor: true,
      url: "https://www.federalreserve.gov",
    },
  });
  const repeated = eventEvidence({
    ...first,
    capturedAt: "2026-10-07T06:00:00.000Z",
    retrievedAt: "2026-10-07T06:00:00.000Z",
    metadata: {
      url: "https://www.federalreserve.gov",
      scheduledAtIsDateAnchor: true,
      scheduledAt: "2026-11-05T00:00:00.000Z",
      source: "Federal Reserve",
    },
  });

  assert.equal(
    marketMemoryDedupeKey("EVIDENCE", first),
    marketMemoryDedupeKey("EVIDENCE", repeated),
  );
});

test("EVENT Evidence treats a source release-time change as a new factual version", () => {
  const first = eventEvidence({ releasedAt: "2026-10-07T12:30:00.000Z" });
  const corrected = eventEvidence({
    releasedAt: "2026-10-07T12:31:00.000Z",
    capturedAt: "2026-10-07T12:35:00.000Z",
    retrievedAt: "2026-10-07T12:35:00.000Z",
  });

  assert.notEqual(
    marketMemoryDedupeKey("EVIDENCE", first),
    marketMemoryDedupeKey("EVIDENCE", corrected),
  );
});

test("NEWS Evidence keeps legacy retrieval-sensitive dedupe semantics", () => {
  const first: Evidence = {
    id: "news-1",
    sourceId: "gdelt",
    kind: "NEWS",
    subject: "Headline",
    content: "Summary",
    capturedAt: "2026-10-07T00:00:00.000Z",
    retrievedAt: "2026-10-07T00:00:00.000Z",
  };
  const repeated: Evidence = {
    ...first,
    capturedAt: "2026-10-07T00:15:00.000Z",
    retrievedAt: "2026-10-07T00:15:00.000Z",
  };

  assert.notEqual(
    marketMemoryDedupeKey("EVIDENCE", first),
    marketMemoryDedupeKey("EVIDENCE", repeated),
  );
});

test("OBSERVATION Evidence retains observation-effective-time dedupe semantics", () => {
  const first: Evidence = {
    id: "observation-evidence-1",
    sourceId: "fred",
    kind: "OBSERVATION",
    subject: "DGS2",
    content: "DGS2 = 4.2",
    capturedAt: "2026-10-07T00:00:00.000Z",
    retrievedAt: "2026-10-07T00:00:00.000Z",
    metadata: { observationEffectiveAt: "2026-10-06T00:00:00Z" },
  };
  const repeated: Evidence = {
    ...first,
    capturedAt: "2026-10-07T01:00:00.000Z",
    retrievedAt: "2026-10-07T01:00:00.000Z",
    metadata: { observationEffectiveAt: "2026-10-06T00:00:00.000Z" },
  };

  assert.equal(
    marketMemoryDedupeKey("EVIDENCE", first),
    marketMemoryDedupeKey("EVIDENCE", repeated),
  );
});
