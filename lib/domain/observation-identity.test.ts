import assert from "node:assert/strict";
import { buildRepositoryBackedMacroFactualBaselines } from "../application/factual-baseline";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { MacroObservationInput } from "../data/fred";
import { MACRO_SERIES_REGISTRY, type MacroSeriesDefinition } from "../data/macro-registry";
import { marketMemoryDedupeKey } from "../data/market-memory-record";
import { InMemoryObservationRepository } from "../repositories/memory";
import { cryptoMarketToObservations, macroToCanonicalRecords } from "./normalize";
import { canonicalObservationValue } from "./observation-identity";
import type { Observation } from "./types";

const cpiDefinition = MACRO_SERIES_REGISTRY.find((series) => series.seriesId === "CPIAUCSL");
if (!cpiDefinition) throw new Error("CPIAUCSL registry definition missing.");
const cpi: MacroSeriesDefinition = cpiDefinition;

function macroInput(value: string, retrievedAt: string): MacroObservationInput {
  return {
    series: cpi,
    value,
    observationDate: "2026-08-01",
    previousValue: "330",
    vintageDate: "2026-09-01",
    releasedAt: null,
    retrievedAt,
  };
}

function marketInput(
  metricId: string,
  symbol: string,
  value: number,
  retrievedAt: string,
): CryptoMarketObservationInput {
  return {
    metricId,
    symbol,
    value,
    observedAt: "2026-09-20T09:00:00.000Z",
    retrievedAt,
    source: metricId === "gold.futures.usd" ? "Yahoo Finance" : "CoinGecko",
    metadata: {
      unit: "USD",
      endpoint: metricId === "gold.futures.usd" ? "v8/finance/chart" : "/simple/price",
    },
  };
}

function normalizeMacro(input: MacroObservationInput): Observation {
  const observation = macroToCanonicalRecords([input], "fred").observations[0];
  assert.ok(observation);
  return observation;
}

function normalizeMarket(input: CryptoMarketObservationInput, sourceId: string): Observation {
  const observation = cryptoMarketToObservations([input], sourceId).observations[0];
  assert.ok(observation);
  return observation;
}

async function main(): Promise<void> {
  assert.equal(canonicalObservationValue("22355.3000000000"), "22355.3");
  assert.equal(canonicalObservationValue("1.2300e3"), "1230");
  assert.equal(canonicalObservationValue("9007199254740993"), "9007199254740993");

  const original = normalizeMacro(macroInput("334.100", "2026-09-01T12:00:00.000Z"));
  const refetch = normalizeMacro(macroInput("334.100", "2026-09-02T12:00:00.000Z"));
  const formattingOnly = normalizeMacro(macroInput("334.1000000000", "2026-09-03T12:00:00.000Z"));
  const correction = normalizeMacro(macroInput("334.2", "2026-09-04T12:00:00.000Z"));

  assert.equal(original.identity?.version, "v1");
  assert.match(original.identity?.revisionFingerprint ?? "", /^[a-f0-9]{64}$/);
  assert.equal(refetch.id, original.id, "retrieval time alone cannot create a factual revision");
  assert.equal(refetch.identity?.revisionFingerprint, original.identity?.revisionFingerprint);
  assert.equal(formattingOnly.id, original.id, "equivalent numeric formatting is identical factual content");
  assert.equal(correction.identity?.measurementId, original.identity?.measurementId);
  assert.notEqual(correction.identity?.revisionFingerprint, original.identity?.revisionFingerprint);
  assert.notEqual(correction.id, original.id, "changed FRED value creates a distinct revision ID");
  assert.notEqual(correction.evidenceId, original.evidenceId, "correction retains revision-specific evidence lineage");
  assert.equal(
    marketMemoryDedupeKey("OBSERVATION", refetch),
    marketMemoryDedupeKey("OBSERVATION", original),
    "identical refetch uses the same durable dedupe key",
  );
  assert.notEqual(
    marketMemoryDedupeKey("OBSERVATION", correction),
    marketMemoryDedupeKey("OBSERVATION", original),
    "correction uses a distinct durable dedupe key",
  );
  assert.equal(
    marketMemoryDedupeKey("OBSERVATION", { ...original, observedAt: "2026-08-01T00:00:00.000Z" }),
    marketMemoryDedupeKey("OBSERVATION", original),
    "equivalent Observation timestamp serialization cannot defeat dedupe",
  );

  const btcOriginal = normalizeMarket(
    marketInput("btc.spot.usd", "BTC", 65000, "2026-09-20T09:00:01.000Z"),
    "coingecko-market",
  );
  const btcRefetch = normalizeMarket(
    marketInput("btc.spot.usd", "BTC", 65000, "2026-09-20T09:05:01.000Z"),
    "coingecko-market",
  );
  const btcCorrection = normalizeMarket(
    marketInput("btc.spot.usd", "BTC", 65001, "2026-09-20T09:06:01.000Z"),
    "coingecko-market",
  );
  assert.equal(btcRefetch.id, btcOriginal.id, "CoinGecko identical refetch dedupes");
  assert.equal(btcCorrection.identity?.measurementId, btcOriginal.identity?.measurementId);
  assert.notEqual(btcCorrection.id, btcOriginal.id, "CoinGecko correction cannot share the original ID");

  const goldOriginal = normalizeMarket(
    marketInput("gold.futures.usd", "GC=F", 3700, "2026-09-20T09:00:01.000Z"),
    "yahoo-finance",
  );
  const goldRefetch = normalizeMarket(
    marketInput("gold.futures.usd", "GC=F", 3700, "2026-09-20T09:05:01.000Z"),
    "yahoo-finance",
  );
  const goldCorrection = normalizeMarket(
    marketInput("gold.futures.usd", "GC=F", 3700.5, "2026-09-20T09:06:01.000Z"),
    "yahoo-finance",
  );
  assert.equal(goldRefetch.id, goldOriginal.id, "Yahoo identical refetch dedupes");
  assert.equal(goldCorrection.identity?.measurementId, goldOriginal.identity?.measurementId);
  assert.notEqual(goldCorrection.id, goldOriginal.id, "Yahoo correction cannot share the original ID");

  const history = new InMemoryObservationRepository();
  await history.saveMany([correction, original, refetch]);
  const revisions = await history.findHistory({
    identity: { domain: "MACRO", seriesKey: "CPIAUCSL" },
    observedAtOnOrAfter: original.observedAt,
    observedAtOnOrBefore: original.observedAt,
    sourceId: "fred",
    order: "ASC",
    limit: 10,
  });
  assert.deepEqual(revisions.map((item) => item.id), [original.id, correction.id]);
  assert.equal(
    (await history.findById(original.id))?.retrievedAt,
    original.retrievedAt,
    "identical refetch cannot overwrite original availability",
  );

  const beforeCorrection = await history.findHistory({
    identity: { domain: "MACRO", seriesKey: "CPIAUCSL" },
    retrievedAtOnOrBefore: "2026-09-03T23:59:59.999Z",
    order: "DESC",
    limit: 10,
  });
  assert.deepEqual(beforeCorrection.map((item) => item.id), [original.id]);
  const afterCorrection = await history.findHistory({
    identity: { domain: "MACRO", seriesKey: "CPIAUCSL" },
    retrievedAtOnOrBefore: "2026-09-05T00:00:00.000Z",
    order: "DESC",
    limit: 10,
  });
  assert.deepEqual(afterCorrection.map((item) => item.id), [correction.id, original.id]);

  const legacy: Observation = {
    id: "legacy-cpi-july",
    domain: "MACRO",
    subject: "Legacy CPI",
    value: "333",
    observedAt: "2026-07-01",
    retrievedAt: "2026-08-15T00:00:00.000Z",
    sourceId: "fred",
    quality: "FRESH",
    evidenceId: "legacy-evidence",
    metadata: { seriesId: "CPIAUCSL", observationDate: "2026-07-01", unit: cpi.unit, frequency: cpi.frequency },
  };
  await history.save(legacy);
  assert.deepEqual(
    (await history.findHistory({
      identity: { domain: "MACRO", seriesKey: "CPIAUCSL" },
      order: "ASC",
      limit: 10,
    })).map((item) => item.id),
    [legacy.id, original.id, correction.id],
    "legacy and versioned Observation rows remain queryable together",
  );

  const reverseHistory = new InMemoryObservationRepository();
  await reverseHistory.saveMany([original, correction, legacy]);
  const query = {
    identity: { domain: "MACRO" as const, seriesKey: "CPIAUCSL" },
    order: "DESC" as const,
    limit: 10,
  };
  assert.deepEqual(
    (await reverseHistory.findHistory(query)).map((item) => item.id),
    (await history.findHistory(query)).map((item) => item.id),
    "storage ordering cannot change deterministic revision ordering",
  );

  const sameMeasurementHistory = new InMemoryObservationRepository();
  await sameMeasurementHistory.saveMany([original, correction]);
  const sameMeasurementBaseline = await buildRepositoryBackedMacroFactualBaselines(
    [normalizeMacro(macroInput("334.3", "2026-09-05T00:00:00.000Z"))],
    sameMeasurementHistory,
  );
  assert.equal(sameMeasurementBaseline.CPIAUCSL.status, "MISSING");
  assert.equal(sameMeasurementBaseline.CPIAUCSL.baselineObservationId, null);
}

void main();
