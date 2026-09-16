import "server-only";

import { fetchAlphaVantageCryptoNews, fetchMacroNews } from "../data/alpha-vantage";
import { fetchCoinDeskNews } from "../data/coindesk-rss";
import { fetchEconomicCalendar } from "../data/economic-calendar";
import { fetchCryptoMarketObservations, type CryptoMarketObservationInput } from "../data/crypto-market";
import { fetchFredMacroObservations, type MacroObservationInput } from "../data/fred";
import { fetchFomcEvents, type FomcEventInput } from "../data/federal-reserve-events";
import { providerResult, type CalendarEvent, type NewsItem, type ProviderResult } from "../data/types";

export type DashboardIngestion = {
  macroNews: ProviderResult<NewsItem>;
  alphaVantageCryptoNews: ProviderResult<NewsItem>;
  coinDeskNews: ProviderResult<NewsItem>;
  calendar: ProviderResult<CalendarEvent>;
  cryptoMarket: ProviderResult<CryptoMarketObservationInput>;
  fred: ProviderResult<MacroObservationInput>;
  fomc: ProviderResult<FomcEventInput>;
};

function resultOrEmpty<T>(result: PromiseSettledResult<ProviderResult<T>>, providerId: Parameters<typeof providerResult>[0]): ProviderResult<T> {
  if (result.status === "fulfilled") return result.value;
  return providerResult(providerId, "ERROR", [], result.reason instanceof Error ? result.reason.message : "Provider request failed");
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
    macroNews: resultOrEmpty(macroResult, "alpha-vantage"),
    alphaVantageCryptoNews: resultOrEmpty(alphaVantageCryptoResult, "alpha-vantage"),
    coinDeskNews: resultOrEmpty(coinDeskResult, "coindesk-rss"),
    calendar: resultOrEmpty(calendarResult, "forex-factory"),
    cryptoMarket: resultOrEmpty(cryptoMarketResult, "coingecko"),
    fred: resultOrEmpty(fredResult, "fred"),
    fomc: resultOrEmpty(fomcResult, "federal-reserve"),
  };
}
