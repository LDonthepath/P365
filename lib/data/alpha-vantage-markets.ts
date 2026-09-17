import "server-only";
import { providerResult, type ProviderResult } from "./types";
import type { CryptoMarketObservationInput } from "./crypto-market";

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

// Gold/Russell don't need minute-level freshness for a regime-context dashboard;
// a long revalidate window protects the shared Alpha Vantage daily quota
// (25 requests/day on the free tier) already used by macro/crypto news.
const REVALIDATE_SECONDS = 6 * 60 * 60;

type AlphaVantageDiagnostic = { Note?: unknown; Information?: unknown; ErrorMessage?: unknown };

function providerDiagnostic(data: AlphaVantageDiagnostic): string | undefined {
  const diagnostic = data.Note ?? data.Information ?? data.ErrorMessage;
  return typeof diagnostic === "string" && diagnostic.trim() ? diagnostic.trim() : undefined;
}

async function fetchAlphaVantage<T extends AlphaVantageDiagnostic>(
  params: Record<string, string>,
): Promise<{ data: T } | { error: ProviderResult<CryptoMarketObservationInput> }> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return { error: providerResult("alpha-vantage", "UNAVAILABLE", [], "ALPHA_VANTAGE_API_KEY is not configured") };

  const url = new URL(ALPHA_VANTAGE_BASE);
  url.searchParams.set("apikey", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: REVALIDATE_SECONDS, tags: ["p365-dashboard"] }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { error: providerResult("alpha-vantage", "ERROR", [], `Alpha Vantage HTTP ${res.status}`) };

    const data = (await res.json()) as T;
    const diagnostic = providerDiagnostic(data);
    if (diagnostic) return { error: providerResult("alpha-vantage", "ERROR", [], diagnostic) };
    return { data };
  } catch (error) {
    return { error: providerResult("alpha-vantage", "ERROR", [], error instanceof Error ? error.message : "Alpha Vantage request failed") };
  }
}

type GoldSilverSpotResponse = AlphaVantageDiagnostic & { nominal?: string; timestamp?: string; price?: string };

export async function fetchGoldSpot(): Promise<ProviderResult<CryptoMarketObservationInput>> {
  const result = await fetchAlphaVantage<GoldSilverSpotResponse>({ function: "GOLD_SILVER_SPOT", symbol: "GOLD" });
  if ("error" in result) return result.error;

  const { data } = result;
  const value = Number(data.price);
  const observedAt = data.timestamp ? new Date(data.timestamp.replace(" ", "T") + "Z").toISOString() : null;
  if (!Number.isFinite(value) || !observedAt || !Number.isFinite(new Date(observedAt).getTime())) {
    return providerResult("alpha-vantage", "EMPTY", [], "Alpha Vantage returned no gold spot price");
  }

  const retrievedAt = new Date().toISOString();
  return providerResult("alpha-vantage", "SUCCESS", [{
    metricId: "gold.spot.usd",
    symbol: "XAUUSD",
    value,
    observedAt,
    retrievedAt,
    source: "Alpha Vantage",
    metadata: { metric: "spot_price", unit: "USD", endpoint: "GOLD_SILVER_SPOT" },
  }]);
}

type GlobalQuoteResponse = AlphaVantageDiagnostic & {
  "Global Quote"?: { "01. symbol"?: string; "05. price"?: string; "07. latest trading day"?: string };
};

export async function fetchRussell2000Proxy(): Promise<ProviderResult<CryptoMarketObservationInput>> {
  const result = await fetchAlphaVantage<GlobalQuoteResponse>({ function: "GLOBAL_QUOTE", symbol: "IWM" });
  if ("error" in result) return result.error;

  const quote = result.data["Global Quote"];
  const value = Number(quote?.["05. price"]);
  const tradingDay = quote?.["07. latest trading day"];
  if (!Number.isFinite(value) || !tradingDay) {
    return providerResult("alpha-vantage", "EMPTY", [], "Alpha Vantage returned no IWM quote");
  }

  const observedAt = new Date(`${tradingDay}T00:00:00.000Z`).toISOString();
  const retrievedAt = new Date().toISOString();
  return providerResult("alpha-vantage", "SUCCESS", [{
    metricId: "russell2000.proxy_iwm.usd",
    symbol: "IWM",
    value,
    observedAt,
    retrievedAt,
    source: "Alpha Vantage",
    metadata: { metric: "spot_price", unit: "USD", endpoint: "GLOBAL_QUOTE", proxyFor: "Russell 2000", note: "IWM ETF is a tracking proxy, not the raw index" },
  }]);
}
