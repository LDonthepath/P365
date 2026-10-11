import type { CryptoMarketObservationInput } from "../data/crypto-market";
import type { DefiLlamaStablecoinBackfillRange, DefiLlamaStablecoinObservationInput } from "../data/defillama-stablecoins";
import type { FredObservationQuery, MacroObservationInput } from "../data/fred";
import type { FederalReserveSepObservationInput } from "../data/federal-reserve-sep";
import type { GdeltGalFeedSnapshot } from "../data/gdelt-gal";
import type { BinanceSpotKline } from "../data/binance-spot-flow";
import type { BinanceOrderBookSnapshot } from "../data/binance-order-book";
import type { HyperliquidPerpOrderBookSnapshot } from "../data/hyperliquid-perp-order-book";
import { soSoValueBackfillRangeError, type SoSoValueBtcEtfFlowBackfillRange, type SoSoValueBtcEtfFlowObservationInput } from "../data/sosovalue-etf-flow";
import { cftcGoldCotBackfillRangeError, type CftcGoldCotBackfillRange, type CftcGoldCotObservationInput } from "../data/cftc-gold-cot";
import type { ProviderId, ProviderResult } from "../data/types";
import { btcEtfFlowToCanonicalRecords, cftcGoldCotToCanonicalRecords, cryptoMarketToObservations, federalReserveSepToCanonicalRecords, macroToCanonicalRecords, P365_SOURCES, stablecoinLiquidityToCanonicalRecords } from "../normalization/provider-canonical";
import { gdeltGalSnapshotsToEvidence } from "./gdelt-gal-history";
import { buildBinanceBtcSpotFlowWindow } from "./btc-spot-flow";
import { btcSpotFlowWindowsToEvidence } from "./btc-spot-flow-history";
import { buildBin¶»§q«^