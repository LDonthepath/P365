import "server-only";
import type { ProviderResult } from "./types";
import { providerResult } from "./types";
import { providerFetchPolicy, type ProviderAcquisitionMode } from "./provider-fetch-policy";
import type { ObservationProvenance } from "../domain/types";
import type { MarketFreshnessCalendar } from "../domain/freshness";
import { OBSERVATION_PROVIDER_RESOURCES } from "../domain/observation-provenance";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const ASSET_IDS = { BTC: "bitcoin", ETH: "ethereum" } as const;

type CoinGeckoSimplePrice = {
  [id: string]: {
    usd?: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    usd_24h_change?: number;
    last_updated_at?: number;
  };
};

type CoinGeckoGlobal = {
  data?: {
    total_market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    market_cap_percentage?: { btc?: number; eth?: number };
    updated_at?: number;
  };
};

export type CryptoMarketObservationInput = {
  metricId: string;
  symbol: string;
  value: number;
  observedAt: string;
  retrievedAt: string;
  source: string;
  provenance: ObservationProvenance;
  freshnessCalendar: MarketFreshnessCalendar;
  metadata: Record<string, string | number | boolean | null>;
};

function observedAtFromUnix(seconds: number | undefined): string | null {
  if (!Number.isFinite(seconds)) return null;
  const date = new Date(Number(seconds) * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function responseDiagnostics(response: Response): string {
  const diagnostics = [
    ["x-cache", response.headers.get("x-cache")],
    ["x-amz-cf-pop", response.headers.get("x-amz-cf-pop")],
    ["x-amz-cf-id", response.headers.get("x-amz-cf-id")],
  ]
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}=${value}`);
  return diagnostics.length > 0 ? ` [${diagnostics.join(", ")}]` : "";
}

async function fetchCoinGecko<T>(
  path: string,
  params: Record<string, string>,
  acquisitionMode: ProviderAcquisitionMode,
  apiKey: string,
): Promise<T> {
  const url = new URL(`${COINGECKO_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const res = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      "user-agent": "P365/1.0 (+https://github.com/LDonthepath/P365)",
      "x-cg-demo-api-key": apiKey,
    },
    ...providerFetchPolicy(acquisitionMode, 300),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = (await res.text()).replace(/\s+/g, " ").trim().slice(0, 300);
    throw new Error(
      `CoinGecko ${path} HTTP ${res.status}${responseDiagnostics(res)}${detail ? `: ${detail}` : ""}`,
    );
  }
  return (await res.json()) as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "CoinGecko request failed";
}

export async function fetchCryptoMarketObservations(
  symbols: string[] = ["BTC", "ETH"],
  acquisitionMode: ProviderAcquisitionMode = "CACHED",
): Promise<ProviderResult<CryptoMarketObservationInput>> {
  const requestedSymbols = symbols.filter((symbol) => symbol in ASSET_IDS) as Array<keyof typeof ASSET_IDS>;
  if (requestedSymbols.length === 0) {
    return providerResult("coingecko", "EMPTY", [], "No supported crypto symbols requested");
  }

  const apiKey = process.env.COINGECKO_DEMO_API_KEY?.trim();
  if (!apiKey) {
    return providerResult(
      "coingecko",
      "UNAVAILABLE",
      [],
      "COINGECKO_DEMO_API_KEY is not configured",
      "CONFIGURATION",
    );
  }

  const ids = requestedSymbols.map((symbol) => ASSET_IDS[symbol]).join(",");
  const [assetsResult, globalResult] = await Promise.allSettled([
    fetchCoinGecko<CoinGeckoSimplePrice>(
      "/simple/price",
      {
        ids,
        vs_currencies: "usd",
        include_market_cap: "true",
        include_24hr_vol: "true",
        include_24hr_change: "true",
        include_last_updated_at: "true",
      },
      acquisitionMode,
      apiKey,
    ),
    fetchCoinGecko<CoinGeckoGlobal>("/global", {}, acquisitionMode, apiKey),
  ]);

  const data: CryptoMarketObservationInput[] = [];
  if (assetsResult.status === "fulfilled") {
    const assets = assetsResult.value;
    for (const symbol of requestedSymbols) {
      const id = ASSET_IDS[symbol];
      const item = assets[id];
      const observedAt = observedAtFromUnix(item?.last_updated_at);
      if (!item || !observedAt) continue;
      const retrievedAt = new Date().toISOString();
      const baseMetadata = { providerAssetId: id, quote: "USD", endpoint: "/simple/price" };
      const provenance: ObservationProvenance = {
        version: "v1",
        providerResource: OBSERVATION_PROVIDER_RESOURCES.coinGeckoSimplePrice,
        nativeInstrumentId: id,
      };
      if (Number.isFinite(item.usd)) {
        data.push({
          metricId: `${symbol.toLowerCase()}.spot.usd`,
          symbol,
          value: Number(item.usd),
          observedAt,
          retrievedAt,
          source: "CoinGecko",
          provenance,
          freshnessCalendar: "CONTINUOUS_24_7",
          metadata: {
            ...baseMetadata,
            metric: "spot_price",
            unit: "USD",
            changePct: Number.isFinite(item.usd_24h_change) ? Number(item.usd_24h_change) : null,
            changeBasis: "24h",
          },
        });
      }
      if (Number.isFinite(item.usd_market_cap)) {
        data.push({
          metricId: `${symbol.toLowerCase()}.market_cap.usd`,
          symbol,
          value: Number(item.usd_market_cap),
          observedAt,
          retrievedAt,
          source: "CoinGecko",
          provenance,
          freshnessCalendar: "CONTINUOUS_24_7",
          metadata: { ...baseMetadata, metric: "market_cap", unit: "USD" },
        });
      }
    }
  }

  if (globalResult.status === "fulfilled") {
    const globalData = globalResult.value.data;
    const globalObservedAt = observedAtFromUnix(globalData?.updated_at);
    if (globalData && globalObservedAt) {
      const retrievedAt = new Date().toISOString();
      const globalMetrics: Array<{
        metricId: string;
        symbol: string;
        value: number | undefined;
        metric: string;
        unit: string;
      }> = [
        {
          metricId: "crypto.total_market_cap.usd",
          symbol: "TOTAL_CRYPTO",
          value: globalData.total_market_cap?.usd,
          metric: "total_market_cap",
          unit: "USD",
        },
        {
          metricId: "crypto.total_volume_24h.usd",
          symbol: "TOTAL_CRYPTO",
          value: globalData.total_volume?.usd,
          metric: "total_volume_24h",
          unit: "USD",
        },
        {
          metricId: "crypto.btc_dominance.pct",
          symbol: "BTC",
          value: globalData.market_cap_percentage?.btc,
          metric: "btc_dominance",
          unit: "PERCENT",
        },
        {
          metricId: "crypto.eth_dominance.pct",
          symbol: "ETH",
          value: globalData.market_cap_percentage?.eth,
          metric: "eth_dominance",
          unit: "PERCENT",
        },
      ];
      for (const metric of globalMetrics) {
        if (!Number.isFinite(metric.value)) continue;
        data.push({
          metricId: metric.metricId,
          symbol: metric.symbol,
          value: Number(metric.value),
          observedAt: globalObservedAt,
          retrievedAt,
          source: "CoinGecko",
          provenance: { version: "v1", providerResource: OBSERVATION_PROVIDER_RESOURCES.coinGeckoGlobal },
          freshnessCalendar: "CONTINUOUS_24_7",
          metadata: { metric: metric.metric, unit: metric.unit, endpoint: "/global" },
        });
      }
    }
  }

  const failures = [assetsResult, globalResult]
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => errorMessage(result.reason));
  if (failures.length > 0) {
    return providerResult("coingecko", "ERROR", data, failures.join(" | "));
  }
  if (data.length === 0) {
    return providerResult("coingecko", "EMPTY", [], "CoinGecko returned no canonical crypto observations");
  }
  return providerResult("coingecko", "SUCCESS", data);
}
