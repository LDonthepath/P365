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
  assert.ok(
    Math.abs((result.whatChanged.items[0]?.changeValue ?? NaN) - 0.1) < 1e-10,
    "floating-point change calculation should be numerically equivalent to 0.1",
  );
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


test("BRF-001D selects the nearest point-in-time-known future HIGH event", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: "2026-10-02T12:00:00.000Z",
    upcomingHighImpactEvents: [
      {
        id: "past-high",
        subject: "Past high event",
        description: "past",
        jurisdiction: "US",
        scheduledAt: "2026-10-02T11:00:00.000Z",
        retrievedAt: "2026-10-02T10:00:00.000Z",
        status: "PAST",
        importance: "HIGH",
        sourceId: "biquote",
        evidenceId: "e-past",
      },
      {
        id: "medium-sooner",
        subject: "Medium event",
        description: "medium",
        jurisdiction: "US",
        scheduledAt: "2026-10-02T12:15:00.000Z",
        retrievedAt: "2026-10-02T10:00:00.000Z",
        status: "UPCOMING",
        importance: "MEDIUM",
        sourceId: "biquote",
        evidenceId: "e-medium",
      },
      {
        id: "future-known-later",
        subject: "Future-known event",
        description: "lookahead",
        jurisdiction: "US",
        scheduledAt: "2026-10-02T12:20:00.000Z",
        retrievedAt: "2026-10-02T12:05:00.000Z",
        status: "UPCOMING",
        importance: "HIGH",
        sourceId: "biquote",
        evidenceId: "e-lookahead",
      },
      {
        id: "nearest-high",
        subject: "Initial Jobless Claims",
        description: "claims",
        jurisdiction: "US",
        scheduledAt: "2026-10-02T12:30:23.000Z",
        retrievedAt: "2026-10-02T09:00:00.000Z",
        status: "UPCOMING",
        importance: "HIGH",
        sourceId: "biquote",
        evidenceId: "e-claims",
        identity: {
          version: "v1",
          key: "event:v1:US:2026-10-02T12:30:23.000Z:initial-jobless-claims",
          semanticKey: "initial-jobless-claims",
          scheduledAt: "2026-10-02T12:30:23.000Z",
          jurisdiction: "US",
        },
      },
      {
        id: "later-high",
        subject: "Later high event",
        description: "later",
        jurisdiction: "US",
        scheduledAt: "2026-10-02T14:00:00.000Z",
        retrievedAt: "2026-10-02T09:00:00.000Z",
        status: "UPCOMING",
        importance: "HIGH",
        sourceId: "biquote",
        evidenceId: "e-later",
      },
    ],
  });

  assert.equal(result.nextCatalyst.evidenceStatus, "AVAILABLE");
  assert.equal(result.nextCatalyst.reasoningStatus, "NOT_EVALUATED");
  assert.equal(result.nextCatalyst.slot?.precision, "TIME");
  assert.equal(result.nextCatalyst.slot?.scheduledAt, "2026-10-02T12:30:00.000Z");
  assert.equal(result.nextCatalyst.slot?.events[0]?.subject, "Initial Jobless Claims");
});

test("BRF-001D groups simultaneous HIGH events into one next-catalyst slot", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: "2026-10-02T12:00:00.000Z",
    upcomingHighImpactEvents: [
      {
        id: "cpi",
        subject: "CPI m/m",
        description: "headline",
        jurisdiction: "US",
        scheduledAt: "2026-10-02T12:30:10.000Z",
        retrievedAt: "2026-10-02T09:00:00.000Z",
        status: "UPCOMING",
        importance: "HIGH",
        sourceId: "biquote",
        evidenceId: "e-cpi",
      },
      {
        id: "core-cpi",
        subject: "Core CPI m/m",
        description: "core",
        jurisdiction: "US",
        scheduledAt: "2026-10-02T12:30:45.000Z",
        retrievedAt: "2026-10-02T09:00:00.000Z",
        status: "UPCOMING",
        importance: "HIGH",
        sourceId: "biquote",
        evidenceId: "e-core-cpi",
      },
    ],
  });

  assert.equal(result.nextCatalyst.evidenceStatus, "AVAILABLE");
  assert.deepEqual(
    result.nextCatalyst.slot?.events.map((event) => event.subject),
    ["Core CPI m/m", "CPI m/m"],
    "simultaneous events follow the current deterministic subject ordering",
  );
});

test("BRF-001D keeps a current-day Federal Reserve date anchor visible without inventing a clock time", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: "2026-10-02T18:00:00.000Z",
    upcomingHighImpactEvents: [{
      id: "fed-date-anchor",
      subject: "FOMC Minutes",
      description: "official date anchor",
      jurisdiction: "US",
      scheduledAt: "2026-10-02T00:00:00.000Z",
      retrievedAt: "2026-10-01T12:00:00.000Z",
      status: "UPCOMING",
      importance: "HIGH",
      sourceId: "federal-reserve",
      evidenceId: "e-fed",
    }],
  });

  assert.equal(result.nextCatalyst.evidenceStatus, "AVAILABLE");
  assert.equal(result.nextCatalyst.slot?.precision, "DATE_ONLY");
  assert.equal(result.nextCatalyst.slot?.scheduledAt, "2026-10-02T00:00:00.000Z");
});

test("BRF-001D stays insufficient when no future HIGH event is qualified", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: "2026-10-02T12:00:00.000Z",
    upcomingHighImpactEvents: [],
  });

  assert.equal(result.nextCatalyst.evidenceStatus, "INSUFFICIENT");
  assert.equal(result.nextCatalyst.slot, null);
  assert.match(result.nextCatalyst.reason ?? "", /Belum ada event HIGH mendatang/);
});


test("BRF-002A composes the existing material MOVE evidence into a market-first briefing", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    materialMoveMonitor: {
      asOf: AS_OF,
      status: "OK",
      causalAttribution: "NOT_EVALUATED",
      assets: [
        {
          asset: "BTC",
          seriesKey: "btc.spot.usd",
          sourceId: "coingecko-market",
          observedAt: "2026-10-01T23:55:00.000Z",
          marketContext: null,
          status: "MATERIAL_MOVE",
          hasMaterialMove: true,
          horizons: [{
            horizonMinutes: 60,
            status: "MATERIAL_MOVE",
            signedPercentChange: 1.82,
            materialityThresholdPercent: 1.2,
            targetPercentileRank: 98.1,
            historicalSampleSize: 420,
          }],
          evidence: {
            evidenceCompleteness: "EVIDENCE_INCOMPLETE",
            investigationWindow: {
              startAt: "2026-10-01T22:55:00.000Z",
              endAt: "2026-10-01T23:55:00.000Z",
            },
            synchronousCoverage: "COMPLETE",
            synchronousFingerprint: [{
              horizonMinutes: 60,
              coverage: "COMPLETE",
              series: [
                {
                  seriesKey: "btc.spot.usd",
                  sourceId: "coingecko-market",
                  state: "AVAILABLE_SYNCHRONOUS",
                  signedPercentChange: 1.82,
                },
                {
                  seriesKey: "dxy.index.usd",
                  sourceId: "yahoo-finance",
                  state: "AVAILABLE_SYNCHRONOUS",
                  signedPercentChange: -0.21,
                },
              ],
            }],
            scheduledCatalystCount: 1,
            scheduledCatalystCoverage: "COMPLETE",
            scheduledCatalysts: [{
              eventId: "event-cpi",
              eventIdentityKey: "event:v1:US:2026-10-01T23:30:00.000Z:cpi",
              subject: "US CPI",
              jurisdiction: "US",
              importance: "HIGH",
              scheduledAt: "2026-10-01T23:30:00.000Z",
              retrievedAt: "2026-10-01T20:00:00.000Z",
              sourceId: "biquote-economic-event",
            }],
            unscheduledCandidateCount: 1,
            unscheduledCatalystCoverage: "COMPLETE",
            unscheduledCandidates: [{
              url: "https://example.com/btc-move",
              title: "Bitcoin headline inside MOVE window",
              domain: "example.com",
              providerDate: "2026-10-01T23:40:00.000Z",
              providerDateSemantics: "PUBLICATION_OR_FIRST_SEEN",
              temporalFit: "WITHIN_MOVE_WINDOW",
              firstSeenRetrievedAt: "2026-10-01T23:45:00.000Z",
              firstSnapshotEvidenceId: "gdelt-snapshot-1",
            }],
            slowBackground: {
              state: "AVAILABLE_BACKGROUND",
              items: [
                {
                  kind: "USD_STABLECOIN_LIQUIDITY",
                  state: "AVAILABLE_BACKGROUND",
                  reason: null,
                },
                {
                  kind: "BTC_ETF_NET_FLOW",
                  state: "AVAILABLE_BACKGROUND",
                  reason: null,
                },
              ],
            },
            cryptoMarketStructure: {
              state: "INSUFFICIENT_DATA",
              components: [
                {
                  component: "BTC_DERIVATIVES",
                  state: "INSUFFICIENT_DATA",
                  reason: "Durable derivatives history is not approved.",
                },
                {
                  component: "BTC_SPOT_FLOW",
                  state: "AVAILABLE_SYNCHRONOUS",
                  reason: "Durable Binance spot flow is replayable.",
                },
                {
                  component: "BTC_SPOT_ORDER_BOOK",
                  state: "INSUFFICIENT_DATA",
                  reason: "Historical spot order-book snapshots are unavailable.",
                },
                {
                  component: "BTC_PERP_ORDER_BOOK",
                  state: "INSUFFICIENT_DATA",
                  reason: "Historical perp order-book snapshots are unavailable.",
                },
              ],
              reason: "Market structure remains incomplete.",
            },
            intradayRatesPricing: {
              state: "MISSING_HIGH_VALUE_EVIDENCE",
              reason: "No approved free intraday rates runtime.",
              policy: "FREE_ONLY_NO_APPROVED_RUNTIME",
            },
            btcSpotFlow: {
              coverage: "COMPLETE",
              venue: "BINANCE",
              pair: "BTCUSDT",
              windowMinutes: 60,
              observedWindowCount: 12,
              expectedWindowCount: 12,
              totalBaseVolumeBtc: 100,
              takerBuyBaseVolumeBtc: 58,
              takerSellBaseVolumeBtc: 42,
              netTakerBaseVolumeBtc: 16,
              takerBuyShare: 0.58,
              tradeCount: 1200,
            },
          },
          causalAttribution: "NOT_EVALUATED",
        },
        {
          asset: "GOLD",
          seriesKey: "gold.futures.usd",
          sourceId: "yahoo-finance",
          observedAt: "2026-10-01T23:55:00.000Z",
          marketContext: null,
          status: "BELOW_MATERIALITY_THRESHOLD",
          hasMaterialMove: false,
          horizons: [{
            horizonMinutes: 60,
            status: "BELOW_MATERIALITY_THRESHOLD",
            signedPercentChange: 0.31,
            materialityThresholdPercent: 0.8,
            targetPercentileRank: 62,
            historicalSampleSize: 410,
          }],
          evidence: null,
          causalAttribution: "NOT_EVALUATED",
        },
      ],
    },
  });

  assert.equal(result.marketMoves.evidenceStatus, "AVAILABLE");
  assert.equal(result.marketMoves.reasoningStatus, "NOT_EVALUATED");
  assert.equal(result.marketMoves.materialMoveCount, 1);
  assert.equal(result.marketMoves.items[0]?.asset, "BTC");
  assert.equal(result.marketMoves.items[0]?.horizons[0]?.signedPercentChange, 1.82);
  assert.equal(result.marketMoves.items[0]?.evidence?.scheduledCatalystCount, 1);
  assert.equal(result.marketMoves.items[0]?.evidence?.scheduledCatalysts[0]?.subject, "US CPI");
  assert.equal(result.marketMoves.items[0]?.evidence?.scheduledCatalysts[0]?.sourceId, "biquote-economic-event");
  assert.equal(result.marketMoves.items[0]?.evidence?.unscheduledCandidateCount, 1);
  assert.equal(
    result.marketMoves.items[0]?.evidence?.unscheduledCandidates[0]?.title,
    "Bitcoin headline inside MOVE window",
  );
  assert.equal(
    result.marketMoves.items[0]?.evidence?.unscheduledCandidates[0]?.temporalFit,
    "WITHIN_MOVE_WINDOW",
  );
  assert.equal(result.marketMoves.items[0]?.evidence?.btcSpotFlow?.takerBuyShare, 0.58);
  assert.equal(
    result.marketMoves.items[0]?.evidence?.slowBackground.items[0]?.state,
    "AVAILABLE_BACKGROUND",
  );
  assert.equal(
    result.marketMoves.items[0]?.evidence?.cryptoMarketStructure?.components[0]?.component,
    "BTC_DERIVATIVES",
  );
  assert.equal(
    result.marketMoves.items[0]?.evidence?.cryptoMarketStructure?.components[0]?.state,
    "INSUFFICIENT_DATA",
  );
  assert.equal(
    result.marketMoves.items[0]?.evidence?.intradayRatesPricing.state,
    "MISSING_HIGH_VALUE_EVIDENCE",
  );
  assert.equal(
    result.marketMoves.items[0]?.evidence?.evidenceCompleteness,
    "EVIDENCE_INCOMPLETE",
  );
  assert.equal(result.marketMoves.items[0]?.causalAttribution, "NOT_EVALUATED");
  assert.equal(result.resolution.status, "MATERIAL_MOVE_EVIDENCE_INCOMPLETE");
  assert.deepEqual(result.resolution.materialAssets, ["BTC"]);
  assert.equal(result.resolution.evidenceCompleteness, "EVIDENCE_INCOMPLETE");
  assert.match(result.resolution.statement, /Bitcoin mengalami pergerakan material/);
  assert.match(result.resolution.driverStatement, /belum dapat ditetapkan/);
  assert.equal(result.resolution.reasoningStatus, "NOT_EVALUATED");
});

test("BRF-002A fails closed when the MOVE monitor is unavailable", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    materialMoveMonitor: {
      asOf: AS_OF,
      status: "UNAVAILABLE",
      assets: [],
      causalAttribution: "NOT_EVALUATED",
    },
  });

  assert.equal(result.marketMoves.evidenceStatus, "INSUFFICIENT");
  assert.equal(result.marketMoves.materialMoveCount, 0);
  assert.deepEqual(result.marketMoves.items, []);
  assert.match(result.marketMoves.reason ?? "", /Belum ada assessment durable BTC\/Gold/);
  assert.equal(result.resolution.status, "MARKET_DATA_INSUFFICIENT");
  assert.equal(result.resolution.evidenceCompleteness, null);
  assert.match(result.resolution.driverStatement, /belum dievaluasi/);
});


test("BRF-002B preserves missing catalyst detail without inventing a driver", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    materialMoveMonitor: {
      asOf: AS_OF,
      status: "OK",
      causalAttribution: "NOT_EVALUATED",
      assets: [{
        asset: "BTC",
        seriesKey: "btc.spot.usd",
        sourceId: "coingecko-market",
        observedAt: "2026-10-01T23:55:00.000Z",
        marketContext: null,
        status: "MATERIAL_MOVE",
        hasMaterialMove: true,
        horizons: [{
          horizonMinutes: 60,
          status: "MATERIAL_MOVE",
          signedPercentChange: 1.5,
          materialityThresholdPercent: 1.1,
          targetPercentileRank: 97.8,
          historicalSampleSize: 400,
        }],
        evidence: {
          evidenceCompleteness: "EVIDENCE_INCOMPLETE",
          investigationWindow: {
            startAt: "2026-10-01T22:55:00.000Z",
            endAt: "2026-10-01T23:55:00.000Z",
          },
          synchronousCoverage: "PARTIAL",
          synchronousFingerprint: [],
          scheduledCatalystCount: 0,
          scheduledCatalystCoverage: "COMPLETE",
          scheduledCatalysts: [],
          unscheduledCandidateCount: 0,
          unscheduledCatalystCoverage: "PARTIAL",
          unscheduledCandidates: [],
          slowBackground: {
            state: "INSUFFICIENT_DATA",
            items: [
              {
                kind: "USD_STABLECOIN_LIQUIDITY",
                state: "INSUFFICIENT_DATA",
                reason: "No stablecoin observation at cutoff.",
              },
              {
                kind: "BTC_ETF_NET_FLOW",
                state: "INSUFFICIENT_DATA",
                reason: "No matured ETF flow at cutoff.",
              },
            ],
          },
          cryptoMarketStructure: {
            state: "INSUFFICIENT_DATA",
            components: [
              {
                component: "BTC_DERIVATIVES",
                state: "INSUFFICIENT_DATA",
                reason: "Durable derivatives history is unavailable.",
              },
              {
                component: "BTC_SPOT_FLOW",
                state: "INSUFFICIENT_DATA",
                reason: "No durable spot-flow windows at cutoff.",
              },
              {
                component: "BTC_SPOT_ORDER_BOOK",
                state: "INSUFFICIENT_DATA",
                reason: "Historical spot order-book snapshots are unavailable.",
              },
              {
                component: "BTC_PERP_ORDER_BOOK",
                state: "INSUFFICIENT_DATA",
                reason: "Historical perp order-book snapshots are unavailable.",
              },
            ],
            reason: "BTC market structure remains incomplete.",
          },
          intradayRatesPricing: {
            state: "MISSING_HIGH_VALUE_EVIDENCE",
            reason: "No approved free intraday rates runtime.",
            policy: "FREE_ONLY_NO_APPROVED_RUNTIME",
          },
          btcSpotFlow: null,
        },
        causalAttribution: "NOT_EVALUATED",
      }],
    },
  });

  const move = result.marketMoves.items[0];
  assert.equal(move?.hasMaterialMove, true);
  assert.equal(move?.evidence?.scheduledCatalystCount, 0);
  assert.deepEqual(move?.evidence?.scheduledCatalysts, []);
  assert.equal(move?.evidence?.unscheduledCandidateCount, 0);
  assert.deepEqual(move?.evidence?.unscheduledCandidates, []);
  assert.equal(move?.evidence?.slowBackground.state, "INSUFFICIENT_DATA");
  assert.equal(
    move?.evidence?.cryptoMarketStructure?.components
      .filter((item) => item.state === "INSUFFICIENT_DATA").length,
    4,
  );
  assert.equal(
    move?.evidence?.intradayRatesPricing.state,
    "MISSING_HIGH_VALUE_EVIDENCE",
  );
  assert.equal(move?.evidence?.evidenceCompleteness, "EVIDENCE_INCOMPLETE");
  assert.equal(move?.causalAttribution, "NOT_EVALUATED");
  assert.equal(JSON.stringify(move).toLowerCase().includes("caused"), false);
});


test("BRF-002D resolves a quiet market without inventing an investigation", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    materialMoveMonitor: {
      asOf: AS_OF,
      status: "OK",
      causalAttribution: "NOT_EVALUATED",
      assets: [
        {
          asset: "BTC",
          seriesKey: "btc.spot.usd",
          sourceId: "coingecko-market",
          observedAt: "2026-10-01T23:55:00.000Z",
          marketContext: null,
          status: "BELOW_MATERIALITY_THRESHOLD",
          hasMaterialMove: false,
          horizons: [{
            horizonMinutes: 60,
            status: "BELOW_MATERIALITY_THRESHOLD",
            signedPercentChange: 0.2,
            materialityThresholdPercent: 0.8,
            targetPercentileRank: 55,
            historicalSampleSize: 400,
          }],
          evidence: null,
          causalAttribution: "NOT_EVALUATED",
        },
        {
          asset: "GOLD",
          seriesKey: "gold.futures.usd",
          sourceId: "yahoo-finance",
          observedAt: "2026-10-01T23:55:00.000Z",
          marketContext: null,
          status: "BELOW_MATERIALITY_THRESHOLD",
          hasMaterialMove: false,
          horizons: [{
            horizonMinutes: 60,
            status: "BELOW_MATERIALITY_THRESHOLD",
            signedPercentChange: -0.1,
            materialityThresholdPercent: 0.5,
            targetPercentileRank: 40,
            historicalSampleSize: 390,
          }],
          evidence: null,
          causalAttribution: "NOT_EVALUATED",
        },
      ],
    },
  });

  assert.equal(result.marketMoves.materialMoveCount, 0);
  assert.equal(result.resolution.status, "NO_MATERIAL_MOVE");
  assert.deepEqual(result.resolution.materialAssets, []);
  assert.equal(result.resolution.evidenceCompleteness, null);
  assert.match(result.resolution.statement, /Belum ada pergerakan material Bitcoin atau Emas berjangka COMEX \(GC=F\)/);
  assert.match(result.resolution.statement, /Paket investigasi tidak diaktifkan/);
  assert.match(result.resolution.driverStatement, /Tidak ada pendorong yang dievaluasi/);
  assert.equal(result.resolution.reasoningStatus, "NOT_EVALUATED");
});

test("BRF-002D treats a material MOVE with no investigation bundle as incomplete", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    materialMoveMonitor: {
      asOf: AS_OF,
      status: "OK",
      causalAttribution: "NOT_EVALUATED",
      assets: [{
        asset: "GOLD",
        seriesKey: "gold.futures.usd",
        sourceId: "yahoo-finance",
        observedAt: "2026-10-01T23:55:00.000Z",
        marketContext: null,
        status: "MATERIAL_MOVE",
        hasMaterialMove: true,
        horizons: [{
          horizonMinutes: 60,
          status: "MATERIAL_MOVE",
          signedPercentChange: 1.1,
          materialityThresholdPercent: 0.5,
          targetPercentileRank: 99,
          historicalSampleSize: 390,
        }],
        evidence: null,
        causalAttribution: "NOT_EVALUATED",
      }],
    },
  });

  assert.equal(result.resolution.status, "MATERIAL_MOVE_EVIDENCE_INCOMPLETE");
  assert.deepEqual(result.resolution.materialAssets, ["GOLD"]);
  assert.equal(result.resolution.evidenceCompleteness, "EVIDENCE_INCOMPLETE");
  assert.match(result.resolution.statement, /Emas berjangka COMEX \(GC=F\) mengalami pergerakan material/);
  assert.match(result.resolution.driverStatement, /hubungan sebab-akibat belum dievaluasi/);
  assert.equal(result.resolution.reasoningStatus, "NOT_EVALUATED");
});


test("MACRO-RATES-001C puts only Gold and Bitcoin factual Rates & Policy context into briefing", () => {
  const result = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    ratesPolicy: {
      status: "OK",
      sep: { status: "UNAVAILABLE", reason: "No SEP observation in this Rates-only fixture" },
      series: [
        {
          seriesKey: "DGS2",
          value: 4.83,
          valueUnit: "PERCENT",
          observedAt: "2026-10-02",
          retrievedAt: "2026-10-05T20:31:01.690Z",
          quality: "FRESH",
          cadence: "DAILY",
          change1d: 5,
          change1dFrom: "2026-10-01",
          change1w: 2,
          change1wFrom: "2026-09-25",
          changeUnit: "BPS",
        },
        {
          seriesKey: "DFII10",
          value: 2.92,
          valueUnit: "PERCENT",
          observedAt: "2026-10-02",
          retrievedAt: "2026-10-05T20:31:02.139Z",
          quality: "FRESH",
          cadence: "DAILY",
          change1d: 4,
          change1dFrom: "2026-10-01",
          change1w: 5,
          change1wFrom: "2026-09-25",
          changeUnit: "BPS",
        },
        {
          seriesKey: "DTWEXBGS",
          value: 121.3848,
          valueUnit: "INDEX",
          observedAt: "2026-10-02",
          retrievedAt: "2026-10-05T20:31:02.577Z",
          quality: "FRESH",
          cadence: "DAILY",
          change1d: -0.33,
          change1dFrom: "2026-10-01",
          change1w: 0.73,
          change1wFrom: "2026-09-25",
          changeUnit: "PERCENT",
        },
        {
          seriesKey: "WRESBAL",
          value: 2948.09,
          valueUnit: "USD_BILLIONS",
          observedAt: "2026-09-30",
          retrievedAt: "2026-10-01T21:31:02.868Z",
          quality: "FRESH",
          cadence: "WEEKLY",
          change1d: null,
          change1dFrom: null,
          change1w: 48.09,
          change1wFrom: "2026-09-23",
          changeUnit: "USD_BILLIONS",
        },
        {
          seriesKey: "SOFR_IORB_SPREAD",
          value: -2,
          valueUnit: "BPS",
          observedAt: "2026-10-02",
          retrievedAt: "2026-10-05T12:31:02.744Z",
          quality: "FRESH",
          cadence: "DAILY",
          change1d: 1,
          change1dFrom: "2026-10-01",
          change1w: -2,
          change1wFrom: "2026-09-25",
          changeUnit: "BPS",
        },
      ],
    },
  });

  assert.equal(result.ratesPolicy.evidenceStatus, "AVAILABLE");
  assert.equal(result.ratesPolicy.reasoningStatus, "NOT_EVALUATED");
  assert.deepEqual(result.ratesPolicy.gold.map((item) => item.seriesKey), ["DTWEXBGS"]);
  assert.deepEqual(result.ratesPolicy.bitcoin.map((item) => item.seriesKey), ["WRESBAL", "SOFR_IORB_SPREAD"]);
  assert.equal(result.ratesPolicy.gold.some((item) => item.seriesKey === "DGS2"), false);
  assert.equal(result.ratesPolicy.reason, null);

  const serialized = JSON.stringify(result.ratesPolicy).toLowerCase();
  for (const forbidden of ["bullish", "bearish", "regime", "caused", "buy", "sell"]) {
    assert.equal(serialized.includes(forbidden), false, `briefing Rates & Policy must not emit ${forbidden}`);
  }
});
