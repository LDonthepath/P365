import "server-only";
import type { ProviderResult } from "./types";

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

type AlphaVantageRateResponse = {
  [key: string]: unknown;
  "Realtime Currency Exchange Rate"?: {
    "1. From_Currency Code"?: string;
    "2. From_Currency Name"?: string;
    "3. To_Currency Code"?: string;
    "3. To_Currency Name"?: string;
    "4. To_Currency Name"?: string;
    "5. Exchange Rate"?: string;
    "6. Last Refreshed"?: string;
    "7. Time Zone"?: string;
    "8. Bid Price"?: string;
    "9. Ask Price"?: string;
  };
};

export type CryptoMarketObservationInput = {
  symbol: string;
  value: number;
  observedAt: string;
  source: string;
  metadata: Record<string, string | number | boolean | null>;
};

async function fetchRate(symbol: string): Promise<CryptoMarketObservationInput | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return null;

  const url = new URL(ALPHA_VANTAGE_BASE);
  url.searchParams.set("function", "CURRENCY_EXCHANGE_RATE");
  url.searchParams.set("from_currency", symbol);
  url.searchParams.set("to_currency", "USD");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 300, tags: ["p365-dashboard"] }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);

  const payload = (await res.json()) as AlphaVantageRateResponse;
  const rate = payload["Realtime Currency Exchange Rate"];
  const value = Number(rate?.["5. Exchange Rate"]);
  if (!rate || !Number.isFinite(value)) return null;

  const observedAt = rate["6. Last Refreshed"];
  const observedDate = observedAt ? new Date(`${observedAt.replace(" ", "T")}Z`) : null;
  if (!observedDate || !Number.isFinite(observedDate.getTime())) return null;

  return {
    symbol,
    value,
    observedAt: observedDate.toISOString(),
    source: "Alpha Vantage",
    metadata: {
      seriesId: `${symbol}/USD:SPOT`,
      frequency: "REALTIME",
      unit: "USD",
      quote: "USD",
      bid: Number(rate["8. Bid Price"] ?? NaN),
      ask: Number(rate["9. Ask Price"] ?? NaN),
      timezone: rate["7. Time Zone"] ?? null,
    },
  };
}

export async function fetchCryptoMarketObservations(
  symbols: string[] = ["BTC", "ETH"],
): Promise<ProviderResult<CryptoMarketObservationInput>> {
  if (!process.env.ALPHA_VANTAGE_API_KEY) {
    return { status: "UNAVAILABLE", data: [], message: "ALPHA_VANTAGE_API_KEY is not configured" };
  }

  const results = await Promise.allSettled(symbols.map(fetchRate));
  const data: CryptoMarketObservationInput[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value) data.push(result.value);
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : "Crypto market provider request failed");
    }
  }

  if (data.length > 0) return { status: "SUCCESS", data, message: errors.length ? errors.join("; ") : undefined };
  if (errors.length > 0) return { status: "ERROR", data: [], message: errors.join("; ") };
  return { status: "EMPTY", data: [] };
}
