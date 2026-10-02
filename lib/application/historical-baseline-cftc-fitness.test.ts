import assert from "node:assert/strict";
import test from "node:test";
import {
  HISTORICAL_FITNESS_POLICY_CFTC_GOLD_COT_V1,
} from "../domain/historical-observation-fitness";
import {
  CFTC_GOLD_COT_SERIES_KEYS,
  requireObservationSemantics,
} from "../domain/observation-semantics";
import type { Observation } from "../domain/types";
import type {
  HistoricalObservationRepository,
  ObservationHistoryQuery,
} from "../repositories/types";
import { measureRepositoryBackedHistoricalBaseline } from "./historical-baseline";

const SERIES_KEY = CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong;

function cftcObservation(input: {
  id: string;
  reportDate: string;
  value: number;
  retrievedAt: string;
}): Observation {
  return {
    id: input.id,
    domain: "MARKET",
    subject: SERIES_KEY,
    value: String(input.value),
    observedAt: input.reportDate + "T00:00:00.000Z",
    retrievedAt: input.retrievedAt,
    sourceId: "cftc-gold-cot",
    quality: "UNKNOWN",
    evidenceId: "e-" + input.id,
    identity: {
      version: "v1",
      seriesKey: SERIES_KEY,
      measurementId: "m-" + input.id,
      revisionFingerprint: "r-" + input.id,
    },
    provenance: {
      version: "v1",
      providerResource: "/resource/72hh-3qpy.json",
      nativeSeriesId: "m_money_positions_long_all",
      nativeInstrumentId: "088691",
      observationDate: input.reportDate,
    },
    semantics: requireObservationSemantics(SERIES_KEY),
    metadata: {
      metricId: SERIES_KEY,
      provider: "CFTC",
      providerResource: "/resource/72hh-3qpy.json",
      datasetId: "72hh-3qpy",
      contractMarketCode: "088691",
      marketName: "GOLD - COMMODITY EXCHANGE INC.",
      reportFamily: "DISAGGREGATED_FUTURES_ONLY",
      reportDate: input.reportDate,
      providerField: "m_money_positions_long_all",
      participantCategory: "MANAGED_MONEY",
      positionSide: "LONG",
      unit: "CONTRACTS",
      frequency: "WEEKLY",
    },
  };
}

class MemoryHistory implements HistoricalObservationRepository {
  constructor(private readonly rows: Observation[]) {}

  async findHistory(query: ObservationHistoryQuery): Promise<Observation[]> {
    return this.rows
      .filter((observation) =>
        observation.domain === query.identity.domain
        && observation.identity?.seriesKey === query.identity.seriesKey
        && (!query.sourceId || observation.sourceId === query.sourceId)
        && (!query.observedAtOnOrAfter
          || observation.observedAt >= query.observedAtOnOrAfter)
        && (!query.observedAtOnOrBefore
          || observation.observedAt <= query.observedAtOnOrBefore)
        && (!query.retrievedAtOnOrBefore
          || observation.retrievedAt <= query.retrievedAtOnOrBefore))
      .sort((a, b) =>
        a.observedAt.localeCompare(b.observedAt)
        || a.retrievedAt.localeCompare(b.retrievedAt)
        || a.id.localeCompare(b.id))
      .slice(0, query.limit);
  }
}

const methodology = {
  methodologyId: "gold-cot-managed-money-long-level-context-test",
  methodologyVersion: "v1",
  identity: { domain: "MARKET" as const, seriesKey: SERIES_KEY },
  sourceId: "cftc-gold-cot",
  transformation: "LEVEL" as const,
  observedAtOnOrAfter: "2026-09-01T00:00:00.000Z",
  observedAtOnOrBefore: "2026-09-15T00:00:00.000Z",
  asOf: "2026-09-25T20:00:00.000Z",
  minimumSampleSize: 2,
  historicalFitnessPolicy:
    HISTORICAL_FITNESS_POLICY_CFTC_GOLD_COT_V1,
};

test("GOLD-POS-001F allows exact source-qualified UNKNOWN CFTC rows into HIST without rewriting stored quality", async () => {
  const h1 = cftcObservation({
    id: "h1",
    reportDate: "2026-09-08",
    value: 190000,
    retrievedAt: "2026-09-11T19:40:00.000Z",
  });
  const h2 = cftcObservation({
    id: "h2",
    reportDate: "2026-09-15",
    value: 200000,
    retrievedAt: "2026-09-18T19:40:00.000Z",
  });
  const target = cftcObservation({
    id: "target",
    reportDate: "2026-09-22",
    value: 210000,
    retrievedAt: "2026-09-25T19:40:00.000Z",
  });

  const result = await measureRepositoryBackedHistoricalBaseline({
    methodology,
    repository: new MemoryHistory([h1, h2]),
    targetEnd: target,
  });

  assert.equal(result.status, "VALID");
  assert.equal(result.sampleSize, 2);
  assert.equal(result.targetValue, 210000);
  assert.equal(result.percentileRank, 100);
  assert.deepEqual(
    result.samples.map((sample) => sample.endObservationId),
    ["h1", "h2"],
  );
  assert.deepEqual(result.targetObservationQualities, ["UNKNOWN"]);
  assert.equal(target.quality, "UNKNOWN");
  assert.equal(h1.quality, "UNKNOWN");
  assert.equal(h2.quality, "UNKNOWN");
});

test("GOLD-POS-001F excludes UNKNOWN CFTC history when exact provenance drifts", async () => {
  const valid = cftcObservation({
    id: "valid",
    reportDate: "2026-09-08",
    value: 190000,
    retrievedAt: "2026-09-11T19:40:00.000Z",
  });
  const invalid = cftcObservation({
    id: "invalid",
    reportDate: "2026-09-15",
    value: 200000,
    retrievedAt: "2026-09-18T19:40:00.000Z",
  });
  if (!invalid.provenance) throw new Error("test fixture missing provenance");
  invalid.provenance.nativeInstrumentId = "WRONG";

  const target = cftcObservation({
    id: "target",
    reportDate: "2026-09-22",
    value: 210000,
    retrievedAt: "2026-09-25T19:40:00.000Z",
  });

  const result = await measureRepositoryBackedHistoricalBaseline({
    methodology,
    repository: new MemoryHistory([valid, invalid]),
    targetEnd: target,
  });

  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.sampleSize, 1);
  assert.deepEqual(
    result.samples.map((sample) => sample.endObservationId),
    ["valid"],
  );
});

test("GOLD-POS-001F rejects a CFTC fitness policy attached to a non-CFTC methodology", async () => {
  const target = cftcObservation({
    id: "target",
    reportDate: "2026-09-22",
    value: 210000,
    retrievedAt: "2026-09-25T19:40:00.000Z",
  });

  await assert.rejects(
    measureRepositoryBackedHistoricalBaseline({
      methodology: {
        ...methodology,
        identity: {
          domain: "MARKET" as const,
          seriesKey: "btc.spot.usd",
        },
      },
      repository: new MemoryHistory([]),
      targetEnd: target,
    }),
    /CFTC Gold COT historical fitness requires/,
  );
});
