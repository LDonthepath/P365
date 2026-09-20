import "server-only";
import { fetchAlphaVantageCryptoNews, fetchMacroNews } from "../data/alpha-vantage";
import { fetchDxyIndex, fetchGoldFuturesSpot, fetchRussell2000Index } from "../data/yahoo-finance-markets";
import { fetchCoinDeskNews } from "../data/coindesk-rss";
import { fetchEconomicCalendar } from "../data/economic-calendar";
import { fetchBiquoteEconomicCalendar, type BiquoteEconomicCalendarRecord } from "../data/biquote-economic-calendar";
import { fetchCryptoMarketObservations, type CryptoMarketObservationInput } from "../data/crypto-market";
import { fetchFredMacroObservations, type MacroObservationInput } from "../data/fred";
import { fetchFomcEvents, type FomcEventInput } from "../data/federal-reserve-events";
import { ECONOMIC_CALENDAR_LIMIT, providerResult, type CalendarEvent, type NewsItem, type ProviderResult } from "../data/types";

export type DashboardIngestion = {
  macroNews: ProviderResult<NewsItem>;
  alphaVantageCryptoNews: ProviderResult<NewsItem>;
  coinDeskNews: ProviderResult<NewsItem>;
  calendar: ProviderResult<CalendarEvent>;
  biquoteCalendar: ProviderResult<BiquoteEconomicCalendarRecord>;
  cryptoMarket: ProviderResult<CryptoMarketObservationInput>;
  goldSpot: ProviderResult<CryptoMarketObservationInput>;
  russell2000: ProviderResult<CryptoMarketObservationInput>;
  dxy: ProviderResult<CryptoMarketObservationInput>;
  fred: ProviderResult<MacroObservationInput>;
  fomc: ProviderResult<FomcEventInput>;
};

function resultOrEmpty<T>(
  result: PromiseSettledResult<ProviderResult<T>>,
  providerId: Parameters<typeof providerResult>[0],
): ProviderResult<T> {
  if (result.status === "fulfilled") return result.value;
  return providerResult(
    providerId,
    "ERROR",
    [],
    result.reason instanceof Error ? result.reason.message : "Provider request failed",
  );
}

export async function ingestDashboardData(): Promise<DashboardIngestion> {
  const [
    macroResult,
    alphaVantageCryptoResult,
    coinDeskResult,
    calendarResult,
    biquoteCalendarResult,
    cryptoMarketResult,
    goldResult,
    russellResult,
    dxyResult,
    fredResult,
    fomcResult,
  ] = await Promise.allSettled([
    fetchMacroNews(6),
    fetchAlphaVantageCryptoNews(4),
    fetchCoinDeskNews(6),
    fetchEconomicCalendar(ECONOMIC_CALENDAR_LIMIT),
    fetchBiquoteEconomicCalendar({ limit: 50 }),
    fetchCryptoMarketObservations(["BTC", "ETH"]),
    fetchGoldFuturesSpot(),
    fetchRussell2000Index(),
    fetchDxyIndex(),
    fetchFredMacroObservations(),
    fetchFomcEvents(),
  ]);

  return {
    macroNews: resultOrEmpty(macroResult, "alpha-vantage"),
    alphaVantageCryptoNews: resultOrEmpty(alphaVantageCryptoResult, "alpha-vantage"),
    coinDeskNews: resultOrEmpty(coinDeskResult, "coindesk-rss"),
    calendar: resultOrEmpty(calendarResult, "forex-factory"),
    biquoteCalendar: resultOrEmpty(biquoteCalendarResult, "biquote"),
    cryptoMarket: resultOrEmpty(cryptoMarketResult, "coingecko"),
    goldSpot: resultOrEmpty(goldResult, "yahoo-finance"),
    russell2000: resultOrEmpty(russellResult, "yahoo-finance"),
    dxy: resultOrEmpty(dxyResult, "yahoo-finance"),
    fred: resultOrEmpty(fredResult, "fred"),
    fomc: resultOrEmpty(fomcResult, "federal-reserve"),
  };
}
