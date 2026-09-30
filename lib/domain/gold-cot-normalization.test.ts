import assert from "node:assert/strict";
import test from "node:test";
import {
  CFTC_GOLD_CONTRACT_MARKET_CODE,
  CFTC_GOLD_COT_DATASET_ID,
  CFTC_GOLD_COT_PROVIDER_RESOURCE,
  CFTC_GOLD_COT_REPORT_FAMILY,
  type CftcGoldCotObservationInput,
} from "../data/cftc-gold-cot";
import { marketMemoryDedupeKey } from "../data/market-memory-record";
import { cftcGoldCotToCanonicalRecords } from "./normalize";
import { CFTC_GOLD_COT_SERIES_KEYS, requireObservationSemantics } from "./observation-semantics";

function input(value: number, retrievedAt: string): CftcGoldCotObservationInput {
  const reportDate = "2026-09-29";
  return {
    metricId: CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong,
    value,
    observedAt: `${reportDate}T00:00:00.000Z`,
    retrievedAt,
    reportDate,
    datasetId: CFTC_GOLD_COT_DATASET_ID,
    contractMarketCode: CFTC_GOLD_CONTRACT_MARKET_CODE,
    marketName: "GOLD - COMMODITY EXCHANGE INC.",
    reportFamily: CFTC_GOLD_COT_REPORT_FAMILY,
    providerResource: CFTC_GOLD_COT_PROVIDER_RESOURCE,
    providerField: "m_money_positions_long_all",
    participantCategory: "MANAGED_MONEY",
    positionSide: "LONG",
    unit: "CONTRACTS",
    frequency: "WEEKLY",
    provenance: {
      version: "v1",
      providerResource: CFTC_GOLD_COT_PROVIDER_RESOURCE,
      nativeSeriesId: "m_money_positions_long_all",
      nativeInstrumentId: CFTC_GOLD_CONTRACT_MARKET_CODE,
      observationDate: reportDate,
    },
    metadata: {
      metricId: CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong,
      provider: "CFTC",
      providerResource: CFTC_GOLD_COT_PROVIDER_RESOURCE,
      datasetId: CFTC_GOLD_COT_DATASET_ID,
      contractMarketCode: CFTC_GOLD_CONTRACT_MARKET_CODE,
      marketName: "GOLD - COMMODITY EXCHANGE INC.",
      reportFamily: CFTC_GOLD_COT_REPORT_FAMILY,
      reportDate,
      providerField: "m_money_positions_long_all",
      participantCategory: "MANAGED_MONEY",
      positionSide: "LONG",
      unit: "CONTRACTS",
      frequency: "WEEKLY",
    },
  };
}

test("normalizes exact CFTC Gold positioning semantics and provenance without fabricating release time", () => {
  const canonical = cftcGoldCotToCanonicalRecords([input(210000, "2026-10-02T19:31:00.000Z")]);
  const observation = canonical.observations[0];
  const evidence = canonical.evidence[0];
  assert.ok(observation && evidence);
  assert.equal(observation.domain, "MARKET");
  assert.equal(observation.sourceId, "cftc-gold-cot");
  assert.equal(observation.value, "210000");
  assert.equal(observation.observedAt, "2026-09-29T00:00:00.000Z");
  assert.equal(observation.retrievedAt, "2026-10-02T19:31:00.000Z");
  assert.equal(observation.quality, "UNKNOWN");
  assert.deepEqual(observation.semantics, {
    ontologyVersion: "v0.1",
    marketDomain: "COMMODITY",
    informationClass: "POSITIONING",
    jurisdiction: "US",
    instrument: "FUTURE",
    asset: "GOLD",
    participant: "MANAGED_MONEY",
  });
  assert.deepEqual(observation.provenance, {
    version: "v1",
    providerResource: "/resource/72hh-3qpy.json",
    nativeSeriesId: "m_money_positions_long_all",
    nativeInstrumentId: "088691",
    observationDate: "2026-09-29",
  });
  assert.equal(observation.metadata?.reportFamily, "DISAGGREGATED_FUTURES_ONLY");
  assert.equal(observation.metadata?.providerField, "m_money_positions_long_all");
  assert.equal(observation.metadata?.frequency, "WEEKLY");
  assert.equal(observation.metadata?.observationEffectiveAt, observation.observedAt);
  assert.equal(evidence.metadata?.observationEffectiveAt, observation.observedAt);
  assert.deepEqual(requireObservationSemantics(CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong), observation.semantics);

  const serialized = JSON.stringify(canonical);
  for (const forbidden of ["releasedAt", "publishedAt", "netPosition", "percentile", "zScore", "retail"]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must not be fabricated`);
  }
});

test("retains FND-018A factual idempotency and stable Evidence dedupe across refetches", () => {
  const original = cftcGoldCotToCanonicalRecords([input(210000, "2026-10-02T19:31:00.000Z")]);
  const refetch = cftcGoldCotToCanonicalRecords([input(210000, "2026-10-09T19:31:00.000Z")]);
  const correction = cftcGoldCotToCanonicalRecords([input(211000, "2026-10-09T19:31:00.000Z")]);

  const a = original.observations[0];
  const b = refetch.observations[0];
  const corrected = correction.observations[0];
  assert.ok(a && b && corrected);

  assert.equal(b.identity?.measurementId, a.identity?.measurementId);
  assert.equal(b.identity?.revisionFingerprint, a.identity?.revisionFingerprint);
  assert.equal(b.id, a.id);
  assert.equal(marketMemoryDedupeKey("OBSERVATION", b), marketMemoryDedupeKey("OBSERVATION", a));
  assert.equal(
    marketMemoryDedupeKey("EVIDENCE", refetch.evidence[0]),
    marketMemoryDedupeKey("EVIDENCE", original.evidence[0]),
    "retrieval time cannot create duplicate Observation Evidence",
  );

  assert.equal(corrected.identity?.measurementId, a.identity?.measurementId);
  assert.notEqual(corrected.identity?.revisionFingerprint, a.identity?.revisionFingerprint);
  assert.notEqual(corrected.id, a.id);
});

test("fails canonical normalization when CFTC provenance diverges from metadata", () => {
  const malformed = input(210000, "2026-10-02T19:31:00.000Z");
  malformed.metadata.providerField = "wrong_field";
  assert.throws(
    () => cftcGoldCotToCanonicalRecords([malformed]),
    /CFTC Gold COT Observation provenance is inconsistent/,
  );
});
