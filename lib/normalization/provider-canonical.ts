/**
 * Anti-corruption adapters: data-provider DTOs -> stable canonical builder inputs.
 * Keep all provider imports in the normalization layer, never in lib/domain.
 */
import type { CalendarEvent, NewsItem } from "../data/types";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { DefiLlamaStablecoinObservationInput } from "../data/defillama-stablecoins";
import type { SoSoValueBtcEtfFlowObservationInput } from "../data/sosovalue-etf-flow";
import type { CftcGoldCotObservationInput } from "../data/cftc-gold-cot";
import type { FomcEventInput } from "../data/federal-reserve-events";
import { forexFactoryJurisdiction } from "../data/event-jurisdiction";
import type {
  CalendarCanonicalInput, CanonicalMarketInput, CanonicalLiquidityInput,
  CanonicalEtfFlowInput, CanonicalPositioningInput,
} from "../domain/normalization-inputs";
import {
  newsToEvidence as buildNewsEvidence,
  calendarToCanonicalRecords as buildCalendarRecords,
  cryptoMarketToObservations as buildMarketRecords,
  stablecoinLiquidityToCanonicalRecords as buildStablecoinRecords,
  btcEtfFlowToCanonicalRecords as buildEtfFlowRecords,
  cftcGoldCotToCanonicalRecords as buildPositioningRecords,
  fomcToCanonicalRecords as buildFomcRecords,
} from "../domain/normalize";

export { P365_SOURCES, providerHealthForResult } from "../domain/normalize";
export { macroToCanonicalRecords, federalReserveSepToCanonicalRecords } from "./provider-canonical-macro";

export function newsToEvidence(items: NewsItem[], sourceId: string) {
  return buildNewsEvidence(items.map(({ id, title, summary, category, source, publishedAt, url }) =>
    ({ id, title, summary, category, source, publishedAt, url })), sourceId);
}

export function calendarToCanonicalRecords(items: CalendarEvent[], sourceId: string) {
  const qualified: CalendarCanonicalInput[] = items.map(({ id, event, country, dateISO, impact, status }) =>
    ({ id, event, country, dateISO, impact, status, jurisdiction: forexFactoryJurisdiction(country) }));
  return buildCalendarRecords(qualified, sourceId);
}

export function cryptoMarketToObservations(items: CryptoMarketObservationInput[], sourceId: string) {
  const qualified: CanonicalMarketInput[] = items.map(({ metricId, symbol, value, observedAt, retrievedAt, provenance, freshnessCalendar, metadata }) =>
    ({ metricId, symbol, value, observedAt, retrievedAt, provenance, freshnessCalendar, metadata }));
  return buildMarketRecords(qualified, sourceId);
}

export function stablecoinLiquidityToCanonicalRecords(items: DefiLlamaStablecoinObservationInput[]) {
  const qualified: CanonicalLiquidityInput[] = items.map(({ metricId, value, observedAt, retrievedAt, unit, pegType, provenance, metadata }) =>
    ({ metricId, value, observedAt, retrievedAt, unit, pegType, provenance, metadata }));
  return buildStablecoinRecords(qualified);
}

export function btcEtfFlowToCanonicalRecords(items: SoSoValueBtcEtfFlowObservationInput[]) {
  const qualified: CanonicalEtfFlowInput[] = items.map(({ metricId, value, observedAt, retrievedAt, unit, providerTradingDate, provenance, metadata }) =>
    ({ metricId, value, observedAt, retrievedAt, unit, providerTradingDate, provenance, metadata }));
  return buildEtfFlowRecords(qualified);
}

export function cftcGoldCotToCanonicalRecords(items: CftcGoldCotObservationInput[]) {
  const qualified: CanonicalPositioningInput[] = items.map(({ metricId, value, observedAt, retrievedAt, unit, frequency, reportDate, provenance, metadata }) =>
    ({ metricId, value, observedAt, retrievedAt, unit, frequency, reportDate, provenance, metadata }));
  return buildPositioningRecords(qualified);
}

export function fomcToCanonicalRecords(items: FomcEventInput[], sourceId: string) {
  return buildFomcRecords(items.map(({ scheduledAt, label, sourceUrl }) => ({ scheduledAt, label, sourceUrl })), sourceId);
}
