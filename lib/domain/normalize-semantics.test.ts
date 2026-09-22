import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { MacroObservationInput } from "../data/fred";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { cryptoMarketToObservations, macroToCanonicalRecords } from "./normalize";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function main(): void {
  const dgs10 = MACRO_SERIES_REGISTRY.find((series) => series.seriesId === "DGS10");
  if (!dgs10) throw new Error("DGS10 registry definition missing.");

  const macroInput: MacroObservationInput = {
    series: dgs10,
    value: "4.25",
    observationDate: "2026-09-19",
    previousValue: "4.20",
    vintageDate: "2026-09-19",
    releasedAt: null,
    retrievedAt: "2026-09-20T00:01:00.000Z",
    provenance: {
      version: "v1",
      providerResource: "/fred/series/observations",
      nativeSeriesId: "DGS10",
      observationDate: "2026-09-19",
      vintageDate: "2026-09-19",
    },
  };

  const [treasury] = macroToCanonicalRecords([macroInput], "fred").observations;
  assertEqual(
    treasury?.semantics,
    {
      ontologyVersion: "v0.1",
      marketDomain: "RATES",
      informationClass: "PRICING",
      jurisdiction: "US",
      instrument: "SOVEREIGN_BOND",
      tenor: "10Y",
    },
    "FRED normalization attaches approved semantics",
  );
  assertEqual(treasury?.domain, "MACRO", "legacy FRED domain remains unchanged");

  const marketInputs: CryptoMarketObservationInput[] = [
    {
      metricId: "btc.spot.usd",
      symbol: "BTC",
      value: 65000,
      observedAt: "2026-09-20T00:00:00.000Z",
      retrievedAt: "2026-09-20T00:01:00.000Z",
      source: "CoinGecko",
      freshnessCalendar: "CONTINUOUS_24_7",
      provenance: {
        version: "v1",
        providerResource: "/simple/price",
        nativeInstrumentId: "bitcoin",
      },
      metadata: { unit: "USD" },
    },
    {
      metricId: "gold.futures.usd",
      symbol: "GC=F",
      value: 3700,
      observedAt: "2026-09-20T00:00:00.000Z",
      retrievedAt: "2026-09-20T00:01:00.000Z",
      source: "Yahoo Finance",
      freshnessCalendar: "CME_GLOBEX_GOLD",
      provenance: {
        version: "v1",
        providerResource: "/v8/finance/chart",
        nativeSymbol: "GC=F",
      },
      metadata: { unit: "USD" },
    },
  ];

  const [btc, gold] = cryptoMarketToObservations(marketInputs, "qualified-market-source").observations;

  assertEqual(
    btc?.semantics,
    {
      ontologyVersion: "v0.1",
      marketDomain: "CRYPTO",
      informationClass: "PRICING",
      jurisdiction: "GLOBAL",
      instrument: "CRYPTO_SPOT",
      asset: "BTC",
    },
    "BTC normalization attaches approved semantics",
  );
  assertEqual(btc?.domain, "ASSET", "legacy BTC domain remains unchanged");

  assertEqual(
    gold?.semantics,
    {
      ontologyVersion: "v0.1",
      marketDomain: "COMMODITY",
      informationClass: "PRICING",
      jurisdiction: "GLOBAL",
      instrument: "FUTURE",
      asset: "GOLD",
    },
    "Gold normalization attaches approved semantics",
  );
  assertEqual(gold?.domain, "ASSET", "legacy Gold domain remains unchanged");
}

main();
