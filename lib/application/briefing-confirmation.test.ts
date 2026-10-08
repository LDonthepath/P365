import assert from "node:assert/strict";
import test from "node:test";
import {
  BTC_ETF_NET_FLOW_SERIES_KEY,
} from "../domain/observation-semantics";
import type { BtcEtfFlowReadModel } from "./btc-etf-flow";
import {
  buildBriefingConfirmation,
} from "./briefing-confirmation";
import type {
  BriefingEventRepricingResult,
} from "./briefing-event-repricing";

function flowModel(input: {
  value: number;
  retrievedAt: string;
}): BtcEtfFlowReadModel {
  const point = {
    value: input.value,
    observedAt: "2026-10-01T00:00:00.000Z",
    providerTradingDate: "2026-10-01",
    retrievedAt: input.retrievedAt,
    quality: "UNKNOWN" as const,
    observationId: "flow-1",
  };

  return {
    asOf: "2026-10-02T13:00:00.000Z",
    seriesKey: BTC_ETF_NET_FLOW_SERIES_KEY,
    latest: point,
    previous: null,
    recent: [point],
  };
}

function repricing(input: {
  status?: "REPRICING_OBSERVED" | "NO_REPRICING_OBSERVED";
  contaminationStatus?: "CLEAN" | "CONTAMINATED";
  responseStatus?: "REPRICED" | "BELOW_THRESHOLD";
  direction?: "UP" | "DOWN";
} = {}): BriefingEventRepricingResult {
  const status = input.status ?? "REPRICING_OBSERVED";
  const contaminationStatus = input.contaminationStatus ?? "CLEAN";
  const responseStatus = input.responseStatus ?? "REPRICED";
  const direction = input.direction ?? "UP";

  return {
    status: "OK",
    data: [{
      eventIdentityKey: "event:v1:US:2026-10-02T12:30:00.000Z:test",
      eventId: "event-a",
      subject: "Test Economic Release",
      jurisdiction: "US",
      t0: "2026-10-02T12:30:00.000Z",
      windows: [{
        status: "ASSESSED",
        role: "T_PLUS_5",
        capturedAt: "2026-10-02T12:35:00.000Z",
        assessment: {
          id: "event-repricing-v1-test",
          version: "v1",
          policy: "threshold-governed-event-window-repricing-v1",
          windowId: "window-test",
          eventIdentityKey: "event:v1:US:2026-10-02T12:30:00.000Z:test",
          beforeRole: "PRE",
          afterRole: "T_PLUS_5",
          comparisonId: "comparison-test",
          beforeSnapshotId: "snapshot-pre",
          afterSnapshotId: "snapshot-post",
          beforeCapturedAt: "2026-10-02T12:25:00.000Z",
          afterCapturedAt: "2026-10-02T12:35:00.000Z",
          quality: "COMPLETE",
          contaminationStatus,
          contaminants: contaminationStatus === "CONTAMINATED"
            ? [{
                eventIdentityKey: "event:v1:US:other",
                eventId: "event-other",
                subject: "Other release",
                t0: "2026-10-02T12:32:00.000Z",
                t0Source: "SCHEDULED_AT",
              }]
            : [],
          causalAttribution: "NOT_EVALUATED",
          status,
          thresholds: [{
            observationKey: "ASSET:btc.spot.usd:coingecko-market",
            basis: "ABSOLUTE_PERCENT_CHANGE",
            minimumMagnitude: 0.226434,
          }],
          responses: [{
            observationKey: "ASSET:btc.spot.usd:coingecko-market",
            status: responseStatus,
            direction,
            basis: "ABSOLUTE_PERCENT_CHANGE",
            minimumMagnitude: 0.226434,
            measuredMagnitude: 0.3,
            beforeValue: 100,
            afterValue: direction === "UP" ? 100.3 : 99.7,
            absoluteDelta: direction === "UP" ? 0.3 : -0.3,
            percentDelta: direction === "UP" ? 0.3 : -0.3,
            unit: "USD",
            frequency: "INTRADAY",
          }],
          repricedObservationKeys: responseStatus === "REPRICED"
            ? ["ASSET:btc.spot.usd:coingecko-market"]
            : [],
          unresolvedObservationKeys: [],
          unconfiguredObservationKeys: [],
        },
      }],
    }],
  };
}

test("CONF-001C composes point-in-time BTC ETF FLOW evidence for a clean qualified BTC repricing target", () => {
  const result = buildBriefingConfirmation({
    eventRepricing: repricing(),
    btcEtfFlow: flowModel({
      value: 100_000_000,
      retrievedAt: "2026-10-02T10:00:00.000Z",
    }),
  });

  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;

  assert.equal(result.targetDirection, "UP");
  assert.equal(result.capturedAt, "2026-10-02T12:35:00.000Z");
  assert.equal(result.evidence[0]?.status, "QUALIFIED");
  if (result.evidence[0]?.status !== "QUALIFIED") return;
  assert.equal(result.evidence[0].judgement, "SUPPORTING");
  assert.equal(result.assessment.resolution, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.assessment.supportingClassCount, 1);
  assert.equal(result.assessment.directionalClassCount, 1);
  assert.equal(result.assessment.causalAttribution, "NOT_EVALUATED");
});

test("CONF-001C keeps evidence unresolved when ETF flow became knowable after the response cutoff", () => {
  const result = buildBriefingConfirmation({
    eventRepricing: repricing(),
    btcEtfFlow: flowModel({
      value: 100_000_000,
      retrievedAt: "2026-10-02T12:40:00.000Z",
    }),
  });

  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;

  assert.equal(result.evidence[0]?.status, "UNRESOLVED");
  assert.equal(result.assessment.resolution, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.assessment.directionalClassCount, 0);
});

test("CONF-001C refuses contaminated event windows as confirmation targets", () => {
  const result = buildBriefingConfirmation({
    eventRepricing: repricing({ contaminationStatus: "CONTAMINATED" }),
    btcEtfFlow: flowModel({
      value: 100_000_000,
      retrievedAt: "2026-10-02T10:00:00.000Z",
    }),
  });

  assert.equal(result.status, "INSUFFICIENT");
});

test("CONF-001C refuses below-threshold BTC moves as confirmation targets", () => {
  const result = buildBriefingConfirmation({
    eventRepricing: repricing({
      status: "NO_REPRICING_OBSERVED",
      responseStatus: "BELOW_THRESHOLD",
    }),
    btcEtfFlow: flowModel({
      value: 100_000_000,
      retrievedAt: "2026-10-02T10:00:00.000Z",
    }),
  });

  assert.equal(result.status, "INSUFFICIENT");
});

test("CONF-001C maps ETF outflow as supporting for a qualified BTC DOWN response but still remains insufficient with one class", () => {
  const result = buildBriefingConfirmation({
    eventRepricing: repricing({ direction: "DOWN" }),
    btcEtfFlow: flowModel({
      value: -80_000_000,
      retrievedAt: "2026-10-02T10:00:00.000Z",
    }),
  });

  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  const evidence = result.evidence[0];
  assert.equal(evidence?.status, "QUALIFIED");
  if (!evidence || evidence.status !== "QUALIFIED") return;
  assert.equal(evidence.judgement, "SUPPORTING");
  assert.equal(result.assessment.resolution, "INSUFFICIENT_EVIDENCE");
});
