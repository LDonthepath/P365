import assert from "node:assert/strict";
import test from "node:test";
import {
  assessConfirmationEvidence,
  type ConfirmationTarget,
} from "../domain/confirmation-evidence";
import {
  BTC_ETF_NET_FLOW_SERIES_KEY,
} from "../domain/observation-semantics";
import type {
  BtcEtfFlowPoint,
  BtcEtfFlowReadModel,
} from "./btc-etf-flow";
import {
  buildBtcEtfFlowConfirmationContribution,
} from "./btc-etf-flow-confirmation";

const TARGET: ConfirmationTarget = {
  targetId: "btc-event-response",
  asset: "BTC",
  responseObservationKey: "ASSET:btc.spot.usd:coingecko-market",
  direction: "UP",
  knowledgeAt: "2026-10-02T12:00:00.000Z",
  eventIdentityKey: "event:v1:US:test",
};

function point(input: {
  id: string;
  value: number;
  observedAt: string;
  retrievedAt: string;
}): BtcEtfFlowPoint {
  return {
    value: input.value,
    observedAt: input.observedAt,
    providerTradingDate: input.observedAt.slice(0, 10),
    retrievedAt: input.retrievedAt,
    quality: "UNKNOWN",
    observationId: input.id,
  };
}

function model(recent: BtcEtfFlowPoint[]): BtcEtfFlowReadModel {
  return {
    asOf: "2026-10-02T13:00:00.000Z",
    seriesKey: BTC_ETF_NET_FLOW_SERIES_KEY,
    latest: recent[0] ?? null,
    previous: recent[1] ?? null,
    recent,
  };
}

test("CONF-001B maps positive matured ETF flow to supporting evidence for an observed BTC UP response", () => {
  const result = buildBtcEtfFlowConfirmationContribution({
    target: TARGET,
    flow: model([
      point({
        id: "flow-positive",
        value: 125_000_000,
        observedAt: "2026-10-01T00:00:00.000Z",
        retrievedAt: "2026-10-02T10:00:00.000Z",
      }),
    ]),
  });

  assert.equal(result.status, "QUALIFIED");
  if (result.status !== "QUALIFIED") return;
  assert.equal(result.contribution.evidenceClass, "FLOW");
  assert.equal(result.contribution.judgement, "SUPPORTING");
  assert.equal(result.contribution.knownAt, "2026-10-02T10:00:00.000Z");
});

test("CONF-001B maps positive flow to contradicting evidence for an observed BTC DOWN response", () => {
  const result = buildBtcEtfFlowConfirmationContribution({
    target: { ...TARGET, direction: "DOWN" },
    flow: model([
      point({
        id: "flow-positive",
        value: 125_000_000,
        observedAt: "2026-10-01T00:00:00.000Z",
        retrievedAt: "2026-10-02T10:00:00.000Z",
      }),
    ]),
  });

  assert.equal(result.status, "QUALIFIED");
  if (result.status !== "QUALIFIED") return;
  assert.equal(result.contribution.judgement, "CONTRADICTING");
});

test("CONF-001B treats provider-explicit numeric zero as neutral", () => {
  const result = buildBtcEtfFlowConfirmationContribution({
    target: TARGET,
    flow: model([
      point({
        id: "flow-zero",
        value: 0,
        observedAt: "2026-10-01T00:00:00.000Z",
        retrievedAt: "2026-10-02T10:00:00.000Z",
      }),
    ]),
  });

  assert.equal(result.status, "QUALIFIED");
  if (result.status !== "QUALIFIED") return;
  assert.equal(result.contribution.judgement, "NEUTRAL");
});

test("CONF-001B uses the latest flow revision provably knowable by the target cutoff and rejects look-ahead", () => {
  const result = buildBtcEtfFlowConfirmationContribution({
    target: TARGET,
    flow: model([
      point({
        id: "future-flow",
        value: -250_000_000,
        observedAt: "2026-10-02T00:00:00.000Z",
        retrievedAt: "2026-10-02T12:30:00.000Z",
      }),
      point({
        id: "known-flow",
        value: 80_000_000,
        observedAt: "2026-10-01T00:00:00.000Z",
        retrievedAt: "2026-10-02T09:00:00.000Z",
      }),
    ]),
  });

  assert.equal(result.status, "QUALIFIED");
  if (result.status !== "QUALIFIED") return;
  assert.equal(result.point.observationId, "known-flow");
  assert.equal(result.contribution.judgement, "SUPPORTING");
});

test("CONF-001B fails closed when the bounded read model cannot prove any flow fact was knowable by the target cutoff", () => {
  const result = buildBtcEtfFlowConfirmationContribution({
    target: TARGET,
    flow: model([
      point({
        id: "future-flow",
        value: 90_000_000,
        observedAt: "2026-10-02T00:00:00.000Z",
        retrievedAt: "2026-10-02T12:30:00.000Z",
      }),
    ]),
  });

  assert.equal(result.status, "UNRESOLVED");
  if (result.status !== "UNRESOLVED") return;
  assert.match(result.reason, /provably knowable/);
});

test("CONF-001B does not apply BTC ETF flow to a Gold target", () => {
  const result = buildBtcEtfFlowConfirmationContribution({
    target: {
      ...TARGET,
      asset: "GOLD",
      responseObservationKey: "ASSET:gold.futures.usd:yahoo-finance",
    },
    flow: model([
      point({
        id: "flow-positive",
        value: 100_000_000,
        observedAt: "2026-10-01T00:00:00.000Z",
        retrievedAt: "2026-10-02T10:00:00.000Z",
      }),
    ]),
  });

  assert.equal(result.status, "UNRESOLVED");
});

test("one qualified FLOW class alone still resolves to insufficient evidence under CONF-001A", () => {
  const adapter = buildBtcEtfFlowConfirmationContribution({
    target: TARGET,
    flow: model([
      point({
        id: "flow-positive",
        value: 100_000_000,
        observedAt: "2026-10-01T00:00:00.000Z",
        retrievedAt: "2026-10-02T10:00:00.000Z",
      }),
    ]),
  });

  assert.equal(adapter.status, "QUALIFIED");
  if (adapter.status !== "QUALIFIED") return;

  const assessment = assessConfirmationEvidence({
    target: TARGET,
    contributions: [adapter.contribution],
  });

  assert.equal(assessment.resolution, "INSUFFICIENT_EVIDENCE");
  assert.equal(assessment.supportingClassCount, 1);
  assert.equal(assessment.directionalClassCount, 1);
  assert.equal(assessment.causalAttribution, "NOT_EVALUATED");
});
