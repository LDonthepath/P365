import assert from "node:assert/strict";
import test from "node:test";
import { CFTC_GOLD_COT_SERIES_KEYS } from "../domain/observation-semantics";
import type { Observation } from "../domain/types";
import { InMemoryObservationRepository } from "../repositories/memory";
import { buildGoldPositioningReadModel } from "./gold-positioning";

function observation(seriesKey: string, value: string, observedAt = "2026-09-22T00:00:00.000Z"): Observation {
  return {
    id: `obs-${seriesKey}`,
    domain: "MARKET",
    subject: seriesKey,
    value,
    observedAt,
    retrievedAt: "2026-09-25T19:40:00.000Z",
    sourceId: "cftc-gold-cot",
    quality: "UNKNOWN",
    evidenceId: `ev-${seriesKey}`,
    metadata: { metricId: seriesKey, observationEffectiveAt: observedAt },
  };
}

test("builds a coherent latest CFTC Gold positioning view", async () => {
  const repository = new InMemoryObservationRepository();
  await repository.saveMany([
    observation(CFTC_GOLD_COT_SERIES_KEYS.openInterest, "500000"),
    observation(CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong, "210000"),
    observation(CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort, "35000"),
    observation(CFTC_GOLD_COT_SERIES_KEYS.managedMoneySpreading, "25000"),
  ]);

  const result = await buildGoldPositioningReadModel(repository, new Date("2026-10-01T00:00:00.000Z"));
  assert.equal(result.status, "AVAILABLE");
  if (result.status !== "AVAILABLE") return;
  assert.equal(result.reportDate, "2026-09-22");
  assert.equal(result.openInterest.value, 500000);
  assert.equal(result.managedMoney.long.value, 210000);
  assert.equal(result.managedMoney.short.value, 35000);
  assert.equal(result.managedMoney.spreading.value, 25000);
  assert.equal(result.managedMoney.net.value, 175000);
  assert.equal(
    result.managedMoney.net.methodologyId,
    "cftc-gold-managed-money-net-long-minus-short-v1",
  );
  assert.deepEqual(result.managedMoney.net.inputObservationIds, [
    `obs-${CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong}`,
    `obs-${CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort}`,
  ]);
  assert.equal(result.managedMoney.net.spreadingIncluded, false);
});

test("fails closed when the latest CFTC components are not from one report date", async () => {
  const repository = new InMemoryObservationRepository();
  await repository.saveMany([
    observation(CFTC_GOLD_COT_SERIES_KEYS.openInterest, "500000"),
    observation(CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong, "210000"),
    observation(CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort, "35000", "2026-09-15T00:00:00.000Z"),
    observation(CFTC_GOLD_COT_SERIES_KEYS.managedMoneySpreading, "25000"),
  ]);

  const result = await buildGoldPositioningReadModel(repository, new Date("2026-10-01T00:00:00.000Z"));
  assert.equal(result.status, "UNAVAILABLE");
  if (result.status !== "UNAVAILABLE") return;
  assert.match(result.reason, /tanggal laporan yang berbeda/);
});


test("GOLD-POS-001D net knownAt is the later of long/short retrieval availability", async () => {
  const repository = new InMemoryObservationRepository();
  const long = observation(CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong, "210000");
  const short = observation(CFTC_GOLD_COT_SERIES_KEYS.managedMoneyShort, "35000");
  short.retrievedAt = "2026-09-25T19:45:00.000Z";

  await repository.saveMany([
    observation(CFTC_GOLD_COT_SERIES_KEYS.openInterest, "500000"),
    long,
    short,
    observation(CFTC_GOLD_COT_SERIES_KEYS.managedMoneySpreading, "25000"),
  ]);

  const result = await buildGoldPositioningReadModel(
    repository,
    new Date("2026-10-01T00:00:00.000Z"),
  );

  assert.equal(result.status, "AVAILABLE");
  if (result.status !== "AVAILABLE") return;
  assert.equal(result.managedMoney.net.knownAt, "2026-09-25T19:45:00.000Z");
});
