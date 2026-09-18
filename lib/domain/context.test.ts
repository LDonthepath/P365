import { buildDashboardContexts } from "./context";
import type { Observation, ObservationDomain } from "./types";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function observation(
  id: string,
  domain: ObservationDomain,
  sourceId: string,
  metricId?: string,
): Observation {
  return {
    id,
    domain,
    subject: metricId ?? id,
    value: "1",
    observedAt: "2026-09-18T00:00:00.000Z",
    retrievedAt: "2026-09-18T00:01:00.000Z",
    sourceId,
    quality: "FRESH",
    evidenceId: `evidence-${id}`,
    metadata: metricId === undefined ? {} : { metricId },
  };
}

function cryptoObservationIds(observations: Observation[]): string[] {
  return buildDashboardContexts({
    observations,
    events: [],
    createdAt: "2026-09-18T00:02:00.000Z",
  }).find((context) => context.scope === "CRYPTO_MARKET")?.observationIds ?? [];
}

function main(): void {
  const qualifiedCrypto = [
    observation("btc-spot", "ASSET", "coingecko-market", "btc.spot.usd"),
    observation("eth-spot", "ASSET", "coingecko-market", "eth.spot.usd"),
    observation("btc-market-cap", "ASSET", "coingecko-market", "btc.market_cap.usd"),
    observation("eth-market-cap", "ASSET", "coingecko-market", "eth.market_cap.usd"),
    observation("total-market-cap", "MARKET", "coingecko-market", "crypto.total_market_cap.usd"),
    observation("total-volume", "MARKET", "coingecko-market", "crypto.total_volume_24h.usd"),
    observation("btc-dominance", "MARKET", "coingecko-market", "crypto.btc_dominance.pct"),
    observation("eth-dominance", "MARKET", "coingecko-market", "crypto.eth_dominance.pct"),
  ];
  const crossAssets = [
    observation("yahoo-gold", "ASSET", "yahoo-finance", "gold.futures.usd"),
    observation("yahoo-russell", "ASSET", "yahoo-finance", "russell2000.index.usd"),
    observation("yahoo-dxy", "ASSET", "yahoo-finance", "dxy.index.usd"),
    observation("fred-sp500", "ASSET", "fred"),
    observation("fred-macro", "MACRO", "fred"),
  ];

  assertEqual(
    cryptoObservationIds([...qualifiedCrypto, ...crossAssets]),
    qualifiedCrypto.map((item) => item.id),
    "mixed input includes the full CoinGecko factual family without cross-asset leakage",
  );
  assertEqual(
    cryptoObservationIds(crossAssets),
    [],
    "no qualified crypto observations produces no CRYPTO_MARKET context",
  );
  assertEqual(
    cryptoObservationIds([
      observation("coingecko-missing-metric", "ASSET", "coingecko-market"),
      observation("coingecko-empty-metric", "MARKET", "coingecko-market", " "),
    ]),
    [],
    "CoinGecko provenance still requires a machine metric identity",
  );

  const [context] = buildDashboardContexts({
    observations: qualifiedCrypto,
    events: [],
    createdAt: "2026-09-18T00:02:00.000Z",
  });
  assertEqual(
    { scope: context?.scope, statement: context?.statement, eventIds: context?.eventIds },
    {
      scope: "CRYPTO_MARKET",
      statement: "Qualified crypto market observations grouped for neutral market monitoring.",
      eventIds: [],
    },
    "CRYPTO_MARKET remains a neutral evidence grouping",
  );
}

main();
