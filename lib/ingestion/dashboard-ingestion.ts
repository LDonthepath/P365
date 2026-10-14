import type { BiquoteEconomicCalendarRecord } from "../data/biquote-economic-calendar";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { MacroObservationInput } from "../data/fred";
import type { FomcEventInput } from "../data/federal-reserve-events";
import type { CalendarEvent, NewsItem, ProviderResult } from "../data/types";

/** Type-only compatibility contract for historical dashboard normalization. */
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
