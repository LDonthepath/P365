import type { NormalizedDashboardData } from "../normalization/dashboard-normalization";
import type { FactualBaseline } from "../domain/baseline";
import type { Event } from "../domain/types";
import type { MarketReadContext } from "./market-read-context";
import type { IntradayEventMonitorResult } from "./intraday-event-monitor";
import type { NetLiquidityReadModel } from "./net-liquidity";
import type { CentralBankBalanceSheetReadModel } from "./central-bank-balance-sheets";
import type { RatesInflationReadModel } from "./rates-inflation";
import type { CreditFinancialConditionsReadModel } from "./credit-financial-conditions";
import type { MacroCryptoGoldFactualContext } from "./mvp-factual-context";
import type { StablecoinLiquidityReadModel } from "./stablecoin-liquidity";
import type { BtcEtfFlowReadModel } from "./btc-etf-flow";
import type { GoldPositioningReadModel } from "./gold-positioning";
import type { FactualMarketBriefing } from "./factual-market-briefing";
import type { CatalystWireReadModel } from "./catalyst-wire";
import type { StandaloneMarketContextReadModel } from "./standalone-market-context";
import type { MaterialMoveMonitorReadModel } from "./material-move-monitor";

/** Type-only historical compatibility for archived panels. Never returned by the
 * macro dashboard route. The active query no longer reads these model families.
 * Remove this adapter with the old, unmounted components in a later checkpoint.
 */
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
