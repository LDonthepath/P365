import assert from "node:assert/strict";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { MacroObservationInput } from "../data/fred";
import { MACRO_SERIES_REGISTRY, type MacroSeriesDefinition } from "../data/macro-registry";
import { InMemoryObservationRepository } from "../repositories/memory";
import { cryptoMarketToObservations, macroToCanonicalRecords } from "./normalize";
import { assertObservationProvenance } from "./observation-provenance";
import type { Observation } from "./types";

const cpiDefinition = MACRO_SERIES_REGISTRY.find((series) => series.seriesId === "CPIAUCSL");
if (!cpiDefinition) throw new Error("CPIAUCSL registry definition missing.");
const cpi: MacroSeriesDefinition = cpiDefinition;

function macroInput(overrides: Partial<MacroObservationInput> = {}): MacroObservationInput {
  return {
    series: cpi,
    value: "334.1",
    observationDate: "2026-08-01",
    previousValue: "333.5",
    vintageDate: "2026-09-01",
    releasedAt: null,
    retrievedAt: "2026-09-01T12:00:00.000Z",
    provenance: {
      version: "v1",
      providerResource: "/fred/series/observations",
      nativeSeriesId: "CPIAUCSL",
      observationDate: "2026-08-01",
      vintageDate: "2026-09-01",
    },
    ...overrides,
  };
}

function marketInput(
  metricId: string,
  symbol: string,
  provenance: CryptoMarketObservationInput["provenance"],
): CryptoMarketObservationInput {
  return {
    metricId,
    symbol,
    value: 100,
    observedAt: "2026-09-20T09:00:00.000Z",
    retrievedAt: "2026-09-20T09:00:01.000Z",
    source: metricId.startsWith("crypto.") || metricId.startsWith("btc.") || metricId.startsWith("eth.")
      ? "CoinGecko"
      : "Yahoo Finance",
    provenance,
    metadata: {
      unit: metricId.endsWith("pct") ? "PERCENT" : "USD",
      endpoint: provenance.providerResource === "/v8/finance/chart"
        ? "v8/finance/chart"
        : provenance.providerResource,
      ...(provenance.nativeInstrumentId ? { providerAssetId: provenance.nativeInstrumentId } : {}),
    },
  };
}

function normalizeMacro(input: MacroObservationInput = macroInput()): Observation {
  const observation = macroToCanonicalRecords([input], "fred").observations[0];
  assert.ok(observation);
  return observation;
}

function assertThrowsMessage(action: () => unknown, pattern: RegExp): void {
  assert.throws(action, pattern);
}

async function main(): Promise<void> {
  const fred = normalizeMacro();
  assert.deepEqual(fred.provenance, {
    version: "v1",
    providerResource: "/fred/series/observations",
    nativeSeriesId: "CPIAUCSL",
    observationDate: "2026-08-01",
    vintageDate: "2026-09-01",
  });
  assert.equal("releasedAt" in fred, false, "Observation must not fabricate a release timestamp");
  assert.equal(fred.metadata?.releasedAt, null, "unknown FRED release remains explicitly missing");
  assert.equal(fred.metadata?.seriesId, "CPIAUCSL");
  assert.equal(fred.metadata?.observationDate, "2026-08-01");
  assert.equal(fred.metadata?.vintageDate, "2026-09-01");
  assert.equal(fred.metadata?.unit, cpi.unit);
  assert.equal(fred.metadata?.frequency, cpi.frequency);

  const laterVintage = normalizeMacro(macroInput({
    retrievedAt: "2026-09-02T12:00:00.000Z",
    vintageDate: "2026-09-02",
    provenance: {
      version: "v1",
      providerResource: "/fred/series/observations",
      nativeSeriesId: "CPIAUCSL",
      observationDate: "2026-08-01",
      vintageDate: "2026-09-02",
    },
  }));
  assert.equal(laterVintage.id, fred.id, "provenance enrichment and retrieval alone cannot create a revision");
  assert.equal(laterVintage.identity?.revisionFingerprint, fred.identity?.revisionFingerprint);

  const coinInputs = [
    marketInput("btc.spot.usd", "BTC", {
      version: "v1",
      providerResource: "/simple/price",
      nativeInstrumentId: "bitcoin",
    }),
    marketInput("eth.spot.usd", "ETH", {
      version: "v1",
      providerResource: "/simple/price",
      nativeInstrumentId: "ethereum",
    }),
    marketInput("crypto.total_market_cap.usd", "TOTAL_CRYPTO", {
      version: "v1",
      providerResource: "/global",
    }),
  ];
  const coin = cryptoMarketToObservations(coinInputs, "coingecko-market").observations;
  assert.equal(coin[0]?.provenance?.nativeInstrumentId, "bitcoin");
  assert.equal(coin[1]?.provenance?.nativeInstrumentId, "ethereum");
  assert.equal(coin[0]?.provenance?.providerResource, "/simple/price");
  assert.deepEqual(coin[2]?.provenance, { version: "v1", providerResource: "/global" });
  assert.equal(coin[2]?.provenance?.nativeInstrumentId, undefined, "global aggregate must not fabricate an asset ID");
  assert.equal(coin[0]?.metadata?.metricId, "btc.spot.usd");
  assert.equal(coin[0]?.metadata?.symbol, "BTC");
  assert.equal(coin[0]?.metadata?.providerAssetId, "bitcoin");

  const yahooInputs = [
    ["gold.futures.usd", "GC=F"],
    ["russell2000.index.usd", "^RUT"],
    ["dxy.index.usd", "DX-Y.NYB"],
  ].map(([metricId, symbol]) => marketInput(metricId, symbol, {
    version: "v1",
    providerResource: "/v8/finance/chart",
    nativeSymbol: symbol,
  }));
  const yahoo = cryptoMarketToObservations(yahooInputs, "yahoo-finance").observations;
  assert.deepEqual(yahoo.map((item) => item.provenance?.nativeSymbol), ["GC=F", "^RUT", "DX-Y.NYB"]);
  assert.ok(yahoo.every((item) => item.provenance?.providerResource === "/v8/finance/chart"));
  assert.deepEqual(yahoo.map((item) => item.metadata?.symbol), ["GC=F", "^RUT", "DX-Y.NYB"]);
  assert.deepEqual(yahoo.map((item) => item.metadata?.metricId), yahooInputs.map((item) => item.metricId));
  assert.doesNotMatch(
    JSON.stringify([fred, ...coin, ...yahoo]),
    /(api[_-]?key|authorization|bearer|token|secret|credential)/i,
    "persisted provenance must not contain credential material",
  );

  assertThrowsMessage(() => cryptoMarketToObservations([marketInput("btc.spot.usd", "BTC", {
    version: "v1",
    providerResource: "/simple/price",
    nativeInstrumentId: " ",
  })], "coingecko-market"), /nativeInstrumentId must be non-empty/);
  assertThrowsMessage(() => cryptoMarketToObservations([marketInput("crypto.total_market_cap.usd", "TOTAL_CRYPTO", {
    version: "v1",
    providerResource: "/global",
    nativeInstrumentId: "fabricated-global-asset",
  })], "coingecko-market"), /must not fabricate/);
  assertThrowsMessage(() => normalizeMacro(macroInput({
    provenance: {
      version: "v1",
      providerResource: "/fred/series/observations?api_key=do-not-persist",
      nativeSeriesId: "CPIAUCSL",
      observationDate: "2026-08-01",
      vintageDate: "2026-09-01",
    },
  })), /credential-free path/);
  assertThrowsMessage(() => normalizeMacro(macroInput({
    provenance: {
      version: "v1",
      providerResource: "/fred/series/observations",
      nativeSeriesId: "WRONG",
      observationDate: "2026-08-01",
      vintageDate: "2026-09-01",
    },
  })), /inconsistent/);
  assertThrowsMessage(() => macroToCanonicalRecords([macroInput()], " "), /sourceId must be non-empty/);
  assertThrowsMessage(() => assertObservationProvenance({
    version: "v1",
    providerResource: "/authorization/token",
  }), /must not contain credentials/);

  const history = new InMemoryObservationRepository();
  const legacy: Observation = {
    id: "legacy-cpi",
    domain: "MACRO",
    subject: "Legacy CPI",
    value: "333.5",
    observedAt: "2026-07-01",
    retrievedAt: "2026-08-15T00:00:00.000Z",
    sourceId: "fred",
    quality: "FRESH",
    evidenceId: "legacy-evidence",
    metadata: { seriesId: "CPIAUCSL", unit: cpi.unit, frequency: cpi.frequency },
  };
  await history.saveMany([fred, laterVintage, legacy]);
  const beforeCurrentAcquisition = await history.findHistory({
    identity: { domain: "MACRO", seriesKey: "CPIAUCSL" },
    retrievedAtOnOrBefore: "2026-08-31T23:59:59.999Z",
    order: "ASC",
    limit: 10,
  });
  assert.deepEqual(beforeCurrentAcquisition.map((item) => item.id), [legacy.id]);
  const afterCurrentAcquisition = await history.findHistory({
    identity: { domain: "MACRO", seriesKey: "CPIAUCSL" },
    retrievedAtOnOrBefore: fred.retrievedAt,
    order: "ASC",
    limit: 10,
  });
  assert.deepEqual(afterCurrentAcquisition.map((item) => item.id), [legacy.id, fred.id]);
  assert.equal(afterCurrentAcquisition[0]?.provenance, undefined, "legacy rows remain readable without provenance");
}

void main();
