import "server-only";

import { fetchAlphaVantageCryptoNews, fetchMacroNews } from "../data/alpha-vantage";
import { fetchCoinDeskNews } from "../data/coindesk-rss";
import { fetchEconomicCalendar } from "../data/economic-calendar";
import { fetchCryptoMarketObservations, type CryptoMarketObservationInput } from "../data/crypto-market";
import { fetchFredMacroObservations, type MacroObservationInput } from "../data/fred";
import { fetchFomcEvents, type FomcEventInput } from "../data/federal-reserve-events";
import type { CalendarEvent, NewsItem, ProviderResult } from "../data/types";

export type DashboardIngestion = {
  macroNews: ProviderResult<NewsItem>;
  alphaVantageCryptoNews: ProviderResult<NewsItem>;
  coinDeskNews: ProviderResult<NewsItem>;
  calendar: ProviderResult<CalendarEvent>;
  cryptoMarket: ProviderResult<CryptoMarketObservationInput>;
  fred: ProviderResult<MacroObservationInput>;
  fomc: ProviderResult<FomcEventInput>;
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
    cryptoMarket: resultOrEmpty(cryptoMarketResult),
    fred: resultOrEmpty(fredResult),
    fomc: resultOrEmpty(fomcResult),
  };
}
