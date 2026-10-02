import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveGoldManagedMoneyNet,
  GOLD_MANAGED_MONEY_NET_SERIES_KEY,
} from "./gold-positioning-derived";

test("GOLD-POS-001D derives Managed Money net as long minus short with explicit lineage", () => {
  const result = deriveGoldManagedMoneyNet({
    long: {
      observationId: "obs-long",
      seriesKey: "gold.cftc.managed_money.long.contracts",
      value: 210000,
      observedAt: "2026-09-22T00:00:00.000Z",
      retrievedAt: "2026-09-25T19:40:00.000Z",
    },
    short: {
      observationId: "obs-short",
      seriesKey: "gold.cftc.managed_money.short.contracts",
      value: 35000,
      observedAt: "2026-09-22T00:00:00.000Z",
      retrievedAt: "2026-09-25T19:41:00.000Z",
    },
  });

  assert.equal(result.seriesKey, GOLD_MANAGED_MONEY_NET_SERIES_KEY);
  assert.equal(result.value, 175000);
  assert.equal(result.unit, "CONTRACTS");
  assert.equal(result.knownAt, "2026-09-25T19:41:00.000Z");
  assert.deepEqual(result.inputObservationIds, ["obs-long", "obs-short"]);
  assert.equal(result.semantics.informationClass, "DERIVED_METRIC");
  assert.equal(result.semantics.participant, "MANAGED_MONEY");
  assert.equal(result.formula, "LONG_MINUS_SHORT");
  assert.equal(result.spreadingIncluded, false);
});

test("GOLD-POS-001D keeps negative net values factual and does not relabel them", () => {
  const result = deriveGoldManagedMoneyNet({
    long: {
      observationId: "obs-long",
      seriesKey: "gold.cftc.managed_money.long.contracts",
      value: 40000,
      observedAt: "2026-09-22T00:00:00.000Z",
      retrievedAt: "2026-09-25T19:40:00.000Z",
    },
    short: {
      observationId: "obs-short",
      seriesKey: "gold.cftc.managed_money.short.contracts",
      value: 55000,
      observedAt: "2026-09-22T00:00:00.000Z",
      retrievedAt: "2026-09-25T19:40:00.000Z",
    },
  });

  assert.equal(result.value, -15000);
  assert.equal("direction" in result, false);
  assert.equal("signal" in result, false);
});

test("GOLD-POS-001D rejects mixed report dates", () => {
  assert.throws(
    () => deriveGoldManagedMoneyNet({
      long: {
        observationId: "obs-long",
        seriesKey: "gold.cftc.managed_money.long.contracts",
        value: 210000,
        observedAt: "2026-09-22T00:00:00.000Z",
        retrievedAt: "2026-09-25T19:40:00.000Z",
      },
      short: {
        observationId: "obs-short",
        seriesKey: "gold.cftc.managed_money.short.contracts",
        value: 35000,
        observedAt: "2026-09-15T00:00:00.000Z",
        retrievedAt: "2026-09-25T19:40:00.000Z",
      },
    }),
    /must share one CFTC report date/,
  );
});
