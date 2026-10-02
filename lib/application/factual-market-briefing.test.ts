import assert from "node:assert/strict";
import test from "node:test";
import type { FactualBaseline } from "../domain/baseline";
import type { Observation } from "../domain/types";
import { composeFactualMarketBriefing } from "./factual-market-briefing";

const AS_OF = "2026-10-02T00:00:00.000Z";

function observation(id: string, seriesId: string, unit = "Percent"): Observation {
  return {
    id,
    domain: "MACRO",
    subject: seriesId,
    value: "1",
    observedAt: "2026-10-01T00:00:00.000Z",
    retrievedAt: "2026-10-01T00:05:00.000Z",
    sourceId: "fred",
    quality: "FRESH",
    evidenceId: `evidence-${id}`,
    metadata: { seriesId, unit, frequency: "DAILY" },
  };
}

function baseline(
  currentObservationId: string,
  currentValue: string,
  baselineValue: string | null,
  status: FactualBaseline["status"] = "VALID",
): FactualBaseline {
  return {
    kind: "FACTUAL",
    status,
    currentObservationId,
    baselineObservationId: baselineValue === null ? null : `previous-${currentObservationId}`,
    currentValue,
    baselineValue,
    currentObservedAt: "2026-10-01T00:00:00.000Z",
    baselineObservedAt: baselineValue === null ? null : "2026-09-30T00:00:00.000Z",
    sourceId: "fred",
    quality: status === "VALID" ? "FRESH" : "UNKNOWN",
    currentObservationQuality: "FRESH",
    baselineObservationQuality: baselineValue === null ? null : "FRESH",
    qualityPolicy: "current-freshness-historical-fitness-v1",
  };
}

test("composes the existing Gate 1 factual changes in the established priority order", () => {
  const observations = [
    observation("unrate", "UNRATE"),
    observation("dgs10", "DGS10"),
    observation("dfii10", "DFII10"),
    observation("dgs2", "DGS2"),
    observation("t10yie", "T10YIE"),
    observation("t10y2y", "T10Y2Y"),
  ];
  const baselines = {
    UNRATE: baseline("unrate", "4.3", "4.2"),
    DGS10: baseline("dgs10", "4.10", "4.00"),
    DFII10: baseline("dfii10", "1.80", "1.75"),
    DGS2: baseline("dgs2", "3.90", "3.80"),
    T10YIE: baseline("t10yie", "2.30", "2.25"),
    T10Y2Y: baseline("t10y2y", "0.20", "0.15"),
  };

  const result = composeFactualMarketBriefing({ baselines, observations, asOf: AS_OF });

  assert.equal(result.whatChanged.evidenceStatus, "AVAILABLE");
  assert.equal(result.whatChanged.reasoningStatus, "NOT_EVALUATED");
  assert.deepEqual(
    result.whatChanged.items.map((item) => item.seriesId),
    ["DGS2", "DGS10", "DFII10", "T10YIE"],
    "BRF-001A preserves the existing priority and four-item display bound",
  );
  assert.equal(result.whatChanged.items[0]?.changeValue, 0.1);
  assert.equal(result.whatChanged.items[0]?.unit, "Percent");
});

test("reports insufficient evidence instead of fabricating a briefing narrative", () => {
  const observations = [observation("dgs2", "DGS2")];
  const baselines = {
    DGS2: baseline("dgs2", "3.90", null, "MISSING"),
  };

  const result = composeFactualMarketBriefing({ baselines, observations, asOf: AS_OF });

  assert.equal(result.whatChanged.evidenceStatus, "INSUFFICIENT");
  assert.equal(result.whatChanged.reasoningStatus, "NOT_EVALUATED");
  assert.deepEqual(result.whatChanged.items, []);
  assert.match(result.whatChanged.reason ?? "", /Belum ada factual baseline Macro/);
});

test("Gate 1 composer remains factual and does not emit higher-order conclusions", () => {
  const result = composeFactualMarketBriefing({
    baselines: { DGS2: baseline("dgs2", "3.90", "3.80") },
    observations: [observation("dgs2", "DGS2")],
    asOf: AS_OF,
  });
  const serialized = JSON.stringify(result).toLowerCase();

  for (const forbidden of ["bullish", "bearish", "risk-on", "risk-off", "buy", "sell", "long", "short"]) {
    assert.equal(serialized.includes(forbidden), false, `composer must not emit ${forbidden}`);
  }
  assert.equal(result.whatChanged.reasoningStatus, "NOT_EVALUATED");
});


test("Gate 2 surfaces qualified PRE expectation and pricing baselines without repricing logic", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    intradayEventMonitor: {
      status: "OK",
      data: [{
        eventIdentityKey: "event:v1:US:2026-10-02T12:30:00.000Z:test",
        eventId: "event-a",
        subject: "Test Economic Release",
        jurisdiction: "US",
        t0: "2026-10-02T12:30:00.000Z",
        moves: [],
        missingRequirements: 0,
        windowStatus: { status: "RUNNING", nextRole: "T_PLUS_5" },
        baselineEvidence: {
          snapshotId: "snapshot-pre",
          capturedAt: "2026-10-02T12:25:00.000Z",
          expectation: {
            status: "VALID",
            policy: "latest-qualified-pre-release-v1",
            eventResultId: "result-forecast",
            sourceId: "biquote-economic-event",
            expected: 220,
            expectedType: "FORECAST",
            unit: "K",
            period: "2026-W40",
            retrievedAt: "2026-10-02T11:00:00.000Z",
            evidenceId: "evidence-forecast",
          },
          pricing: [{
            status: "VALID",
            policy: "latest-qualified-pricing-as-of-v1",
            observationId: "btc-pre",
            seriesKey: "btc.spot.usd",
            sourceId: "coingecko-market",
            value: 85000,
            unit: "USD",
            observedAt: "2026-10-02T12:24:00.000Z",
            retrievedAt: "2026-10-02T12:24:30.000Z",
            evidenceId: "evidence-btc-pre",
            quality: "FRESH",
          }],
        },
      }],
    },
  });

  assert.equal(result.eventBaselines.evidenceStatus, "AVAILABLE");
  assert.equal(result.eventBaselines.reasoningStatus, "NOT_EVALUATED");
  assert.equal(result.eventBaselines.events[0]?.expectation?.expected, 220);
  assert.equal(result.eventBaselines.events[0]?.pricing[0]?.value, 85000);
  assert.equal(JSON.stringify(result.eventBaselines).includes("threshold"), false);
});

test("Gate 2 reports insufficient evidence when latest event has no qualified PRE baselines", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    intradayEventMonitor: { status: "EMPTY" },
  });

  assert.equal(result.eventBaselines.evidenceStatus, "INSUFFICIENT");
  assert.equal(result.eventBaselines.reasoningStatus, "NOT_EVALUATED");
  assert.deepEqual(result.eventBaselines.events, []);
});


test("Gate 3a surfaces existing VALID SUR-001 evidence without repricing logic", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    intradayEventMonitor: {
      status: "OK",
      data: [{
        eventIdentityKey: "event:v1:US:2026-10-02T12:30:00.000Z:test",
        eventId: "event-a",
        subject: "Test Economic Release",
        jurisdiction: "US",
        t0: "2026-10-02T12:30:00.000Z",
        moves: [],
        missingRequirements: 0,
        windowStatus: { status: "RUNNING", nextRole: "T_PLUS_5" },
        surprise: {
          id: "event-surprise-v1-test",
          version: "v1",
          policy: "point-in-time-factual-event-surprise-v1",
          status: "VALID",
          eventIdentityKey: "event:v1:US:2026-10-02T12:30:00.000Z:test",
          sourceId: "biquote-economic-event",
          releaseAt: "2026-10-02T12:30:00.000Z",
          asOf: "2026-10-02T12:35:00.000Z",
          expectedType: "FORECAST",
          baselineEventResultId: "result-forecast",
          actualEventResultId: "result-actual",
          expected: 220,
          actual: 235,
          unit: "K",
          period: "2026-W40",
          absoluteSurprise: 15,
          percentSurprise: 6.8181818181818175,
          relation: "ABOVE_EXPECTATION",
          expectationRetrievedAt: "2026-10-02T11:00:00.000Z",
          actualRetrievedAt: "2026-10-02T12:31:00.000Z",
          evidenceIds: ["evidence-forecast", "evidence-actual"],
          causalAttribution: "NOT_EVALUATED",
        },
      }],
    },
  });

  assert.equal(result.eventSurprises.evidenceStatus, "AVAILABLE");
  assert.equal(result.eventSurprises.reasoningStatus, "NOT_EVALUATED");
  assert.equal(result.eventSurprises.events[0]?.actual, 235);
  assert.equal(result.eventSurprises.events[0]?.expected, 220);
  assert.equal(result.eventSurprises.events[0]?.relation, "ABOVE_EXPECTATION");
  assert.equal(result.eventSurprises.events[0]?.causalAttribution, "NOT_EVALUATED");
  assert.equal(JSON.stringify(result.eventSurprises).includes("threshold"), false);
});

test("Gate 3a reports insufficient evidence instead of promoting non-VALID surprise", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    intradayEventMonitor: { status: "EMPTY" },
  });

  assert.equal(result.eventSurprises.evidenceStatus, "INSUFFICIENT");
  assert.equal(result.eventSurprises.reasoningStatus, "NOT_EVALUATED");
  assert.deepEqual(result.eventSurprises.events, []);
});


test("Gate 3b surfaces the latest qualified RPR-001 assessment", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    eventRepricing: {
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
            contaminationStatus: "CLEAN",
            contaminants: [],
            causalAttribution: "NOT_EVALUATED",
            status: "REPRICING_OBSERVED",
            thresholds: [{
              observationKey: "ASSET:btc.spot.usd:coingecko-market",
              basis: "ABSOLUTE_PERCENT_CHANGE",
              minimumMagnitude: 0.226434,
            }],
            responses: [{
              observationKey: "ASSET:btc.spot.usd:coingecko-market",
              status: "REPRICED",
              direction: "UP",
              basis: "ABSOLUTE_PERCENT_CHANGE",
              minimumMagnitude: 0.226434,
              measuredMagnitude: 0.3,
              beforeValue: 100,
              afterValue: 100.3,
              absoluteDelta: 0.3,
              percentDelta: 0.3,
              unit: "USD",
              frequency: "INTRADAY",
            }],
            repricedObservationKeys: [
              "ASSET:btc.spot.usd:coingecko-market",
            ],
            unresolvedObservationKeys: [],
            unconfiguredObservationKeys: [],
          },
        }],
      }],
    },
  });

  assert.equal(result.eventRepricing.evidenceStatus, "AVAILABLE");
  assert.equal(result.eventRepricing.reasoningStatus, "NOT_EVALUATED");
  assert.equal(result.eventRepricing.events[0]?.status, "REPRICING_OBSERVED");
  assert.equal(
    result.eventRepricing.events[0]?.responses[0]?.seriesKey,
    "btc.spot.usd",
  );
  assert.equal(
    result.eventRepricing.events[0]?.responses[0]?.minimumMagnitude,
    0.226434,
  );
  assert.equal(
    result.eventRepricing.events[0]?.causalAttribution,
    "NOT_EVALUATED",
  );
});

test("Gate 3b keeps incomplete contamination history insufficient", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    eventRepricing: {
      status: "INSUFFICIENT",
      reason: "Riwayat event HIGH belum lengkap.",
    },
  });

  assert.equal(result.eventRepricing.evidenceStatus, "INSUFFICIENT");
  assert.deepEqual(result.eventRepricing.events, []);
  assert.match(result.eventRepricing.reason ?? "", /belum lengkap/);
});

test("Gate 3b keeps exact-horizon threshold gaps insufficient", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    eventRepricing: {
      status: "OK",
      data: [{
        eventIdentityKey: "event:v1:US:2026-10-02T12:30:00.000Z:test",
        eventId: "event-a",
        subject: "Test Economic Release",
        jurisdiction: "US",
        t0: "2026-10-02T12:30:00.000Z",
        windows: [{
          status: "INSUFFICIENT_THRESHOLDS",
          role: "T_PLUS_5",
          capturedAt: "2026-10-02T12:35:00.000Z",
          reason: "No exact threshold.",
        }],
      }],
    },
  });

  assert.equal(result.eventRepricing.evidenceStatus, "INSUFFICIENT");
  assert.deepEqual(result.eventRepricing.events, []);
  assert.match(result.eventRepricing.reason ?? "", /cocok persis/);
});


test("Gate 6 surfaces qualified confirmation evidence while preserving insufficient-evidence state", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    confirmation: {
      status: "OK",
      eventIdentityKey: "event:v1:US:2026-10-02T12:30:00.000Z:test",
      eventId: "event-a",
      subject: "Test Economic Release",
      jurisdiction: "US",
      releaseAt: "2026-10-02T12:30:00.000Z",
      role: "T_PLUS_5",
      capturedAt: "2026-10-02T12:35:00.000Z",
      targetDirection: "UP",
      assessment: {
        id: "confirmation-evidence-v1-test",
        version: "v1",
        policy: "independent-evidence-class-confirmation-v1",
        target: {
          targetId: "btc-repricing-confirmation:test:T_PLUS_5",
          asset: "BTC",
          responseObservationKey: "ASSET:btc.spot.usd:coingecko-market",
          direction: "UP",
          knowledgeAt: "2026-10-02T12:35:00.000Z",
          eventIdentityKey: "event:v1:US:2026-10-02T12:30:00.000Z:test",
        },
        resolution: "INSUFFICIENT_EVIDENCE",
        minimumDirectionalClasses: 2,
        supportingClassCount: 1,
        contradictingClassCount: 0,
        directionalClassCount: 1,
        classes: [{
          evidenceClass: "FLOW",
          resolution: "SUPPORTING",
          contributionIds: ["flow-confirmation"],
          methodologyIds: ["btc-etf-matured-flow-directional-alignment-v1@v1"],
        }],
        contributions: [{
          id: "flow-confirmation",
          evidenceClass: "FLOW",
          judgement: "SUPPORTING",
          observedAt: "2026-10-01T00:00:00.000Z",
          knownAt: "2026-10-02T10:00:00.000Z",
          methodologyId: "btc-etf-matured-flow-directional-alignment-v1",
          methodologyVersion: "v1",
          sourceSeriesKeys: ["crypto.us_spot_btc_etf_net_flow.usd"],
          reason: "Flow aligns with BTC response.",
        }],
        causalAttribution: "NOT_EVALUATED",
        reason: "CONF-001A requires at least two independent directional evidence classes.",
      },
      evidence: [{
        status: "QUALIFIED",
        evidenceClass: "FLOW",
        source: "BTC_ETF_FLOW",
        judgement: "SUPPORTING",
        observedAt: "2026-10-01T00:00:00.000Z",
        knownAt: "2026-10-02T10:00:00.000Z",
        reason: "Flow aligns with BTC response.",
      }],
    },
  });

  assert.equal(result.confirmation.evidenceStatus, "AVAILABLE");
  assert.equal(result.confirmation.reasoningStatus, "NOT_EVALUATED");
  assert.equal(result.confirmation.item?.resolution, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.confirmation.item?.directionalClassCount, 1);
  assert.equal(result.confirmation.item?.minimumDirectionalClasses, 2);
  assert.equal(result.confirmation.item?.evidence[0]?.judgement, "SUPPORTING");
  assert.equal(result.confirmation.item?.causalAttribution, "NOT_EVALUATED");
  assert.match(result.confirmation.reason ?? "", /two independent directional evidence classes/);
});

test("Gate 6 stays insufficient when no clean qualified BTC repricing target exists", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    confirmation: {
      status: "INSUFFICIENT",
      reason: "Belum ada clean BTC repricing response yang qualified untuk menjadi target confirmation.",
    },
  });

  assert.equal(result.confirmation.evidenceStatus, "INSUFFICIENT");
  assert.equal(result.confirmation.item, null);
  assert.match(result.confirmation.reason ?? "", /clean BTC repricing response/);
});
