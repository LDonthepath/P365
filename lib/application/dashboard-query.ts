import "server-only";
import type { FactualBaseline } from "../domain/baseline";
import { ingestDashboardData } from "../ingestion/dashboard-ingestion";
import { normalizeDashboardData, type NormalizedDashboardData } from "../normalization/dashboard-normalization";
import { historicalEventRepository, historicalObservationRepository } from "../repositories/dashboard-repository";
import type { Event } from "../domain/types";
import { buildRepositoryBackedMacroFactualBaselines } from "./factual-baseline";
import { getIntradayEventMonitor, type IntradayEventMonitorResult } from "./intraday-event-monitor";
import { getBriefingEventRepricing } from "./briefing-event-repricing";
import { buildNetLiquidityReadModel, type NetLiquidityReadModel } from "./net-liquidity";
import { buildRatesInflationReadModel, type RatesInflationReadModel } from "./rates-inflation";
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

export type DashboardData = NormalizedDashboardData & {
  macroBaselines: Record<string, FactualBaseline>;
  intradayEventMonitor: IntradayEventMonitorResult;
  durableHighImpactEvents: Event[];
  netLiquidity: NetLiquidityReadModel;
  ratesInflation: RatesInflationReadModel;
  mvpFactualContext: MacroCryptoGoldFactualContext;
  stablecoinLiquidity: StablecoinLiquidityReadModel;
  btcEtfFlow: BtcEtfFlowReadModel;
  goldPositioning: GoldPositioningReadModel;
  factualMarketBriefing: FactualMarketBriefing;
};

async function getDurableHighImpactEvents(now = new Date()): Promise<Event[]> {
  const from = new Date(now.getTime() - 30 * 60_000).toISOString();
  const through = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  try {
    const history = await historicalEventRepository.findHistory({ scheduledAtOnOrAfter: from, scheduledAtOnOrBefore: through, retrievedAtOnOrBefore: now.toISOString(), importance: "HIGH", order: "ASC", limit: 100 });
    const latest = new Map<string, Event>();
    for (const event of history) {
      const key = event.identity?.key ?? event.id;
      const current = latest.get(key);
      if (!current || Date.parse(event.retrievedAt) >= Date.parse(current.retrievedAt)) latest.set(key, event);
    }
    return [...latest.values()].sort((a, b) => Date.parse(a.scheduledAt ?? "") - Date.parse(b.scheduledAt ?? ""));
  } catch (error) {
    console.error("Durable high-impact event read failed:", error instanceof Error ? error.message : "unknown error");
    return [];
  }
}

const dashboardHistoricalObservationRepository = withHistoricalObservationConcurrencyLimit(
  historicalObservationRepository,
  4,
);

export async function getDashboardData(): Promise<DashboardData> {
  const asOf = new Date();
  // Start the independent durable event-response read immediately so it runs
  // alongside provider ingestion/normalization and baseline work.
  const intradayEventMonitorPromise = getIntradayEventMonitor(asOf);
  const briefingEventRepricingPromise = intradayEventMonitorPromise.then(
    (monitor) => getBriefingEventRepricing(monitor, asOf),
  );
  const durableHighImpactEventsPromise = getDurableHighImpactEvents(asOf);
  const netLiquidityPromise = buildNetLiquidityReadModel(dashboardHistoricalObservationRepository, asOf);
  const ratesInflationPromise = buildRatesInflationReadModel(dashboardHistoricalObservationRepository, asOf);
  const mvpFactualContextPromise = buildMacroCryptoGoldFactualContext(
    dashboardHistoricalObservationRepository,
    asOf,
    {
      netLiquidity: netLiquidityPromise,
      ratesInflation: ratesInflationPromise,
    },
  );
  const stablecoinLiquidityPromise = buildStablecoinLiquidityReadModel(dashboardHistoricalObservationRepository, asOf);
  const btcEtfFlowPromise = buildBtcEtfFlowReadModel(dashboardHistoricalObservationRepository, asOf);
  const goldPositioningPromise = buildGoldPositioningReadModel(dashboardHistoricalObservationRepository, asOf);
  const ingestion = await ingestDashboardData();
  const normalized = normalizeDashboardData(ingestion);

  const [
    macroBaselines,
    intradayEventMonitor,
    briefingEventRepricing,
    durableHighImpactEvents,
    netLiquidity,
    ratesInflation,
    mvpFactualContext,
    stablecoinLiquidity,
    btcEtfFlow,
    goldPositioning,
  ] = await Promise.all([
    buildRepositoryBackedMacroFactualBaselines(
      normalized.macroObservations,
      dashboardHistoricalObservationRepository,
    ),
    intradayEventMonitorPromise,
    briefingEventRepricingPromise,
    durableHighImpactEventsPromise,
    netLiquidityPromise,
    ratesInflationPromise,
    mvpFactualContextPromise,
    stablecoinLiquidityPromise,
    btcEtfFlowPromise,
    goldPositioningPromise,
  ]);

  const factualMarketBriefing = composeFactualMarketBriefing({
    baselines: macroBaselines,
    observations: normalized.macroObservations,
    asOf: mvpFactualContext.asOf,
    intradayEventMonitor,
    eventRepricing: briefingEventRepricing,
  });

  // Dashboard rendering is a read/presentation path. Durable canonical writes
  // are owned by the authenticated cron ingestion workers so a page visit
  // cannot become a second ingestion/persistence clock.
  return {
    ...normalized,
    macroBaselines,
    intradayEventMonitor,
    durableHighImpactEvents,
    netLiquidity,
    ratesInflation,
    mvpFactualContext,
    stablecoinLiquidity,
    btcEtfFlow,
    goldPositioning,
    factualMarketBriefing,
  };
}
