import "server-only";
import type { FactualBaseline } from "../domain/baseline";
import { ingestDashboardData } from "../ingestion/dashboard-ingestion";
import { normalizeDashboardData, type NormalizedDashboardData } from "../normalization/dashboard-normalization";
import { historicalEventRepository, historicalEvidenceRepository, historicalObservationRepository } from "../repositories/dashboard-repository";
import type { Event, Evidence } from "../domain/types";
import { buildRepositoryBackedMacroFactualBaselines } from "./factual-baseline";
import { getIntradayEventMonitor, type IntradayEventMonitorResult } from "./intraday-event-monitor";
import { buildBriefingEventRepricing } from "./briefing-event-repricing";
import { buildBriefingConfirmation } from "./briefing-confirmation";
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
import { buildCatalystWireReadModel, type CatalystWireReadModel } from "./catalyst-wire";
import { buildMaterialMoveMonitor, type MaterialMoveMonitorReadModel } from "./material-move-monitor";

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
  catalystWire: CatalystWireReadModel;
  materialMoveMonitor: MaterialMoveMonitorReadModel;
};

type DurableHighImpactEventBundle = {
  display: Event[];
  contextHistory: Event[];
  contextComplete: boolean;
};

async function getRecentGdeltEvidence(asOf: Date): Promise<Evidence[]> {
  const from = new Date(asOf.getTime() - 2 * 60 * 60_000).toISOString();
  try {
    return await historicalEvidenceRepository.findHistory({
      sourceId: "gdelt",
      kind: "NEWS",
      effectiveAtOnOrAfter: from,
      retrievedAtOnOrBefore: asOf.toISOString(),
      order: "DESC",
      limit: 20,
    });
  } catch (error) {
    console.error(
      "Durable GDELT Catalyst Wire read failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return [];
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

export async function getDashboardData(): Promise<DashboardData> {
  const asOf = new Date();
  // Start the independent durable event-response read immediately so it runs
  // alongside provider ingestion/normalization and baseline work.
  const intradayEventMonitorPromise = getIntradayEventMonitor();
  const durableHighImpactEventBundlePromise = getDurableHighImpactEventBundle(asOf);
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
  const recentGdeltEvidencePromise = getRecentGdeltEvidence(asOf);
  const materialMoveMonitorPromise = buildMaterialMoveMonitor({
    observations: dashboardHistoricalObservationRepository,
    events: historicalEventRepository,
    evidence: historicalEvidenceRepository,
    asOf: asOf.toISOString(),
  });
  const ingestion = await ingestDashboardData();
  const normalized = normalizeDashboardData(ingestion);

  const [
    macroBaselines,
    intradayEventMonitor,
    durableHighImpactEventBundle,
    netLiquidity,
    ratesInflation,
    mvpFactualContext,
    stablecoinLiquidity,
    btcEtfFlow,
    goldPositioning,
    recentGdeltEvidence,
    materialMoveMonitor,
  ] = await Promise.all([
    buildRepositoryBackedMacroFactualBaselines(
      normalized.macroObservations,
      dashboardHistoricalObservationRepository,
    ),
    intradayEventMonitorPromise,
    durableHighImpactEventBundlePromise,
    netLiquidityPromise,
    ratesInflationPromise,
    mvpFactualContextPromise,
    stablecoinLiquidityPromise,
    btcEtfFlowPromise,
    goldPositioningPromise,
    recentGdeltEvidencePromise,
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
    gdeltEvidence: recentGdeltEvidence,
    asOf: asOf.toISOString(),
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
  });

  // Dashboard rendering is a read/presentation path. Durable canonical writes
  // are owned by the authenticated cron ingestion workers so a page visit
  // cannot become a second ingestion/persistence clock.
  return {
    ...normalized,
    macroBaselines,
    intradayEventMonitor: stripIntradayRepricingSource(intradayEventMonitor),
    durableHighImpactEvents: durableHighImpactEventBundle.display,
    netLiquidity,
    ratesInflation,
    mvpFactualContext,
    stablecoinLiquidity,
    btcEtfFlow,
    goldPositioning,
    factualMarketBriefing,
    catalystWire,
    materialMoveMonitor,
  };
}
