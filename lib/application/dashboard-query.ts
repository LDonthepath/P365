import "server-only";
import { beginMarketReadContext, completeMarketReadContext, type MarketReadContext } from "./market-read-context";
import type { FactualBaseline } from "../domain/baseline";
import { readDurableDashboardData } from "./durable-dashboard-read";
import type { NormalizedDashboardData } from "../normalization/dashboard-normalization";
import { historicalEventRepository, historicalEvidenceRepository, historicalObservationRepository } from "../repositories/dashboard-repository";
import type { Event, Evidence } from "../domain/types";
import {
  BTC_ETF_NET_FLOW_SERIES_KEY,
  USD_STABLECOIN_MARKET_CAP_SERIES_KEY,
} from "../domain/observation-semantics";
import { buildRepositoryBackedMacroFactualBaselines } from "./factual-baseline";
import { getIntradayEventMonitor, type IntradayEventMonitorResult } from "./intraday-event-monitor";
import { buildBriefingEventRepricing } from "./briefing-event-repricing";
import { buildBriefingConfirmation } from "./briefing-confirmation";
import { buildNetLiquidityReadModel, type NetLiquidityReadModel } from "./net-liquidity";
import { buildCentralBankBalanceSheetReadModel, type CentralBankBalanceSheetReadModel } from "./central-bank-balance-sheets";
import { readDxyMacroHistory, buildRatesInflationReadModel, type RatesInflationReadModel } from "./rates-inflation";
import {
  buildCreditFinancialConditionsReadModel,
  type CreditFinancialConditionsReadModel,
} from "./credit-financial-conditions";
import {
  buildMacroCryptoGoldFactualContext,
  type MacroCryptoGoldFactualContext,
} from "./mvp-factual-context";
import { buildStablecoinLiquidityReadModel, type StablecoinLiquidityReadModel } from "./stablecoin-liquidity";
import { buildBtcEtfFlowReadModel, type BtcEtfFlowReadModel } from "./btc-etf-flow";
import { buildGoldPositioningReadModel, type GoldPositioningReadModel } from "./gold-positioning";
import { withHistoricalObservationConcurrencyLimit } from "./historical-observation-concurrency";
import {
  composeFactualMarketBriefing,
  type FactualMarketBriefing,
} from "./factual-market-briefing";
import { buildCatalystWireReadModel, type CatalystWireReadModel } from "./catalyst-wire";
import { buildStandaloneMarketContextReadModel, type StandaloneMarketContextReadModel } from "./standalone-market-context";
import { buildMaterialMoveMonitor, type MaterialMoveMonitorReadModel } from "./material-move-monitor";

export type DashboardData = NormalizedDashboardData & {
  marketReadContext: MarketReadContext;
  macroBaselines: Record<string, FactualBaseline>;
  intradayEventMonitor: IntradayEventMonitorResult;
  durableHighImpactEvents: Event[];
  netLiquidity: NetLiquidityReadModel;
  centralBankBalanceSheets: CentralBankBalanceSheetReadModel;
  ratesInflation: RatesInflationReadModel;
  creditFinancialConditions: CreditFinancialConditionsReadModel;
  mvpFactualContext: MacroCryptoGoldFactualContext;
  stablecoinLiquidity: StablecoinLiquidityReadModel;
  btcEtfFlow: BtcEtfFlowReadModel;
  goldPositioning: GoldPositioningReadModel;
  factualMarketBriefing: FactualMarketBriefing;
  catalystWire: CatalystWireReadModel;
  standaloneMarketContext: StandaloneMarketContextReadModel;
  materialMoveMonitor: MaterialMoveMonitorReadModel;
};

type DurableHighImpactEventBundle = {
  display: Event[];
  contextHistory: Event[];
  contextComplete: boolean;
};

type ReadEvidenceResult = { rows: Evidence[]; succeeded: boolean };

async function getRecentGdeltEvidence(asOf: Date): Promise<ReadEvidenceResult> {
  const from = new Date(asOf.getTime() - 2 * 60 * 60_000).toISOString();
  try {
    const rows = await historicalEvidenceRepository.findHistory({
      sourceId: "gdelt",
      kind: "NEWS",
      effectiveAtOnOrAfter: from,
      retrievedAtOnOrBefore: asOf.toISOString(),
      order: "DESC",
      limit: 20,
    });
    return { rows, succeeded: true };
  } catch (error) {
    console.error(
      "Durable GDELT Catalyst Wire read failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return { rows: [], succeeded: false };
  }
}

async function getRecentBinanceEvidence(asOf: Date): Promise<ReadEvidenceResult> {
  const from = new Date(asOf.getTime() - 45 * 60_000).toISOString();
  try {
    const rows = await historicalEvidenceRepository.findHistory({
      sourceId: "binance-spot",
      kind: "OBSERVATION",
      effectiveAtOnOrAfter: from,
      retrievedAtOnOrBefore: asOf.toISOString(),
      order: "DESC",
      limit: 30,
    });
    // The presentation layer qualifies exact 5m identity and complete windows.
    return { rows, succeeded: true };
  } catch (error) {
    console.error(
      "Durable Binance standalone context read failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return { rows: [], succeeded: false };
  }
}

async function getDurableHighImpactEventBundle(
  now = new Date(),
): Promise<DurableHighImpactEventBundle> {
  const contextFromMs = now.getTime() - 7 * 24 * 60 * 60_000;
  const displayFromMs = now.getTime() - 30 * 60_000;
  const throughMs = now.getTime() + 24 * 60 * 60_000;
  const from = new Date(contextFromMs).toISOString();
  const through = new Date(throughMs).toISOString();

  try {
    const history = await historicalEventRepository.findHistory({
      scheduledAtOnOrAfter: from,
      scheduledAtOnOrBefore: through,
      retrievedAtOnOrBefore: now.toISOString(),
      importance: "HIGH",
      order: "ASC",
      limit: 500,
    });

    const latest = new Map<string, Event>();
    for (const event of history) {
      const key = event.identity?.key ?? event.id;
      const current = latest.get(key);
      if (
        !current
        || Date.parse(event.retrievedAt) >= Date.parse(current.retrievedAt)
      ) {
        latest.set(key, event);
      }
    }

    const display = [...latest.values()]
      .filter((event) => {
        const scheduledAt = Date.parse(event.scheduledAt ?? "");
        return Number.isFinite(scheduledAt)
          && scheduledAt >= displayFromMs
          && scheduledAt <= throughMs;
      })
      .sort(
        (a, b) =>
          Date.parse(a.scheduledAt ?? "") - Date.parse(b.scheduledAt ?? ""),
      );

    return {
      display,
      contextHistory: history,
      contextComplete: history.length < 500,
    };
  } catch (error) {
    console.error(
      "Durable high-impact event read failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return {
      display: [],
      contextHistory: [],
      contextComplete: false,
    };
  }
}

function stripIntradayRepricingSource(
  result: IntradayEventMonitorResult,
): IntradayEventMonitorResult {
  if (result.status !== "OK") return result;
  return {
    status: "OK",
    data: result.data.map(({ repricingSource: _repricingSource, ...item }) => item),
  };
}

const dashboardHistoricalObservationRepository = withHistoricalObservationConcurrencyLimit(
  historicalObservationRepository,
  4,
);

function dashboardReadError(label: string, error: unknown): void {
  console.error(
    `${label} failed closed:`,
    error instanceof Error ? error.message : "unknown error",
  );
}

async function buildDashboardNetLiquidity(asOf: Date): Promise<NetLiquidityReadModel> {
  try {
    return await buildNetLiquidityReadModel(dashboardHistoricalObservationRepository, asOf);
  } catch (error) {
    dashboardReadError("Dashboard net liquidity durable read", error);
    return {
      status: "UNAVAILABLE",
      reason: "Data likuiditas sedang tidak dapat dibaca.",
    };
  }
}

async function buildDashboardStablecoinLiquidity(
  asOf: Date,
): Promise<StablecoinLiquidityReadModel> {
  try {
    return await buildStablecoinLiquidityReadModel(
      dashboardHistoricalObservationRepository,
      asOf,
    );
  } catch (error) {
    dashboardReadError("Dashboard stablecoin liquidity durable read", error);
    return {
      asOf: asOf.toISOString(),
      seriesKey: USD_STABLECOIN_MARKET_CAP_SERIES_KEY,
      latest: null,
      change1d: null,
      change1w: null,
      change4w: null,
    };
  }
}

async function buildDashboardBtcEtfFlow(asOf: Date): Promise<BtcEtfFlowReadModel> {
  try {
    return await buildBtcEtfFlowReadModel(
      dashboardHistoricalObservationRepository,
      asOf,
    );
  } catch (error) {
    dashboardReadError("Dashboard BTC ETF flow durable read", error);
    return {
      asOf: asOf.toISOString(),
      seriesKey: BTC_ETF_NET_FLOW_SERIES_KEY,
      latest: null,
      previous: null,
      recent: [],
    };
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const readContext = beginMarketReadContext(new Date());
  const asOf = new Date(readContext.knowledgeAsOf);
  // A dashboard GET composes only already-persisted evidence. Cron ingestion is
  // a separate write-side capability and is never called during rendering.
  const intradayEventMonitorPromise = getIntradayEventMonitor();
  const durableHighImpactEventBundlePromise = getDurableHighImpactEventBundle(asOf);
  const netLiquidityPromise = buildDashboardNetLiquidity(asOf);
  const centralBankBalanceSheetsPromise = buildCentralBankBalanceSheetReadModel(
    dashboardHistoricalObservationRepository, asOf,
  );
  const dxyHistoryPromise = readDxyMacroHistory(dashboardHistoricalObservationRepository, asOf);
  const ratesInflationPromise = buildRatesInflationReadModel(dashboardHistoricalObservationRepository, asOf, dxyHistoryPromise);
  const creditFinancialConditionsPromise = buildCreditFinancialConditionsReadModel(
    dashboardHistoricalObservationRepository,
    asOf,
  );
  const mvpFactualContextPromise = buildMacroCryptoGoldFactualContext(
    dashboardHistoricalObservationRepository,
    asOf,
    {
      netLiquidity: netLiquidityPromise,
      ratesInflation: ratesInflationPromise,
      dxyHistory: dxyHistoryPromise,
    },
  );
  const stablecoinLiquidityPromise = buildDashboardStablecoinLiquidity(asOf);
  const btcEtfFlowPromise = buildDashboardBtcEtfFlow(asOf);
  const goldPositioningPromise = buildGoldPositioningReadModel(dashboardHistoricalObservationRepository, asOf);
  const recentGdeltEvidencePromise = getRecentGdeltEvidence(asOf);
  const recentBinanceEvidencePromise = getRecentBinanceEvidence(asOf);
  const materialMoveMonitorPromise = buildMaterialMoveMonitor({
    observations: dashboardHistoricalObservationRepository,
    events: historicalEventRepository,
    evidence: historicalEvidenceRepository,
    asOf: asOf.toISOString(),
  });
  const normalized = await readDurableDashboardData(asOf, {
    observations: dashboardHistoricalObservationRepository,
    evidence: historicalEvidenceRepository,
    events: historicalEventRepository,
  });

  const [
    macroBaselines,
    intradayEventMonitor,
    durableHighImpactEventBundle,
    netLiquidity,
    centralBankBalanceSheets,
    ratesInflation,
    creditFinancialConditions,
    mvpFactualContext,
    stablecoinLiquidity,
    btcEtfFlow,
    goldPositioning,
    recentGdeltEvidenceResult,
    recentBinanceEvidenceResult,
    materialMoveMonitor,
  ] = await Promise.all([
    buildRepositoryBackedMacroFactualBaselines(
      normalized.macroObservations,
      dashboardHistoricalObservationRepository,
    ),
    intradayEventMonitorPromise,
    durableHighImpactEventBundlePromise,
    netLiquidityPromise,
    centralBankBalanceSheetsPromise,
    ratesInflationPromise,
    creditFinancialConditionsPromise,
    mvpFactualContextPromise,
    stablecoinLiquidityPromise,
    btcEtfFlowPromise,
    goldPositioningPromise,
    recentGdeltEvidencePromise,
    recentBinanceEvidencePromise,
    materialMoveMonitorPromise,
  ]);

  const eventRepricing = buildBriefingEventRepricing({
    monitor: intradayEventMonitor,
    eventHistory: durableHighImpactEventBundle.contextHistory,
    eventHistoryComplete: durableHighImpactEventBundle.contextComplete,
  });

  const confirmation = buildBriefingConfirmation({
    eventRepricing,
    btcEtfFlow,
  });

  const catalystWire = buildCatalystWireReadModel({
    macroNews: normalized.macroNews,
    cryptoNews: normalized.cryptoNews,
    gdeltEvidence: recentGdeltEvidenceResult.rows,
    asOf: asOf.toISOString(),
  });

  const standaloneMarketContext = buildStandaloneMarketContextReadModel({
    asOf: asOf.toISOString(),
    binanceEvidence: recentBinanceEvidenceResult.rows,
    gdeltEvidence: recentGdeltEvidenceResult.rows,
    binanceReadSucceeded: recentBinanceEvidenceResult.succeeded,
    gdeltReadSucceeded: recentGdeltEvidenceResult.succeeded,
  });

  const factualMarketBriefing = composeFactualMarketBriefing({
    baselines: macroBaselines,
    observations: normalized.macroObservations,
    asOf: mvpFactualContext.asOf,
    intradayEventMonitor,
    eventRepricing,
    confirmation,
    upcomingHighImpactEvents: durableHighImpactEventBundle.display,
    materialMoveMonitor,
    ratesPolicy: ratesInflation,
    creditConditions: creditFinancialConditions,
    netLiquidity,
    centralBankBalanceSheets,
  });

  // Dashboard rendering is a read/presentation path. Durable canonical writes
  // are owned by the authenticated cron ingestion workers so a page visit
  // cannot become a second ingestion/persistence clock.
  return {
    ...normalized,
    marketReadContext: completeMarketReadContext(readContext, new Date()),
    macroBaselines,
    intradayEventMonitor: stripIntradayRepricingSource(intradayEventMonitor),
    durableHighImpactEvents: durableHighImpactEventBundle.display,
    netLiquidity,
    centralBankBalanceSheets,
    ratesInflation,
    creditFinancialConditions,
    mvpFactualContext,
    stablecoinLiquidity,
    btcEtfFlow,
    goldPositioning,
    factualMarketBriefing,
    catalystWire,
    standaloneMarketContext,
    materialMoveMonitor,
  };
}
