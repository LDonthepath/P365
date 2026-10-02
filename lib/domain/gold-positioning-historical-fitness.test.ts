import assert from "node:assert/strict";
import test from "node:test";
import {
  CFTC_GOLD_COT_SERIES_KEYS,
  requireObservationSemantics,
} from "./observation-semantics";
import {
  OBSERVATION_PROVIDER_RESOURCES,
} from "./observation-provenance";
import type { DataQuality, Observation } from "./types";
import {
  qualifyGoldCftcHistoricalLeg,
  qualifyGoldManagedMoneyHistoricalPair,
} from "./gold-positioning-historical-fitness";

function leg(input: {
  side: "LONG" | "SHORT";
  value?: number;
  reportDate?: string;
  retrievedAt?: string;
  quality?: DataQuality;
}): Observation {
  const seriesKey = input.side === "LONG"
    ? CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong
    : CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort;
  const providerField = input.side === "LONG"
    ? "m_money_positions_long_all"
    : "m_money_positions_short_all";
  const reportDate = input.reportDate ?? "2026-09-22";
  const observedAt = reportDate + "T00:00:00.000Z";

  return {
    id: "obs-" + input.side.toLowerCase() + "-" + reportDate,
    domain: "MARKET",
    subject: seriesKey,
    value: String(input.value ?? (input.side === "LONG" ? 210000 : 35000)),
    observedAt,
    retrievedAt: input.retrievedAt ?? "2026-09-25T22:48:00.000Z",
    sourceId: "cftc-gold-cot",
    quality: input.quality ?? "UNKNOWN",
    evidenceId: "evidence-" + input.side.toLowerCase(),
    identity: {
      version: "v1",
      seriesKey,
      measurementId: "measurement-" + input.side.toLowerCase(),
      revisionFingerprint: "revision-" + input.side.toLowerCase(),
    },
    provenance: {
      version: "v1",
      providerResource:
        OBSERVATION_PROVIDER_RESOURCES.cftcDisaggregatedFuturesOnly,
      nativeSeriesId: providerField,
      nativeInstrumentId: "088691",
      observationDate: reportDate,
    },
    semantics: requireObservationSemantics(seriesKey),
    metadata: {
      metricId: seriesKey,
      provider: "CFTC",
      providerResource:
        OBSERVATION_PROVIDER_RESOURCES.cftcDisaggregatedFuturesOnly,
      datasetId: "72hh-3qpy",
      contractMarketCode: "088691",
      marketName: "GOLD - COMMODITY EXCHANGE INC.",
      reportFamily: "DISAGGREGATED_FUTURES_ONLY",
      reportDate,
      providerField,
      participantCategory: "MANAGED_MONEY",
      positionSide: input.side,
      unit: "CONTRACTS",
      frequency: "WEEKLY",
      observationEffectiveAt: observedAt,
    },
  };
}

test("GOLD-POS-001F source-qualifies UNKNOWN CFTC long/short without rewriting stored quality", () => {
  const long = leg({ side: "LONG" });
  const short = leg({ side: "SHORT" });

  const result = qualifyGoldManagedMoneyHistoricalPair({
    long,
    short,
    asOf: "2026-09-26T00:00:00.000Z",
  });

  assert.equal(result.status, "ELIGIBLE");
  if (result.status !== "ELIGIBLE") return;

  assert.equal(result.basis, "CFTC_SOURCE_QUALIFICATION");
  assert.equal(result.net.value, 175000);
  assert.equal(result.net.knownAt, "2026-09-25T22:48:00.000Z");
  assert.equal(result.long.observation.quality, "UNKNOWN");
  assert.equal(result.short.observation.quality, "UNKNOWN");
  assert.equal(long.quality, "UNKNOWN");
  assert.equal(short.quality, "UNKNOWN");
});

test("GOLD-POS-001F accepts FRESH/STALE only after the same exact CFTC invariants pass", () => {
  const result = qualifyGoldManagedMoneyHistoricalPair({
    long: leg({ side: "LONG", quality: "FRESH" }),
    short: leg({ side: "SHORT", quality: "STALE" }),
    asOf: "2026-09-26T00:00:00.000Z",
  });

  assert.equal(result.status, "ELIGIBLE");
  if (result.status !== "ELIGIBLE") return;
  assert.equal(result.basis, "CANONICAL_QUALITY");
});

test("GOLD-POS-001F always rejects PARTIAL CFTC inputs", () => {
  const result = qualifyGoldCftcHistoricalLeg({
    observation: leg({ side: "LONG", quality: "PARTIAL" }),
    asOf: "2026-09-26T00:00:00.000Z",
  });

  assert.equal(result.status, "INELIGIBLE");
  if (result.status !== "INELIGIBLE") return;
  assert.match(result.reason, /PARTIAL/);
});

test("GOLD-POS-001F rejects look-ahead retrievals", () => {
  const result = qualifyGoldCftcHistoricalLeg({
    observation: leg({
      side: "LONG",
      retrievedAt: "2026-09-27T00:00:00.000Z",
    }),
    asOf: "2026-09-26T00:00:00.000Z",
  });

  assert.equal(result.status, "INELIGIBLE");
  if (result.status !== "INELIGIBLE") return;
  assert.match(result.reason, /not knowable/);
});

test("GOLD-POS-001F rejects wrong CFTC contract/source lineage even when quality is UNKNOWN", () => {
  const observation = leg({ side: "LONG" });
  if (!observation.metadata) throw new Error("test fixture metadata missing");
  observation.metadata.contractMarketCode = "088695";

  const result = qualifyGoldCftcHistoricalLeg({
    observation,
    asOf: "2026-09-26T00:00:00.000Z",
  });

  assert.equal(result.status, "INELIGIBLE");
  if (result.status !== "INELIGIBLE") return;
  assert.match(result.reason, /source\/provenance\/semantic/);
});

test("GOLD-POS-001F rejects mixed report dates", () => {
  const result = qualifyGoldManagedMoneyHistoricalPair({
    long: leg({ side: "LONG", reportDate: "2026-09-22" }),
    short: leg({ side: "SHORT", reportDate: "2026-09-15" }),
    asOf: "2026-09-26T00:00:00.000Z",
  });

  assert.equal(result.status, "INELIGIBLE");
  if (result.status !== "INELIGIBLE") return;
  assert.match(result.reason, /share one report date/);
});

test("GOLD-POS-001F does not admit unrelated UNKNOWN observations", () => {
  const observation = leg({ side: "LONG" });
  observation.sourceId = "other-provider";

  const result = qualifyGoldCftcHistoricalLeg({
    observation,
    asOf: "2026-09-26T00:00:00.000Z",
  });

  assert.equal(result.status, "INELIGIBLE");
});
