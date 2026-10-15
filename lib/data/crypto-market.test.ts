import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CryptoMarketObservationInput } from "./crypto-market";

test("MACRO-CUT-003O: retained CoinGecko market DTO compiles with historical provenance and freshness", () => {
  const row: CryptoMarketObservationInput = {
    metricId: "btc.spot.usd",
    symbol: "BTC",
    value: 65000,
    observedAt: "2026-09-20T00:00:00.000Z",
    retrievedAt: "2026-09-20T00:01:00.000Z",
    source: "CoinGecko",
    provenance: {
      version: "v1",
      providerResource: "/simple/price",
      nativeInstrumentId: "bitcoin",
    },
    freshnessCalendar: "CONTINUOUS_24_7",
    metadata: {
      unit: "USD",
      providerAssetId: "bitcoin",
      changePct: null,
      changeBasis: "24h",
    },
  };
  assert.equal(row.metricId, "btc.spot.usd");
  assert.equal(row.provenance.nativeInstrumentId, "bitcoin");
  assert.equal(row.freshnessCalendar, "CONTINUOUS_24_7");
  assert.equal(row.metadata.changePct, null);
});

test("MACRO-CUT-003O: retired CoinGecko HTTP client absent; historical DTO and source mapping preserved", () => {
  const source = readFileSync(new URL("./crypto-market.ts", import.meta.url), "utf8");
  const historical = readFileSync(new URL("../application/historical-ingestion-normalization.ts", import.meta.url), "utf8");
  const contract = readFileSync(new URL("../application/historical-ingestion-contract.ts", import.meta.url), "utf8");
  const provenance = readFileSync(new URL("../domain/observation-provenance.ts", import.meta.url), "utf8");
  assert.match(source, /export type CryptoMarketObservationInput =/);
  assert.ok(source.split("\n").filter((line) => line.startsWith("import ")).every((line) => line.startsWith("import type ")));
  assert.doesNotMatch(source, /server-only|fetchCryptoMarketObservations|fetchCoinGecko|api\.coingecko\.com|providerFetchPolicy|\bfetch\(/);
  assert.match(historical, /import type \{ CryptoMarketObservationInput \} from "\.\.\/data\/crypto-market"/);
  assert.match(contract, /import type \{ CryptoMarketObservationInput \} from "\.\.\/data\/crypto-market"/);
  assert.match(provenance, /coinGeckoSimplePrice: "\/simple\/price"/);
});
