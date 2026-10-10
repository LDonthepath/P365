import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketSnapshot,
  marketSnapshotObservationKey,
  type MarketSnapshot,
} from "../domain/market-snapshot";
import type { Event, Observation } from "../domain/types";
import { buildBriefingEventRepricing } from "./briefing-event-repricing";
import {
  buildIntradayRepricingSource,
  type IntradayEventMonitorResult,
} from "./intraday-event-monitor";

function observation(input: {
  id: string;
  value: string;
  observedAt: string;
  retrievedAt: string;
}): Observation {
  return {
    id: input.id,
    domain: "ASSET",
    subject: "Bitcoin",
    value: input.value,
    observedAt: input.observedAt,
    retrievedAt: input.retrievedAt,
    sourceId: "coingecko-market",
    quality: "FRESH",
    evidenceId: "e-" + input.id,
    identity: {
      version: "v1",
      seriesKey: "btc.spot.usd",
      measurementId: "m-" + input.id,
      revisionFingerprint: "r-" + input.id,
    },
    metadata: {
      metricId: "btc.spot.usd",
      unit: "USD",
      frequency: "INTRADAY",
    },
  };
}

function event(input: {
  id?: string;
  subject?: string;
  scheduledAt?: string;
  retrievedAt?: string;
  semanticKey?: string;
} = {}): Event {
  const scheduledAt = input.scheduledAt ?? "2026-10-15T12:30:00.000Z";
  const semanticKey = input.semanticKey ?? "cpi";
  return {
    id: input.id ?? "event-cpi",
    subject: input.subject ?? "CPI",
    description: input.subject ?? "US CPI",
    jurisdiction: "US",
    scheduledAt,
    // This UPCOMING calendar event has not released by the PRE snapshot.
    retrievedAt: input.retrievedAt ?? "2026-10-15T10:00:00.000Z",
    status: "UPCOMING",
    importance: "HIGH",
    sourceId: "biquote",
    evidenceId: "e-" + (input.id ?? "event-cpi"),
    identity: {
      version: "v1",
      key: "event:v1:US:" + scheduledAt + ":" + semanticKey,
      semanticKey,
      scheduledAt,
      jurisdiction: "US",
    },
  };
}

function snapshot(
  capturedAt: string,
  obs: Observation,
  primary: Event,
): MarketSnapshot {
  return buildMarketSnapshot({
    capturedAt,
    scope: "MVP_MACRO_CRYPTO_GOLD_EVENT",
    observations: [obs],
    events: [primary],
    requirements: [
      { kind: "OBSERVATION", key: marketSnapshotObservationKey(obs) },
      { kind: "EVENT", key: primary.identity!.key },
    ],
    metadata: {
      eventIdentityKey: primary.identity!.key,
      eventWindowRole: capturedAt.endsWith("12:25:00.000Z")
        ? "PRE"
        : "T_PLUS_5",
      t0: primary.scheduledAt!,
    },
  });
}

function monitorResult(afterObservedAt = "2026-10-15T12:30:00.000Z"): {
  monitor: IntradayEventMonitorResult;
  primary: Event;
} {
  const primary = event();
  const beforeObservation = observation({
    id: "btc-before",
    value: "100",
    observedAt: "2026-10-15T12:20:00.000Z",
    retrievedAt: "2026-10-15T12:20:30.000Z",
  });
  const afterObservation = observation({
    id: "btc-after",
    value: "100.3",
    observedAt: afterObservedAt,
    retrievedAt: "2026-10-15T12:30:30.000Z",
  });
  const before = snapshot(
    "2026-10-15T12:25:00.000Z",
    beforeObservation,
    primary,
  );
  const after = snapshot(
    "2026-10-15T12:35:00.000Z",
    afterObservation,
    primary,
  );

  const source = buildIntradayRepricingSource({
    event: primary,
    byRole: new Map([
      ["PRE", before],
      ["T_PLUS_5", after],
    ]),
    observations: new Map([
      [beforeObservation.id, beforeObservation],
      [afterObservation.id, afterObservation],
    ]),
  });
  assert.ok(source);

  return {
    primary,
    monitor: {
      status: "OK",
      data: [{
        eventIdentityKey: primary.identity!.key,
        eventId: primary.id,
        subject: primary.subject,
        jurisdiction: "US",
        t0: primary.scheduledAt!,
        moves: [],
        missingRequirements: 0,
        windowStatus: { status: "COMPLETE" },
        repricingSource: source,
      }],
    },
  };
}

test("Gate 3b reuses monitor-resolved CMP evidence and exact RPR-002B threshold without I/O", () => {
  const { monitor, primary } = monitorResult();
  const result = buildBriefingEventRepricing({
    monitor,
    eventHistory: [primary],
    eventHistoryComplete: true,
  });

  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;

  const window = result.data[0]?.windows[0];
  assert.equal(window?.status, "ASSESSED");
  if (!window || window.status !== "ASSESSED") return;

  assert.equal(window.assessment.afterRole, "T_PLUS_5");
  assert.equal(window.assessment.status, "REPRICING_OBSERVED");
  assert.equal(window.assessment.causalAttribution, "NOT_EVALUATED");
  assert.deepEqual(window.assessment.thresholds, [{
    observationKey: "ASSET:btc.spot.usd:coingecko-market",
    basis: "ABSOLUTE_PERCENT_CHANGE",
    minimumMagnitude: 0.226434,
  }]);
  assert.equal(window.assessment.responses[0]?.status, "REPRICED");
});

test("Gate 3b fails closed when the canonical Observation horizon does not exactly match calibration", () => {
  const { monitor, primary } = monitorResult(
    "2026-10-15T12:30:10.000Z",
  );
  const result = buildBriefingEventRepricing({
    monitor,
    eventHistory: [primary],
    eventHistoryComplete: true,
  });

  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  assert.equal(
    result.data[0]?.windows[0]?.status,
    "INSUFFICIENT_THRESHOLDS",
  );
});

test("Gate 3b preserves contamination from the reused HIGH-event history", () => {
  const { monitor, primary } = monitorResult();
  const contaminant = event({
    id: "event-jolts",
    subject: "JOLTS",
    scheduledAt: "2026-10-15T12:32:00.000Z",
    retrievedAt: "2026-10-15T11:00:00.000Z",
    semanticKey: "jolts",
  });
  const result = buildBriefingEventRepricing({
    monitor,
    eventHistory: [primary, contaminant],
    eventHistoryComplete: true,
  });

  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  const window = result.data[0]?.windows[0];
  assert.equal(window?.status, "ASSESSED");
  if (!window || window.status !== "ASSESSED") return;

  assert.equal(window.assessment.status, "CONTAMINATED");
  assert.equal(window.assessment.contaminationStatus, "CONTAMINATED");
  assert.equal(window.assessment.contaminants[0]?.subject, "JOLTS");
});

test("Gate 3b refuses a clean/contaminated conclusion when reused event history is incomplete", () => {
  const { monitor, primary } = monitorResult();
  const result = buildBriefingEventRepricing({
    monitor,
    eventHistory: [primary],
    eventHistoryComplete: false,
  });

  assert.equal(result.status, "INSUFFICIENT");
});
