import assert from "node:assert/strict";
import test from "node:test";
import type { DefiLlamaStablecoinObservationInput } from "../data/defillama-stablecoins";
import { marketMemoryDedupeKey } from "../data/market-memory-record";
import { InMemoryObservationRepository } from "../repositories/memory";
import { stablecoinLiquidityToCanonicalRecords } from "./normalize";
import { assertCurrentObservationInvariants } from "./observation-provenance";

function input(value: number, retrievedAt: string): DefiLlamaStablecoinObservationInput {
  return {
    metricId: "crypto.usd_stablecoin_market_cap.usd",
    value,
    observedAt: "2026-09-28T00:00:00.000Z",
    retrievedAt,
    providerResource: "/stablecoincharts/all",
    pegType: "peggedUSD",
    unit: "USD",
    provenance: {
      version: "v1",
      providerResource: "/stablecoincharts/all",
      observationDate: "2026-09-28",
    },
    metadata: {
      metricId: "crypto.usd_stablecoin_market_cap.usd",
      unit: "USD",
      pegType: "peggedUSD",
      providerResource: "/stablecoincharts/all",
      providerEffectiveDate: "2026-09-28",
      providerEffectiveTimestamp: "2026-09-28T00:00:00.000Z",
      frequency: "DAILY",
    },
  };
}

test("normalizes DefiLlama stablecoin facts with canonical provenance and append-only revisions", async () => {
  const original = stablecoinLiquidityToCanonicalRecords([
    input(300_000_000_000, "2026-09-29T01:00:00.000Z"),
  ]).observations[0];
  const identicalRefetch = stablecoinLiquidityToCanonicalRecords([
    input(300_000_000_000, "2026-09-29T02:00:00.000Z"),
  ]).observations[0];
  const correction = stablecoinLiquidityToCanonicalRecords([
    input(300_000_000_001, "2026-09-29T03:00:00.000Z"),
  ]).observations[0];
  assert.ok(original && identicalRefetch && correction);

  assert.equal(original.domain, "MARKET");
  assert.deepEqual(original.semantics, {
    ontologyVersion: "v0.1",
    marketDomain: "CRYPTO",
    informationClass: "OBSERVATION",
    jurisdiction: "GLOBAL",
    asset: "USD_STABLECOINS",
  });
  assert.equal(original.sourceId, "defillama-stablecoins");
  assert.deepEqual(original.provenance, {
    version: "v1",
    providerResource: "/stablecoincharts/all",
    observationDate: "2026-09-28",
  });
  assert.equal(original.provenance?.nativeInstrumentId, undefined);
  assert.equal(original.provenance?.nativeSymbol, undefined);
  assert.equal(original.provenance?.nativeSeriesId, undefined);
  assert.equal(original.metadata?.pegType, "peggedUSD");
  assert.equal(original.metadata?.unit, "USD");
  assert.equal(original.quality, "FRESH");

  assert.equal(identicalRefetch.id, original.id, "retrievedAt does not enter factual revision identity");
  assert.equal(identicalRefetch.identity?.revisionFingerprint, original.identity?.revisionFingerprint);
  assert.equal(
    marketMemoryDedupeKey("OBSERVATION", identicalRefetch),
    marketMemoryDedupeKey("OBSERVATION", original),
    "identical refetch remains idempotent",
  );
  assert.equal(correction.identity?.measurementId, original.identity?.measurementId);
  assert.notEqual(correction.identity?.revisionFingerprint, original.identity?.revisionFingerprint);
  assert.notEqual(correction.id, original.id, "same observedAt with changed value creates an append-only revision");

  const history = new InMemoryObservationRepository();
  await history.saveMany([original, identicalRefetch, correction]);
  const revisions = await history.findHistory({
    identity: { domain: "MARKET", seriesKey: "crypto.usd_stablecoin_market_cap.usd" },
    order: "ASC",
    limit: 10,
  });
  assert.deepEqual(revisions.map((item) => item.id), [original.id, correction.id]);

  assert.throws(() => assertCurrentObservationInvariants({
    ...original,
    provenance: { ...original.provenance!, nativeSymbol: "USDT" },
  }), /DefiLlama stablecoin Observation provenance is inconsistent/);
  assert.throws(() => assertCurrentObservationInvariants({
    ...original,
    metadata: { ...original.metadata, pegType: "peggedEUR" },
  }), /DefiLlama stablecoin Observation provenance is inconsistent/);
  assert.throws(() => assertCurrentObservationInvariants({
    ...original,
    sourceId: "another-provider",
  }), /must use its canonical sourceId/);
});
