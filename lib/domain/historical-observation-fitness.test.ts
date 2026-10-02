import assert from "node:assert/strict";
import test from "node:test";
import {
  CFTC_GOLD_COT_SERIES_KEYS,
  requireObservationSemantics,
} from "./observation-semantics";
import {
  HISTORICAL_FITNESS_POLICY_CANONICAL_V1,
  HISTORICAL_FITNESS_POLICY_CFTC_GOLD_COT_V1,
  historicalObservationFitnessEligible,
  isSourceQualifiedCftcGoldCotObservation,
} from "./historical-observation-fitness";
import type { DataQuality, Observation } from "./types";

function cftcObservation(
  quality: DataQuality = "UNKNOWN",
): Observation {
  const seriesKey = CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong;
  return {
    id: "obs-cftc-mm-long",
    domain: "MARKET",
    subject: seriesKey,
    value: "210000",
    observedAt: "2026-09-22T00:00:00.000Z",
    retrievedAt: "2026-09-25T19:40:00.000Z",
    sourceId: "cftc-gold-cot",
    quality,
    evidenceId: "e-cftc-mm-long",
    identity: {
      version: "v1",
      seriesKey,
      measurementId: "m-cftc-mm-long",
      revisionFingerprint: "r-cftc-mm-long",
    },
    provenance: {
      version: "v1",
      providerResource: "/resource/72hh-3qpy.json",
      nativeSeriesId: "m_money_positions_long_all",
      nativeInstrumentId: "088691",
      observationDate: "2026-09-22",
    },
    semantics: requireObservationSemantics(seriesKey),
    metadata: {
      metricId: seriesKey,
      provider: "CFTC",
      providerResource: "/resource/72hh-3qpy.json",
      datasetId: "72hh-3qpy",
      contractMarketCode: "088691",
      marketName: "GOLD - COMMODITY EXCHANGE INC.",
      reportFamily: "DISAGGREGATED_FUTURES_ONLY",
      reportDate: "2026-09-22",
      providerField: "m_money_positions_long_all",
      participantCategory: "MANAGED_MONEY",
      positionSide: "LONG",
      unit: "CONTRACTS",
      frequency: "WEEKLY",
    },
  };
}

test("default historical fitness still rejects UNKNOWN CFTC facts", () => {
  const observation = cftcObservation();
  assert.equal(
    historicalObservationFitnessEligible(
      observation,
      HISTORICAL_FITNESS_POLICY_CANONICAL_V1,
    ),
    false,
  );
});

test("CFTC source-qualified policy accepts exact immutable UNKNOWN rows", () => {
  const observation = cftcObservation();
  assert.equal(isSourceQualifiedCftcGoldCotObservation(observation), true);
  assert.equal(
    historicalObservationFitnessEligible(
      observation,
      HISTORICAL_FITNESS_POLICY_CFTC_GOLD_COT_V1,
    ),
    true,
  );
  assert.equal(observation.quality, "UNKNOWN");
});

test("CFTC source-qualified policy rejects provenance drift", () => {
  const observation = cftcObservation();
  if (!observation.provenance) throw new Error("test fixture missing provenance");
  observation.provenance.nativeInstrumentId = "WRONG";

  assert.equal(isSourceQualifiedCftcGoldCotObservation(observation), false);
  assert.equal(
    historicalObservationFitnessEligible(
      observation,
      HISTORICAL_FITNESS_POLICY_CFTC_GOLD_COT_V1,
    ),
    false,
  );
});

test("PARTIAL remains ineligible even under CFTC source qualification", () => {
  assert.equal(
    historicalObservationFitnessEligible(
      cftcObservation("PARTIAL"),
      HISTORICAL_FITNESS_POLICY_CFTC_GOLD_COT_V1,
    ),
    false,
  );
});
