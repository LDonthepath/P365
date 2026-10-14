import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Event, Observation } from "../domain/types";
import { readDurableDashboardData, type DurableDashboardRepositories } from "./durable-dashboard-read";

const asOf = new Date("2026-10-14T08:00:00.000Z");
const fred: Observation = {
  id: "fred-effr", domain: "MACRO", subject: "EFFR", sourceId: "fred",
  value: "4.0", observedAt: "2026-10-13T00:00:00.000Z",
  retrievedAt: "2026-10-13T17:00:00.000Z",
  evidenceId: "ev", quality: "FRESH", metadata: { seriesId: "EFFR" },
};
const calendarEvent: Event = {
  id: "calendar-cpi", sourceId: "forex-factory", subject: "CPI",
  description: "US CPI", scheduledAt: "2026-10-14T12:30:00.000Z",
  retrievedAt: "2026-10-13T09:00:00.000Z", importance: "HIGH",
  status: "UPCOMING", evidenceId: "ev-calendar", jurisdiction: "US",
};

test("MACRO-CUT-002: dashboard macro projection never queries asset series or news and rejects Biquote events", async () => {
  const reads: string[] = [];
  const repositories: DurableDashboardRepositories = {
    observations: { async findHistory(query) {
      reads.push("obs:" + query.sourceId + ":" + query.identity.seriesKey);
      return query.identity.seriesKey === "EFFR" ? [fred] : [];
    } },
    evidence: { async findHistory(query) { reads.push("evidence:" + query.sourceId); return []; } },
    events: { async findHistory() {
      reads.push("events");
      return [calendarEvent, {...calendarEvent, id: "crypto", sourceId: "biquote", subject:"BTC event"},
        {...calendarEvent, id:"fomc", sourceId:"federal-reserve", subject:"FOMC"}];
    } },
  };
  const result = await readDurableDashboardData(asOf, repositories, undefined, {macroOnly:true});
  assert.ok(result.macroObservations.some((row) => row.metadata?.seriesId === "EFFR"));
  assert.ok(reads.filter((row) => row.startsWith("obs:")).every((row) => row.startsWith("obs:fred:")));
  assert.ok(!reads.some((row) => row.startsWith("evidence:")));
  assert.ok(result.events.every((row) => ["forex-factory", "federal-reserve"].includes(row.sourceId)));
  assert.deepEqual(result.calendarForwardCoverage?.feeds.map((row) => row.sourceId),
    ["forex-factory", "federal-reserve"]);
  assert.equal(result.cryptoNews.length, 0);
  assert.ok(result.observations.every((row) => row.sourceId === "fred"));
  assert.ok(result.providerHealth.every((row) =>
    ["fred", "forex-factory", "federal-reserve"].includes(row.sourceId)));
  assert.ok(!result.unavailableSources.some((row) => /coingecko|biquote|yahoo|crypto|gold/i.test(row)));
});

test("MACRO-CUT-002: active dashboard query never imports snapshot/event repricing/asset readers", () => {
  const query = readFileSync(new URL("./dashboard-query.ts",import.meta.url), "utf8");
  assert.match(query, /macroOnly: true/);
  assert.doesNotMatch(query, /intraday-event-monitor|event-window-snapshot|market-snapshot|snapshot-supersession|briefing-event-repricing|mvp-factual-context|material-move-monitor|btc-etf-flow|stablecoin-liquidity|gold-positioning|readDxyMacroHistory/);
  const route = readFileSync(new URL("../../app/dashboard/page.tsx",import.meta.url), "utf8");
  assert.match(route, /sessionEmail="audit@preview.local"/);
  assert.doesNotMatch(route, /verifySession/);
});
