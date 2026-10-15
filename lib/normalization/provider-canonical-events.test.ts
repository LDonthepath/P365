import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  calendarToCanonicalRecords as calendarEvents,
  fomcToCanonicalRecords as fomcEvents,
  P365_SOURCES as eventSources,
} from "./provider-canonical-events";
import { P365_SOURCES as canonicalSources } from "../domain/normalize";

test("MACRO-CUT-003M: event canonical entrypoints preserve source registry identity", () => {
  assert.equal(typeof calendarEvents, "function");
  assert.equal(typeof fomcEvents, "function");
  assert.strictEqual(eventSources, canonicalSources);
  assert.equal(eventSources.forexFactory.id, "forex-factory");
  assert.equal(eventSources.federalReserve.id, "federal-reserve");
});

test("MACRO-CUT-003H: active event ingestion depends only on event DTO canonical adapter", () => {
  const active = readFileSync(new URL("../application/event-ingestion.ts", import.meta.url), "utf8");
  const adapter = readFileSync(new URL("./provider-canonical-events.ts", import.meta.url), "utf8");
  assert.equal(existsSync(new URL("./provider-canonical.ts", import.meta.url)), false);
  assert.match(active, /from "\.\.\/normalization\/provider-canonical-events"/);
  assert.doesNotMatch(active, /from "\.\.\/normalization\/provider-canonical"/);
  assert.match(active, /normalizeBiquoteEconomicCalendar/);
  assert.match(active, /eventResults\.saveMany/);
  assert.match(adapter, /forexFactoryJurisdiction\(country\)/);
  assert.match(adapter, /buildCalendarRecords\(qualified, sourceId\)/);
  assert.match(adapter, /buildFomcRecords\(/);
  assert.doesNotMatch(adapter, /(?:data\/|from ["']\.\/)(?:crypto-market|defillama|sosovalue|cftc|binance|hyperliquid|yahoo|provider-canonical")/);
  assert.strictEqual(eventSources, canonicalSources);
});
