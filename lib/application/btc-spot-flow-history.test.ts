import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryEvidenceRepository } from "../repositories/memory";
import {
  BTC_SPOT_FLOW_METHODOLOGY,
  type BtcSpotFlowWindow,
} from "./btc-spot-flow";
import {
  BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
  btcSpotFlowWindowFromEvidence,
  btcSpotFlowWindowsToEvidence,
} from "./btc-spot-flow-history";

function window(overrides: Partial<BtcSpotFlowWindow> = {}): BtcSpotFlowWindow {
  const providerIntervalStartMs = Date.parse("2026-10-04T12:00:00.000Z");
  return {
    asset: "BTC",
    venue: "BINANCE",
    pair: "BTCUSDT",
    baseUnit: "BTC",
    providerIntervalStartMs,
    observedAt: "2026-10-04T12:05:00.000Z",
    windowSeconds: 300,
    totalBaseVolumeBtc: 10,
    takerBuyBaseVolumeBtc: 6,
    takerSellBaseVolumeBtc: 4,
    netTakerBaseVolumeBtc: 2,
    takerBuyShare: 0.6,
    tradeCount: 200,
    coverage: "COMPLETE",
    methodology: BTC_SPOT_FLOW_METHODOLOGY,
    ...overrides,
  };
}

test("durable Binance spot-flow Evidence is idempotent for the same factual 5m window", () => {
  const first = btcSpotFlowWindowsToEvidence({
    windows: [window()],
    retrievedAt: "2026-10-04T12:05:02.000Z",
  })[0];
  const repeated = btcSpotFlowWindowsToEvidence({
    windows: [window()],
    retrievedAt: "2026-10-04T12:05:30.000Z",
  })[0];

  assert.equal(first.id, repeated.id);
  assert.equal(first.sourceId, "binance-spot");
  assert.equal(first.kind, "OBSERVATION");
  assert.equal(first.releasedAt, "2026-10-04T12:05:00.000Z");
  assert.equal(
    first.metadata?.methodology,
    BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
  );
  assert.equal(first.metadata?.netTakerBaseVolumeBtc, 2);
  assert.deepEqual(btcSpotFlowWindowFromEvidence(first), window());
});

test("same Binance 5m measurement with changed facts becomes an append-only Evidence revision", async () => {
  const repository = new InMemoryEvidenceRepository();
  const first = btcSpotFlowWindowsToEvidence({
    windows: [window()],
    retrievedAt: "2026-10-04T12:05:02.000Z",
  })[0];
  const correctedWindow = window({
    takerBuyBaseVolumeBtc: 6.5,
    takerSellBaseVolumeBtc: 3.5,
    netTakerBaseVolumeBtc: 3,
    takerBuyShare: 0.65,
    tradeCount: 201,
  });
  const corrected = btcSpotFlowWindowsToEvidence({
    windows: [correctedWindow],
    retrievedAt: "2026-10-04T12:06:00.000Z",
  })[0];

  assert.notEqual(first.id, corrected.id);
  assert.equal(first.metadata?.windowKey, corrected.metadata?.windowKey);

  await repository.saveMany([first, corrected]);
  await repository.save(first);

  const beforeCorrection = await repository.findHistory({
    sourceId: "binance-spot",
    kind: "OBSERVATION",
    metadataEquals: {
      methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
      pair: "BTCUSDT",
    },
    effectiveAtOnOrAfter: "2026-10-04T12:05:00.000Z",
    effectiveAtOnOrBefore: "2026-10-04T12:05:00.000Z",
    retrievedAtOnOrBefore: "2026-10-04T12:05:59.999Z",
    order: "ASC",
    limit: 20,
  });
  assert.deepEqual(beforeCorrection.map((item) => item.id), [first.id]);

  const afterCorrection = await repository.findHistory({
    sourceId: "binance-spot",
    kind: "OBSERVATION",
    metadataEquals: {
      methodology: BINANCE_BTC_SPOT_FLOW_DURABLE_METHODOLOGY,
      pair: "BTCUSDT",
    },
    effectiveAtOnOrAfter: "2026-10-04T12:05:00.000Z",
    effectiveAtOnOrBefore: "2026-10-04T12:05:00.000Z",
    retrievedAtOnOrBefore: "2026-10-04T12:06:00.000Z",
    order: "ASC",
    limit: 20,
  });
  assert.deepEqual(afterCorrection.map((item) => item.id), [first.id, corrected.id]);
  assert.deepEqual(btcSpotFlowWindowFromEvidence(corrected), correctedWindow);
});

test("durable Binance spot-flow fails closed for incomplete or inconsistent windows", () => {
  assert.throws(
    () => btcSpotFlowWindowsToEvidence({
      windows: [window({ observedAt: "2026-10-04T12:05:00.000Z" })],
      retrievedAt: "2026-10-04T12:04:59.999Z",
    }),
    /before it is complete/,
  );

  assert.throws(
    () => btcSpotFlowWindowsToEvidence({
      windows: [window({ takerSellBaseVolumeBtc: 5 })],
      retrievedAt: "2026-10-04T12:05:02.000Z",
    }),
    /reconcile to total volume/,
  );
});
