import assert from "node:assert/strict";
import test from "node:test";
import type { SoSoValueBtcEtfFlowObservationInput } from "../data/sosovalue-etf-flow";
import {
  SOSOVALUE_ETF_FLOW_COMPLETION_BASIS,
  SOSOVALUE_ETF_FLOW_MATURITY_POLICY,
  SOSOVALUE_ETF_FLOW_MATURITY_STATUS,
  SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
} from "../data/sosovalue-etf-flow";
import { marketMemoryDedupeKey } from "../data/market-memory-record";
import { btcEtfFlowToCanonicalRecords } from "./normalize";
import { BTC_ETF_NET_FLOW_SERIES_KEY, requireObservationSemantics } from "./observation-semantics";

function input(value: number, retrievedAt: string): SoSoValueBtcEtfFlowObservationInput {
  const providerTradingDate = "2026-09-29";
  return {
    metricId: BTC_ETF_NET_FLOW_SERIES_KEY,
    value,
    observedAt: `${providerTradingDate}T00:00:00.000Z`,
    retrievedAt,
    providerTradingDate,
    providerResource: SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
    providerSymbol: "BTC",
    countryCode: "US",
    aggregateField: "total_net_inflow",
    unit: "USD",
    maturityPolicy: SOSOVALUE_ETF_FLOW_MATURITY_POLICY,
    completionBasis: SOSOVALUE_ETF_FLOW_COMPLETION_BASIS,
    maturityStatus: SOSOVALUE_ETF_FLOW_MATURITY_STATUS,
    provenance: {
      version: "v1",
      providerResource: SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
      nativeSymbol: "BTC",
      observationDate: providerTradingDate,
    },
    metadata: {
      metricId: BTC_ETF_NET_FLOW_SERIES_KEY,
      provider: "SoSoValue",
      providerResource: SOSOVALUE_ETF_FLOW_PROVIDER_RESOURCE,
      providerTradingDate,
      providerSymbol: "BTC",
      countryCode: "US",
      aggregateField: "total_net_inflow",
      unit: "USD",
      maturityPolicy: SOSOVALUE_ETF_FLOW_MATURITY_POLICY,
      completionBasis: SOSOVALUE_ETF_FLOW_COMPLETION_BASIS,
      maturityStatus: SOSOVALUE_ETF_FLOW_MATURITY_STATUS,
      frequency: "DAILY",
    },
  };
}

test("normalizes exact BTC ETF flow semantics, provenance, and unknown freshness", () => {
  const canonical = btcEtfFlowToCanonicalRecords([input(100_000_000, "2026-09-30T12:00:00.000Z")]);
  const observation = canonical.observations[0];
  assert.ok(observation);
  assert.equal(canonical.evidence.length, 1);
  assert.equal(observation.domain, "MARKET");
  assert.equal(observation.sourceId, "sosovalue-etf-flow");
  assert.equal(observation.quality, "UNKNOWN");
  assert.equal(observation.value, "100000000");
  assert.equal(observation.observedAt, "2026-09-29T00:00:00.000Z");
  assert.deepEqual(observation.semantics, {
    ontologyVersion: "v0.1",
    marketDomain: "CRYPTO",
    informationClass: "FLOW",
    jurisdiction: "US",
    instrument: "ETF",
    asset: "BTC",
  });
  assert.deepEqual(observation.provenance, {
    version: "v1",
    providerResource: "/etfs/summary-history",
    nativeSymbol: "BTC",
    observationDate: "2026-09-29",
  });
  assert.equal(observation.metadata?.aggregateField, "total_net_inflow");
  assert.equal(observation.metadata?.frequency, "DAILY");
  assert.equal(observation.metadata?.maturityPolicy, SOSOVALUE_ETF_FLOW_MATURITY_POLICY);
  assert.equal(observation.metadata?.completionBasis, SOSOVALUE_ETF_FLOW_COMPLETION_BASIS);
  const serialized = JSON.stringify(canonical);
  for (const forbidden of ["providerFinal", "releasedAt", "publishedAt", "vintage", "constituent"]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must not be fabricated`);
  }
  assert.deepEqual(requireObservationSemantics(BTC_ETF_NET_FLOW_SERIES_KEY), observation.semantics);
});

test("retains FND-018A idempotency and append-only factual correction behavior", () => {
  const original = btcEtfFlowToCanonicalRecords([input(100_000_000, "2026-09-30T12:00:00.000Z")]).observations[0];
  const refetchInput = input(100_000_000, "2026-10-01T12:00:00.000Z");
  refetchInput.metadata.compatibilityNote = "maturity metadata may evolve without factual identity";
  const refetch = btcEtfFlowToCanonicalRecords([refetchInput]).observations[0];
  const correction = btcEtfFlowToCanonicalRecords([input(105_000_000, "2026-10-02T12:00:00.000Z")]).observations[0];
  assert.ok(original && refetch && correction);

  assert.equal(refetch.identity?.measurementId, original.identity?.measurementId);
  assert.equal(refetch.identity?.revisionFingerprint, original.identity?.revisionFingerprint);
  assert.equal(refetch.id, original.id, "retrievedAt/metadata-only changes do not create revisions");
  assert.equal(marketMemoryDedupeKey("OBSERVATION", refetch), marketMemoryDedupeKey("OBSERVATION", original));

  assert.equal(correction.identity?.measurementId, original.identity?.measurementId);
  assert.notEqual(correction.identity?.revisionFingerprint, original.identity?.revisionFingerprint);
  assert.notEqual(correction.id, original.id, "changed factual value creates an append-only revision");
  assert.notEqual(marketMemoryDedupeKey("OBSERVATION", correction), marketMemoryDedupeKey("OBSERVATION", original));
});
