import assert from "node:assert/strict";
import test from "node:test";
import {
  assessConfirmationEvidence,
  CONFIRMATION_MIN_DIRECTIONAL_CLASSES_V1,
  type ConfirmationEvidenceClass,
  type ConfirmationContributionJudgement,
} from "./confirmation-evidence";

const KNOWLEDGE_AT = "2026-10-02T12:00:00.000Z";

function contribution(input: {
  id: string;
  evidenceClass: ConfirmationEvidenceClass;
  judgement: ConfirmationContributionJudgement;
  knownAt?: string;
}) {
  return {
    id: input.id,
    evidenceClass: input.evidenceClass,
    judgement: input.judgement,
    observedAt: "2026-10-02T10:00:00.000Z",
    knownAt: input.knownAt ?? "2026-10-02T11:00:00.000Z",
    methodologyId: "qualified-evidence-methodology",
    methodologyVersion: "v1",
    sourceSeriesKeys: ["series." + input.id],
  };
}

function assess(contributions: ReturnType<typeof contribution>[]) {
  return assessConfirmationEvidence({
    target: {
      targetId: "btc-response-test",
      asset: "BTC",
      responseObservationKey: "ASSET:btc.spot.usd:coingecko-market",
      direction: "UP",
      knowledgeAt: KNOWLEDGE_AT,
      eventIdentityKey: "event:v1:US:test",
    },
    contributions,
  });
}

test("CONF-001A requires at least two independent directional evidence classes", () => {
  const result = assess([
    contribution({
      id: "etf-flow",
      evidenceClass: "FLOW",
      judgement: "SUPPORTING",
    }),
  ]);

  assert.equal(CONFIRMATION_MIN_DIRECTIONAL_CLASSES_V1, 2);
  assert.equal(result.resolution, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.directionalClassCount, 1);
  assert.equal(result.causalAttribution, "NOT_EVALUATED");
});

test("CONF-001A confirms only when at least two independent classes support and none contradict", () => {
  const result = assess([
    contribution({
      id: "etf-flow",
      evidenceClass: "FLOW",
      judgement: "SUPPORTING",
    }),
    contribution({
      id: "stablecoin",
      evidenceClass: "LIQUIDITY",
      judgement: "SUPPORTING",
    }),
    contribution({
      id: "vix",
      evidenceClass: "VOLATILITY",
      judgement: "NEUTRAL",
    }),
  ]);

  assert.equal(result.resolution, "CONFIRMING");
  assert.equal(result.supportingClassCount, 2);
  assert.equal(result.contradictingClassCount, 0);
});

test("CONF-001A contradicts only when at least two independent classes contradict and none support", () => {
  const result = assess([
    contribution({
      id: "etf-flow",
      evidenceClass: "FLOW",
      judgement: "CONTRADICTING",
    }),
    contribution({
      id: "stablecoin",
      evidenceClass: "LIQUIDITY",
      judgement: "CONTRADICTING",
    }),
  ]);

  assert.equal(result.resolution, "CONTRADICTING");
  assert.equal(result.contradictingClassCount, 2);
});

test("CONF-001A reports mixed evidence instead of forcing a majority conclusion", () => {
  const result = assess([
    contribution({
      id: "etf-flow",
      evidenceClass: "FLOW",
      judgement: "SUPPORTING",
    }),
    contribution({
      id: "stablecoin",
      evidenceClass: "LIQUIDITY",
      judgement: "CONTRADICTING",
    }),
    contribution({
      id: "vix",
      evidenceClass: "VOLATILITY",
      judgement: "SUPPORTING",
    }),
  ]);

  assert.equal(result.resolution, "MIXED");
  assert.equal(result.supportingClassCount, 2);
  assert.equal(result.contradictingClassCount, 1);
});

test("CONF-001A does not count multiple same-class inputs as independent confirmation", () => {
  const result = assess([
    contribution({
      id: "etf-flow-a",
      evidenceClass: "FLOW",
      judgement: "SUPPORTING",
    }),
    contribution({
      id: "etf-flow-b",
      evidenceClass: "FLOW",
      judgement: "SUPPORTING",
    }),
  ]);

  assert.equal(result.resolution, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.supportingClassCount, 1);
  assert.equal(result.directionalClassCount, 1);
});

test("CONF-001A makes internally conflicting evidence classes non-directional", () => {
  const result = assess([
    contribution({
      id: "flow-support",
      evidenceClass: "FLOW",
      judgement: "SUPPORTING",
    }),
    contribution({
      id: "flow-contradict",
      evidenceClass: "FLOW",
      judgement: "CONTRADICTING",
    }),
    contribution({
      id: "stablecoin",
      evidenceClass: "LIQUIDITY",
      judgement: "SUPPORTING",
    }),
  ]);

  assert.equal(
    result.classes.find((item) => item.evidenceClass === "FLOW")?.resolution,
    "CONFLICTED",
  );
  assert.equal(result.resolution, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.directionalClassCount, 1);
});

test("CONF-001A rejects look-ahead evidence", () => {
  assert.throws(
    () => assess([
      contribution({
        id: "late-flow",
        evidenceClass: "FLOW",
        judgement: "SUPPORTING",
        knownAt: "2026-10-02T12:01:00.000Z",
      }),
    ]),
    /forbids evidence that became knowable after the target knowledge cutoff/,
  );
});
