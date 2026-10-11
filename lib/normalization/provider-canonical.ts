/**
 * Anti-corruption adapters: data-provider DTOs -> stable canonical builder inputs.
 * Keep all provider imports in the normalization layer, never in lib/domain.
 */
import type { CalendarEvent, NewsItem } from "../data/types";
import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { DefiLlamaStablecoinObservationInput } from "../data/defillama-stablecoins";
import type { SoSoValueBtcEtfFlowObservationInput } from "../data/sosovalue-etf-flow";
import type { CftcGoldCotObservationInput } from "../data/cftc-gold-cot";
import type { MacroObservationInput } from "../data/fred";
import type { FomcEventInput } from "../data/federal-reserve-events";
import type { FederalReserveSepObservationInput } from "../data/federal-reserve-sep";
import { forexFactoryJurisdiction } from "../data/event-jurisdiction";
import type {
  CalendarCanonicalInput, CanonicalMarketInput, CanonicalLiquidityInput,
  CanonicalEtfFlowInput, CanonicalPositioningInput, CanonicalSepInput,
  CanonicalMacroInput,
} from "../domain/normalization-inputs";
import {
  newsToEvidence as buildNewsEvidence,
  calendarToCanonicalRecords as buildCalendarRecords,
  cryptoMarketToObservations as buildMarketRecords,
  stablecoinLiquidityToCanonicalRecords as buildStablecoinRecords,
  btcEtfFlowToCanonicalRecords as buildEtfFlowRecords,
  cftcGoldCotToCanonicalRecords as buildPositioningRecords,
  federalReserveSepToCanonicalRecords as buildSepRecords,
  macroToCanonicalRecords as buildMacroR¶»§q«^