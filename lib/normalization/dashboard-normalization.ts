import type { CalendarForwardCoverage } from "../application/calendar-forward-coverage";
import type { CalendarEvent, NewsItem } from "../data/types";
import type { Context, Evidence, Event, Observation, ProviderHealth } from "../domain/types";
import type { EconomicEventResult } from "../domain/event-result";
import type { ObservationReadQuality } from "../domain/observation-read-quality";
import type { YahooSeriesHealth } from "./yahoo-market-health";

/** Read-side DTO contract. Live dashboard ingestion/normalization was retired. */
export type NormalizedDashboardData = { macroNews: NewsItem[]; cryptoNews: NewsItem[]; calendarEvents: CalendarEvent[]; calendarProviderMessage?: string; calendarForwardCoverage?: CalendarForwardCoverage; unavailableSources: string[]; observations: Observation[]; macroObservations: Observation[]; events: Event[]; economicEventResults: EconomicEventResult[]; contexts: Context[]; evidence: Evidence[]; providerHealth: ProviderHealth[]; yahooSeriesHealth?: YahooSeriesHealth[]; observationReadQuality?: ObservationReadQuality[] };
