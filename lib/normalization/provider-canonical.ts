/**
 * Compatibility re-exports for provider canonical adapters.
 * Active macro and calendar ingestion use their dedicated adapter boundaries.
 */
export { P365_SOURCES, providerHealthForResult } from "../domain/normalize";
export { macroToCanonicalRecords, federalReserveSepToCanonicalRecords } from "./provider-canonical-macro";
export { calendarToCanonicalRecords, fomcToCanonicalRecords } from "./provider-canonical-events";
export {
  cryptoMarketToObservations,
  stablecoinLiquidityToCanonicalRecords,
  btcEtfFlowToCanonicalRecords,
  cftcGoldCotToCanonicalRecords,
} from "./provider-canonical-market";
