import assert from "node:assert/strict";
import test from "node:test";
import { buildCalendarForwardCoverage, type CalendarCoverageReceipt } from "./calendar-forward-coverage";
import type { Event } from "../domain/types";

const NOW = "2026-10-12T04:00:00.000Z";
const END = "2026-10-19T04:00:00.000Z";

function event(input: Partial<Event> = {}): Event {
  return {
    id: "e", subject: "US CPI", description: "schedule only",
    retrievedAt: NOW, scheduledAt: "2026-10-14T12:30:00.000Z",
    sourceId: "forex-factory", jurisdiction: "US",
    status: "UPCOMING", importance: "HIGH", evidenceId: "ev",
    ...input,
  };
}
function receipt(sourceId: CalendarCoverageReceipt["sourceId"],
  regions: CalendarCoverageReceipt["jurisdictions"] = ["US", "CHINA", "JAPAN"]): CalendarCoverageReceipt {
  return {
    sourceId, retrievedAt: NOW, windowStart: NOW, windowEnd: END,
    jurisdictions: regions, outcome: "EMPTY", wasTruncated: false,
    responseCompleteness: "PROVIDER_CONFIRMED_FULL_WINDOW",
  };
}
const build = (input: Parameters<typeof buildCalendarForwardCoverage>[0]) =>
  buildCalendarForwardCoverage(input);
const source = (c: ReturnType<typeof build>, src: string, jurisdiction: string) =>
  c.feeds.find((f) => f.sourceId === src)?.regions.find((r) => r.jurisdiction === jurisdiction)?.status;

test("G1-05: zero persisted Events is UNKNOWN, not a successful EMPTY feed", () => {
  const c = build({ asOf: NOW, events: [], eventReadSucceeded: true });
  assert.deepEqual(c.regions.map((r) => r.status), ["UNKNOWN", "UNKNOWN", "UNKNOWN"]);
  assert.equal(c.windowEnd, END);
  assert.equal(c.feeds.length, 3);
  assert.equal(source(c, "forex-factory", "US"), "UNKNOWN");
  assert.equal(source(c, "biquote", "CHINA"), "UNKNOWN");
  assert.equal(source(c, "federal-reserve", "JAPAN"), undefined);
  assert.equal(c.feeds[0].advertisedHorizon, "CURRENT_WEEK_FEED");
  assert.equal(c.feeds[1].advertisedHorizon, "BOUNDED_ROLLING_RESPONSE");
  assert.equal(c.feeds[2].advertisedHorizon, "FOMC_DATES_ONLY");
});

test("G1-05: explicit qualified full-window empty receipts differ from unknown for each source and region", () => {
  const c = build({ asOf: NOW, events: [], eventReadSucceeded: true,
    receipts: [
      receipt("forex-factory"), receipt("biquote"), receipt("federal-reserve", ["US"]),
    ],
  });
  assert.deepEqual(c.regions.map((r) => r.status), ["QUALIFIED_EMPTY", "QUALIFIED_EMPTY", "QUALIFIED_EMPTY"]);
  assert.equal(source(c, "forex-factory", "US"), "QUALIFIED_EMPTY");
  assert.equal(source(c, "biquote", "JAPAN"), "QUALIFIED_EMPTY");
  assert.equal(source(c, "federal-reserve", "US"), "QUALIFIED_EMPTY");
});

test("G1-05: source window shorter than requested 7 days cannot prove EMPTY", () => {
  const truncatedWindow = { ...receipt("forex-factory"), windowEnd: "2026-10-18T23:59:00.000Z" };
  const c = build({ asOf: NOW, events: [], eventReadSucceeded: true,
    receipts: [truncatedWindow],
  });
  assert.equal(source(c, "forex-factory", "US"), "UNKNOWN");
  assert.equal(source(c, "forex-factory", "CHINA"), "UNKNOWN");
  assert.equal(c.regions[0].status, "UNKNOWN");
});

test("G1-05: partial country response proves only the explicitly covered region", () => {
  const c = build({ asOf: NOW, events: [], eventReadSucceeded: true,
    receipts: [receipt("forex-factory", ["US"])],
  });
  assert.equal(source(c, "forex-factory", "US"), "QUALIFIED_EMPTY");
  assert.equal(source(c, "forex-factory", "CHINA"), "UNKNOWN");
  assert.equal(source(c, "forex-factory", "JAPAN"), "UNKNOWN");
  assert.equal(c.regions[0].status, "UNKNOWN", "other feeds are not certified empty");
});

test("G1-05: observed schedules show KNOWN_EVENTS, never establish full-week completeness", () => {
  const c = build({ asOf: NOW, eventReadSucceeded: true, events: [
    event(), event({ id: "cn", jurisdiction: "CHINA", sourceId: "biquote",
      scheduledAt: "2026-10-18T02:00:00.000Z" }),
    event({ id: "jp", jurisdiction: "JAPAN", sourceId: "biquote",
      retrievedAt: "2026-10-13T00:00:00.000Z" }),
    event({ id: "too-late", jurisdiction: "US", scheduledAt: "2026-10-19T04:00:01.000Z" }),
    event({ id: "legacy", jurisdiction: undefined }),
  ] });
  assert.deepEqual(c.regions.map((r) => [r.status, r.observedEvents]), [
    ["KNOWN_EVENTS", 1], ["KNOWN_EVENTS", 1], ["UNKNOWN", 0],
  ]);
  assert.equal(c.feeds[0].lastListedAt, "2026-10-14T12:30:00.000Z");
});

test("G1-05: stale, future, mismatched or read-error receipts cannot certify EMPTY", () => {
  for (const change of [
    { retrievedAt: "2026-10-13T00:00:00.000Z" },
    { windowStart: "2026-10-12T04:00:01.000Z" },
    { wasTruncated: true as false },
    { responseCompleteness: "UNVERIFIED" as "PROVIDER_CONFIRMED_FULL_WINDOW" },
  ]) {
    const c = build({ asOf: NOW, events: [], eventReadSucceeded: true,
      receipts: [{ ...receipt("forex-factory"), ...change }],
    });
    assert.equal(source(c, "forex-factory", "US"), "UNKNOWN");
  }
  const errored = build({ asOf: NOW, events: [event()], eventReadSucceeded: false,
    receipts: [receipt("forex-factory")],
  });
  assert.deepEqual(errored.regions.map((r) => r.status), ["READ_ERROR", "READ_ERROR", "READ_ERROR"]);
  assert.equal(source(errored, "forex-factory", "US"), "READ_ERROR");
});

test("G1-05: capped durable read cannot certify EMPTY even with nominal receipts", () => {
  const c = build({ asOf: NOW, events: [], eventReadSucceeded: true,
    eventHistoryTruncated: true, receipts: [receipt("forex-factory")],
  });
  assert.equal(source(c, "forex-factory", "US"), "UNKNOWN");
});
