import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import {
  approvedObservationSemanticKeys,
  CFTC_GOLD_COT_SERIES_KEYS,
  observationSemanticsForSeriesKey,
  requireObservationSemantics,
  resolveObservationSemantics,
} from "./observation-semantics";
import type { Observation } from "./types";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label);
}

function legacyObservation(
  key: string,
  metadataKey: "seriesId" | "metricId",
): Observation {
  return {
    id: `legacy-${key}`,
    domain: metadataKey === "seriesId" ? "MACRO" : "ASSET",
    subject: key,
    value: "1",
    observedAt: "2026-09-20T00:00:00.000Z",
    retrievedAt: "2026-09-20T00:01:00.000Z",
    sourceId: metadataKey === "seriesId" ? "fred" : "legacy-market-provider",
    quality: "FRESH",
    evidenceId: `evidence-${key}`,
    metadata: { [metadataKey]: key },
  };
}

function main(): void {
  for (const series of MACRO_SERIES_REGISTRY) {
    assert(
      observationSemanticsForSeriesKey(series.seriesId) !== null,
      `FRED registry series ${series.seriesId} must have approved semantic dimensions`,
    );
  }

  assertEqual(requireObservationSemantics("ECBASSETSW"), {
    ontologyVersion: "v0.1", marketDomain: "POLICY", informationClass: "OBSERVATION",
    jurisdiction: "EURO_AREA", instrument: "BALANCE_SHEET",
  }, "ECB asset balance sheet dimensions");
  assertEqual(requireObservationSemantics("JPNASSETS"), {
    ontologyVersion: "v0.1", marketDomain: "POLICY", informationClass: "OBSERVATION",
    jurisdiction: "JAPAN", instrument: "BALANCE_SHEET",
  }, "BoJ asset balance sheet dimensions");

  const requiredMetricKeys = [
    "gold.futures.usd",
    "russell2000.index.usd",
    "dxy.index.usd",
    "btc.spot.usd",
    "eth.spot.usd",
    "btc.market_cap.usd",
    "eth.market_cap.usd",
    "crypto.total_market_cap.usd",
    "crypto.total_volume_24h.usd",
    "crypto.usd_stablecoin_market_cap.usd",
    "crypto.us_spot_btc_etf_net_flow.usd",
    "crypto.btc_dominance.pct",
    "crypto.eth_dominance.pct",
    ...Object.values(CFTC_GOLD_COT_SERIES_KEYS),
  ];

  for (const key of requiredMetricKeys) {
    assert(
      observationSemanticsForSeriesKey(key) !== null,
      `active market metric ${key} must have approved semantic dimensions`,
    );
  }

  assertEqual(
    requireObservationSemantics("crypto.us_spot_btc_etf_net_flow.usd"),
    {
      ontologyVersion: "v0.1",
      marketDomain: "CRYPTO",
      informationClass: "FLOW",
      jurisdiction: "US",
      instrument: "ETF",
      asset: "BTC",
    },
    "US spot BTC ETF net-flow semantics",
  );

  assertEqual(
    requireObservationSemantics("btc.spot.usd"),
    {
      ontologyVersion: "v0.1",
      marketDomain: "CRYPTO",
      informationClass: "PRICING",
      jurisdiction: "GLOBAL",
      instrument: "CRYPTO_SPOT",
      asset: "BTC",
    },
    "BTC spot semantics",
  );

  assertEqual(
    requireObservationSemantics(CFTC_GOLD_COT_SERIES_KEYS.managedMoneyLong),
    {
      ontologyVersion: "v0.1",
      marketDomain: "COMMODITY",
      informationClass: "POSITIONING",
      jurisdiction: "US",
      instrument: "FUTURE",
      asset: "GOLD",
      participant: "MANAGED_MONEY",
    },
    "CFTC Gold managed-money positioning semantics",
  );

  assertEqual(
    requireObservationSemantics("gold.futures.usd"),
    {
      ontologyVersion: "v0.1",
      marketDomain: "COMMODITY",
      informationClass: "PRICING",
      jurisdiction: "GLOBAL",
      instrument: "FUTURE",
      asset: "GOLD",
    },
    "Gold futures semantics",
  );

  assertEqual(
    requireObservationSemantics("crypto.usd_stablecoin_market_cap.usd"),
    {
      ontologyVersion: "v0.1",
      marketDomain: "CRYPTO",
      informationClass: "OBSERVATION",
      jurisdiction: "GLOBAL",
      asset: "USD_STABLECOINS",
    },
    "USD stablecoin market-cap semantics",
  );

  assertEqual(
    requireObservationSemantics("policy.us.sep.ffr.year_end_2027.median_pct"),
    {
      ontologyVersion: "v0.1",
      marketDomain: "POLICY",
      informationClass: "EXPECTATION",
      jurisdiction: "US",
      instrument: "POLICY_RATE",
      tenor: "YEAR_END_2027",
    },
    "SEP published median semantics",
  );

  assertEqual(
    requireObservationSemantics("policy.us.sep.ffr.longer_run.midpoint_3000_millipct.participant_count"),
    {
      ontologyVersion: "v0.1",
      marketDomain: "POLICY",
      informationClass: "EXPECTATION",
      jurisdiction: "US",
      instrument: "POLICY_RATE",
      tenor: "LONGER_RUN",
    },
    "SEP dot-distribution semantics",
  );

  assertEqual(
    requireObservationSemantics("DFII10"),
    {
      ontologyVersion: "v0.1",
      marketDomain: "RATES",
      informationClass: "PRICING",
      jurisdiction: "US",
      instrument: "SOVEREIGN_BOND",
      tenor: "10Y",
      asset: "US_TIPS",
    },
    "10Y real-yield semantics",
  );

  assertEqual(
    requireObservationSemantics("T10Y2Y").informationClass,
    "DERIVED_METRIC",
    "yield-curve spread stays derived",
  );

  assertEqual(
    requireObservationSemantics("SAHMREALTIME").informationClass,
    "DERIVED_METRIC",
    "Sahm Rule stays derived",
  );

  assertEqual(
    resolveObservationSemantics(legacyObservation("CPIAUCSL", "seriesId")),
    requireObservationSemantics("CPIAUCSL"),
    "legacy FRED row resolves semantics without rewrite",
  );

  assertEqual(
    resolveObservationSemantics(legacyObservation("btc.spot.usd", "metricId")),
    requireObservationSemantics("btc.spot.usd"),
    "legacy market row resolves semantics without rewrite",
  );

  assertEqual(
    observationSemanticsForSeriesKey("unknown.series"),
    null,
    "unknown semantic key remains explicit",
  );

  assert(
    approvedObservationSemanticKeys().length >= MACRO_SERIES_REGISTRY.length + requiredMetricKeys.length,
    "approved registry includes all active FRED and market keys",
  );
}

main();
