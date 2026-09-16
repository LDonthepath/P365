import "server-only";

import { fetchAlphaVantageCryptoNews, fetchMacroNews } from "../data/alpha-vantage";
import { fetchCoinDeskNews } from "../data/coindesk-rss";
import { fetchEconomicCalendar } from "../data/economic-calendar";
import { fetchCryptoMarketObservations } from "../data/crypto-market";
import { fetchFredMacroObservations } from "../data/fred";
import { fetchFomcEvents } from "../data/federal-reserve-events";
import type { CalendarEvent, NewsItem, ProviderResult } from "../data/types";

export type DashboardIngestion = {
  macroNews: ProviderResult<NewsItem>;
  alphaVantageCryptoNews: ProviderResult<NewsItem>;
  coinDeskNews: ProviderResult<NewsItem>;
  calendar: ProviderResult<CalendarEvent>;
  cryptoMarket: Awaited<ReturnType<typeof fetchCryptoMarketObservations>>;
  fred: Awaited<ReturnType<typeof fetchFredMacroObservations>>;
  fomc: Awaited<ReturnType<typeof fetchFomcEvents>>;
};

function resultOrEmpty<T>(result: PromiseSettledResult<ProviderResult<T>>): ProviderResult<T> {
  if (result.status === "fulfilled") return result.value;
  return {
    status: "ERROR",
    data: [],
    message: result.reason instanceof Error ? result.reason.message : "Provider request failed",
  };
}

export async function ingestDashboardData(): Promise<DashboardIngestion> {
  const [macroResult, alphaVantageCryptoResult, coinDeskResult, calendarResult, cryptoMarketResult, fredResult, fomcResult] =
    await Promise.allSettled([
      fetchMacroNews(6),
      fetchAlphaVantageCryptoNews(4),
      fetchCoinDeskNews(6),
      fetchEconomicCalendar(6),
      fetchCryptoMarketObservations(["BTC", "ETH"]),
      fetchFredMacroObservations(),
      fetchFomcEvents(),
    ]);

  return {
    macroNews: resultOrEmpty(macroResult),
    alphaVantageCryptoNews: resultOrEmpty(alphaVantageCryptoResult),
    coinDeskNews: resultOrEmpty(coinDeskResult),
    calendar: resultOrEmpty(calendarResult),
    cryptoMarket: cryptoMarketResult.status === "fulfilled"
      ? cryptoMarketResult.value
      : { status: "ERROR", data: [], message: cryptoMarketResult.reason instanceof Error ? cryptoMarketResult.reason.message : "Provider request failed" },
    fred: fredResult.status === "fulfilled"
      ? fredResult.value
      : { status: "ERROR", data: [], message: fredResult.reason instanceof Error ? fredResult.reason.message : "Provider request failed" },
    fomc: fomcResult.status === "fulfilled"
      ? fomcResult.value
      : { status: "ERROR", data: [], message: fomcResult.reason instanceof Error ? fomcResult.reason.message : "Provider request failed" },
  };
}
