import "server-only";
import { beginMarketReadContext, completeMarketReadContext, type MarketReadContext } from "./market-read-context";
import { readDurableDashboardData } from "./durable-dashboard-read";
import type { NormalizedDashboardData } from "../normalization/dashboard-normalization";
import type { FactualBaseline } from "../domain/baseline";
import type { Observation } from "../domain/types";
import { historicalEventRepository, historicalEvidenceRepository, historicalObservationRepository, createBatchedProjectionObservationRepository } from "../repositories/dashboard-repository";
import { buildRepositoryBackedMacroFactualBaselines } from "./factual-baseline";
import { buildNetLiquidityReadModel, type NetLiquidityReadModel } from "./net-liquidity";
import { buildRatesInflationReadModel, type RatesInflationReadModel } from "./rates-inflation";
import { withHistoricalObservationConcurrencyLimit } from "./historical-observation-concurrency";
import { createDashboardObservationReadScope } from "./dashboard-observation-read-scope";

/**
 * The active dashboard contract contains macro context and economic calendar
 * only. Cross-asset event-window and asset read models are not imported.
 */
export type MacroDashboardData = NormalizedDashboardData & {
  marketReadContext: MarketReadContext;
  macroBaselines: Record<string, FactualBaseline>;
  netLiquidity: NetLiquidityReadModel;
  ratesInflation: RatesInflationReadModel;
};

const dashboardHistoricalObservationRepository = withHistoricalObservationConcurrencyLimit(
  historicalObservationRepository, 4,
);

export async function getDashboardData(): Promise<MacroDashboardData> {
  const started = performance.now();
  const readContext = beginMarketReadContext(new Date());
  const asOf = new Date(readContext.knowledgeAsOf);
  const readScope = createDashboardObservationReadScope(dashboardHistoricalObservationRepository);
  if (process.env.P365_DURABLE_PROJECTION_BATCH === "enabled"
    && process.env.P365_MEMORY_PERSISTENCE !== "memory") {
    const batch = createBatchedProjectionObservationRepository();
    readScope.useProjectionSource(batch.repository, batch.stats);
  }

  const macroHistory = new Map<string, Observation[]>();
  const normalizedPromise = readDurableDashboardData(asOf, {
    observations: readScope.forConsumer("durable_projection"),
    evidence: historicalEvidenceRepository,
    events: historicalEventRepository,
  }, macroHistory, { macroOnly: true });

  const netLiquidityPromise = buildNetLiquidityReadModel(
    readScope.forConsumer("net_liquidity"), asOf,
  ).catch((error): NetLiquidityReadModel => {
    console.error("Macro liquidity read failed:", error instanceof Error ? error.message : "unknown");
    return { status: "UNAVAILABLE", reason: "Data likuiditas belum dapat dibaca." };
  });

  // FRED+Federal Reserve SEP policy model. Passing a resolved empty history
  // prevents the legacy Yahoo DXY acquisition (macro does not require DXY).
  const ratesInflationPromise = buildRatesInflationReadModel(
    readScope.forConsumer("rates_inflation"), asOf, Promise.resolve([]),
  );

  const normalized = await normalizedPromise;
  const macroBaselines = await buildRepositoryBackedMacroFactualBaselines(
    normalized.macroObservations,
    readScope.forConsumer("macro_baselines"),
    macroHistory,
  );
  const [netLiquidity, ratesInflation] = await Promise.all([netLiquidityPromise, ratesInflationPromise]);
  const elapsedMs = Math.round(performance.now() - started);
  if (elapsedMs >= 5_000) {
    console.info("P365 macro dashboard read performance", JSON.stringify({
      elapsedMs,
      observationReads: readScope.stats(),
    }));
  }
  return {
    ...normalized,
    marketReadContext: completeMarketReadContext(readContext, new Date()),
    macroBaselines,
    netLiquidity,
    ratesInflation,
  };
}
