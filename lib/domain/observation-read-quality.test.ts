import assert from "node:assert/strict";
import test from "node:test";
import { projectObservationReadQuality } from "./observation-read-quality";
import type { Observation } from "./types";

const AS_OF = "2026-10-12T22:05:00.000Z";

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: "obs", domain: "ASSET", subject: "btc.spot.usd",
    value: "65000", observedAt: "2026-10-12T22:00:00.000Z",
    retrievedAt: "2026-10-12T22:01:00.000Z",
    sourceId: "coingecko-market", quality: "FRESH", evidenceId: "ev",
    metadata: { metricId: "btc.spot.usd" }, ...overrides,
  };
}
const btcPolicy = { family: "MARKET_REALTIME", calendar: "CONTINUOUS_24_7" } as const;
const goldPolicy = { family: "MARKET_REALTIME", calendar: "CME_GLOBEX_GOLD" } as const;
const etfPolicy = { family: "MARKET_DAILY" } as const;

function etf(overrides: Partial<Observation> = {}): Observation {
  return observation({
    id: "etf", domain: "MARKET", subject: "crypto.us_spot_btc_etf_net_flow.usd",
    sourceId: "sosovalue-etf-flow", observedAt: "2026-10-08T00:00:00.000Z",
    retrievedAt: "2026-10-09T12:00:00.000Z", value: "12000000",
    metadata: {
      metricId: "crypto.us_spot_btc_etf_net_flow.usd",
      providerTradingDate: "2026-10-08", providerSymbol: "BTC", countryCode: "US",
      aggregateField: "total_net_inflow", unit: "USD", frequency: "DAILY",
      providerResource: "/etfs/summary-history",
      maturityPolicy: "SOSOVALUE_ETF_FLOW_MATURITY_V0_1",
      completionBasis: "P365_PROVIDER_DATE_ADVANCEMENT",
      maturityStatus: "MATURED_ELIGIBLE_UNDER_P365_POLICY",
    },
    provenance: {
      version: "v1", providerResource: "/etfs/summary-history",
      nativeSymbol: "BTC", observationDate: "2026-10-08",
    }, ...overrides,
  });
}

test("G1-06: intraday BTC and Gold session freshness are independent of stored quality", () => {
  const btc = observation();
  const snapshot = structuredClone(btc);
  const current = projectObservationReadQuality({
    observation: btc, seriesKey: "btc.spot.usd", asOf: AS_OF, policy: btcPolicy,
  });
  assert.deepEqual([current.ingestionQuality, current.evaluatedFreshness, current.maturity],
    ["FRESH", "FRESH", "NOT_EVALUATED"]);
  assert.deepEqual([current.currentContextFitness, current.historicalReferenceFitness],
    ["ELIGIBLE", "ELIGIBLE"]);
  const friday = "2026-10-09T20:55:00.000Z"; // Fri 16:55 EDT
  const asOf = "2026-10-11T22:05:00.000Z"; // Sun 18:05 EDT, newly reopened session
  const agedBtc = projectObservationReadQuality({
    observation: observation({ observedAt: friday, retrievedAt: friday }),
    seriesKey: "btc.spot.usd", asOf, policy: btcPolicy,
  });
  const gold = projectObservationReadQuality({
    observation: observation({
      subject: "gold.futures.usd", sourceId: "yahoo-finance",
      observedAt: friday, retrievedAt: friday,
    }),
    seriesKey: "gold.futures.usd", asOf, policy: goldPolicy,
  });
  assert.equal(agedBtc.evaluatedFreshness, "STALE");
  assert.equal(gold.evaluatedFreshness, "FRESH"); // maintenance/weekend do not count as traded minutes
  assert.equal(gold.currentContextFitness, "INELIGIBLE",
    "prior Gold session cannot serve as current context at Sunday reopen");
  assert.equal(gold.historicalReferenceFitness, "ELIGIBLE");
  assert.equal(agedBtc.currentContextFitness, "INELIGIBLE");
  assert.equal(agedBtc.historicalReferenceFitness, "ELIGIBLE");
  assert.deepEqual(btc, snapshot, "projection must not mutate canonical stored Observation");
});

test("G1-06: Gold current-context fitness requires matching CME session across daily break and weekend", () => {
  const mondayClose = "2026-10-12T20:55:00.000Z"; // Mon 16:55 ET
  const mondayReopen = "2026-10-12T22:05:00.000Z"; // Mon 18:05 ET
  const sameSessionAt = "2026-10-12T20:58:00.000Z";
  const lastQuote = observation({
    subject: "gold.futures.usd", sourceId: "yahoo-finance",
    observedAt: mondayClose, retrievedAt: mondayClose,
  });
  const sample = (asOf: string) => projectObservationReadQuality({
    observation: lastQuote, seriesKey: "gold.futures.usd",
    asOf, policy: goldPolicy,
  });
  assert.equal(sample(sameSessionAt).currentContextFitness, "ELIGIBLE");
  assert.equal(sample("2026-10-12T21:30:00.000Z").currentContextFitness, "INELIGIBLE",
    "maintenance break cannot be an open current session");
  const reopened = sample(mondayReopen);
  assert.equal(reopened.evaluatedFreshness, "FRESH",
    "session calendar excludes closed-market minutes");
  assert.equal(reopened.currentContextFitness, "INELIGIBLE",
    "reopening cannot reuse the earlier Gold session as current");
  assert.equal(reopened.historicalReferenceFitness, "ELIGIBLE");
  const sundayClose = projectObservationReadQuality({
    observation: observation({
      subject: "gold.futures.usd", sourceId: "yahoo-finance",
      observedAt: "2026-10-09T20:55:00.000Z",
      retrievedAt: "2026-10-09T20:55:00.000Z",
    }),
    seriesKey: "gold.futures.usd", asOf: "2026-10-10T20:00:00.000Z", policy: goldPolicy,
  });
  assert.equal(sundayClose.currentContextFitness, "INELIGIBLE");
  const bitcoin = projectObservationReadQuality({
    observation: observation({
      observedAt: "2026-10-12T22:00:00.000Z",
      retrievedAt: "2026-10-12T22:01:00.000Z",
    }), seriesKey: "btc.spot.usd", asOf: mondayReopen, policy: btcPolicy,
  });
  assert.equal(bitcoin.currentContextFitness, "ELIGIBLE",
    "Gold session guard cannot modify BTC 24/7 fitness");
});

test("G1-06: daily ETF policy maturity is not provider FINAL; stale predecessor remains historical eligible", () => {
  const item = etf();
  const captured = structuredClone(item);
  const mature = projectObservationReadQuality({
    observation: item, seriesKey: "crypto.us_spot_btc_etf_net_flow.usd",
    asOf: "2026-10-09T13:00:00.000Z", policy: etfPolicy,
  });
  assert.equal(mature.maturity, "MATURED_ELIGIBLE_UNDER_P365_POLICY");
  const qualifiedIdentity = projectObservationReadQuality({
    observation: etf({ identity: {
      version: "v1", seriesKey: "crypto.us_spot_btc_etf_net_flow.usd",
      measurementId: "valid-etf-measurement", revisionFingerprint: "valid-etf-fingerprint",
    } }),
    seriesKey: "crypto.us_spot_btc_etf_net_flow.usd",
    asOf: "2026-10-09T13:00:00.000Z", policy: etfPolicy,
  });
  assert.equal(qualifiedIdentity.maturity, "MATURED_ELIGIBLE_UNDER_P365_POLICY");
  assert.equal(mature.evaluatedFreshness, "FRESH");
  assert.equal(mature.currentContextFitness, "ELIGIBLE");
  const historic = projectObservationReadQuality({
    observation: item, seriesKey: "crypto.us_spot_btc_etf_net_flow.usd",
    asOf: "2026-10-17T13:00:00.000Z", policy: etfPolicy,
  });
  assert.equal(historic.ingestionQuality, "FRESH");
  assert.equal(historic.evaluatedFreshness, "STALE");
  assert.equal(historic.maturity, "MATURED_ELIGIBLE_UNDER_P365_POLICY");
  assert.equal(historic.currentContextFitness, "INELIGIBLE");
  assert.equal(historic.historicalReferenceFitness, "ELIGIBLE");
  assert.deepEqual(item, captured);
});

test("G1-06: ETF provider-policy maturity does not override UNKNOWN canonical ingestion quality", () => {
  const canonicalLike = etf({ quality: "UNKNOWN" });
  const result = projectObservationReadQuality({
    observation: canonicalLike, seriesKey: "crypto.us_spot_btc_etf_net_flow.usd",
    asOf: "2026-10-09T13:00:00.000Z", policy: etfPolicy,
  });
  assert.equal(result.maturity, "MATURED_ELIGIBLE_UNDER_P365_POLICY");
  assert.equal(result.ingestionQuality, "UNKNOWN");
  assert.equal(result.evaluatedFreshness, "FRESH");
  assert.equal(result.currentContextFitness, "INELIGIBLE");
  assert.equal(result.historicalReferenceFitness, "INELIGIBLE");
});

test("G1-06: ETF missing policy, missing provenance and provisional status never become final by age", () => {
  const emptyMetadata = etf({ metadata: { metricId: "crypto.us_spot_btc_etf_net_flow.usd" }, provenance: undefined });
  const policyOnly = etf({ provenance: undefined });
  const wrongBasis = etf({ metadata: { ...etf().metadata, completionBasis: "CLOCK_GUESS" } });
  const provisional = etf({ metadata: { ...etf().metadata, maturityStatus: "PROVISIONAL" } });
  const wrongSourceIdentity = etf({ domain: "ASSET" });
  const wrongSubject = etf({ subject: "btc.spot.usd" });
  const wrongMetricId = etf({ metadata: {
    ...etf().metadata, metricId: "btc.spot.usd",
  } });
  const conflictingSeriesId = etf({ metadata: {
    ...etf().metadata, seriesId: "crypto.usd_stablecoin_market_cap.usd",
  } });
  const conflictingCanonicalIdentity = etf({ identity: {
    version: "v1", seriesKey: "btc.spot.usd",
    measurementId: "other-series", revisionFingerprint: "other-version",
  } });
  const unknownProvenanceVersion = etf({ provenance: {
    ...etf().provenance!, version: "v2" as "v1",
  } });
  for (const item of [
    emptyMetadata, policyOnly, wrongBasis, provisional, wrongSourceIdentity,
    wrongSubject, wrongMetricId, conflictingSeriesId, conflictingCanonicalIdentity,
    unknownProvenanceVersion,
  ]) {
    const p = projectObservationReadQuality({
      observation: item, seriesKey: "crypto.us_spot_btc_etf_net_flow.usd",
      asOf: "2026-10-20T10:00:00.000Z", policy: etfPolicy,
    });
    assert.equal(p.evaluatedFreshness, "STALE");
    assert.equal(p.currentContextFitness, "INELIGIBLE");
    assert.equal(p.historicalReferenceFitness, "INELIGIBLE");
    assert.ok(p.maturity === "UNKNOWN" || p.maturity === "PROVISIONAL_REPORTED");
  }
});

test("G1-06: point-in-time retrieval, quality and unknown policy fail closed", () => {
  const cutoff = "2026-10-12T22:05:00.000Z";
  for (const row of [
    observation({ retrievedAt: "2026-10-13T00:00:00.000Z" }),
    observation({ observedAt: "2026-10-13T00:00:00.000Z" }),
    observation({ observedAt: "not-a-date" }),
  ]) {
    const p = projectObservationReadQuality({
      observation: row, seriesKey: "btc.spot.usd", asOf: cutoff, policy: btcPolicy,
    });
    assert.equal(p.evaluatedFreshness, "UNKNOWN");
    assert.equal(p.currentContextFitness, "INELIGIBLE");
    assert.equal(p.historicalReferenceFitness, "INELIGIBLE");
  }
  const partial = projectObservationReadQuality({
    observation: observation({ quality: "PARTIAL" }),
    seriesKey: "btc.spot.usd", asOf: cutoff, policy: btcPolicy,
  });
  assert.equal(partial.evaluatedFreshness, "FRESH");
  assert.equal(partial.currentContextFitness, "INELIGIBLE");
  assert.equal(partial.historicalReferenceFitness, "INELIGIBLE");
  const legacy = projectObservationReadQuality({
    observation: observation({ identity: undefined, provenance: undefined, metadata: undefined }),
    seriesKey: "btc.spot.usd", asOf: cutoff,
  });
  assert.equal(legacy.ingestionQuality, "FRESH");
  assert.equal(legacy.evaluatedFreshness, "UNKNOWN");
  assert.equal(legacy.historicalReferenceFitness, "ELIGIBLE");
  assert.equal(legacy.currentContextFitness, "INELIGIBLE");
});

test("G1-06: explicit macro monthly cadence uses observation period, not guessed release time", () => {
  const p = projectObservationReadQuality({
    observation: observation({
      id: "macro", domain: "MACRO", sourceId: "fred", subject: "CPI",
      observedAt: "2026-09-01", retrievedAt: "2026-10-10T09:00:00.000Z",
    }), seriesKey: "CPIAUCSL", asOf: "2026-10-11T09:00:00.000Z",
    policy: { family: "FRED_MACRO", frequency: "MONTHLY", toleranceMs: 45 * 86400000 },
  });
  assert.equal(p.evaluatedFreshness, "FRESH");
  assert.equal(p.maturity, "NOT_EVALUATED");
  assert.equal(p.currentContextFitness, "ELIGIBLE");
});
