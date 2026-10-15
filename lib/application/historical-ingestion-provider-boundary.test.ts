import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runHistoricalIngestion } from "./historical-ingestion";
import test from "node:test";
import { HISTORICAL_INGESTION_PROVIDERS } from "./historical-ingestion-contract";
import { RETAINED_MACRO_INGESTION_PROVIDERS } from "./historical-ingestion-macro-providers";

test("MACRO-CUT-001A: retained macro adapters have an independent provider-import boundary", () => {
  assert.deepEqual(RETAINED_MACRO_INGESTION_PROVIDERS, ["fred", "federal-reserve-sep", "gdelt"]);
  const code = readFileSync(new URL("./historical-ingestion-macro-providers.ts", import.meta.url), "utf8");
  const importedProviders = [...code.matchAll(/import\("\.\.\/data\/([^"]+)"\)/g)]
    .map((match) => match[1]);
  assert.deepEqual(importedProviders, ["fred", "federal-reserve-sep", "gdelt-gal"]);
  assert.doesNotMatch(code, /crypto-market|yahoo-finance|binance-|defillama|sosovalue|cftc-/);
});

test("MACRO-CUT-003D: legacy 13-provider contract remains readable, default acquisition bridge is physically absent", () => {
  assert.equal(HISTORICAL_INGESTION_PROVIDERS.length, 16);
  const retained = new Set<string>(RETAINED_MACRO_INGESTION_PROVIDERS);
  const otherProviders = HISTORICAL_INGESTION_PROVIDERS.filter((provider) => !retained.has(provider));
  assert.equal(otherProviders.length, 13);
  assert.equal(new Set([...RETAINED_MACRO_INGESTION_PROVIDERS, ...otherProviders]).size, 16);
  assert.equal(existsSync(new URL("./historical-ingestion-nonmacro-providers.ts", import.meta.url)), false);
  const registry = readFileSync(new URL("./historical-ingestion-provider-registry.ts", import.meta.url), "utf8");
  assert.doesNotMatch(registry, /historical-ingestion-nonmacro-providers|createNonMacroAcquisition|needsNonMacro/);
  assert.doesNotMatch(registry, /import\("\.\.\/data\/(?:crypto-market|yahoo-finance-markets|defillama-stablecoins|sosovalue-etf-flow|cftc-gold-cot|binance-spot-flow|binance-order-book|hyperliquid-perp-order-book)"\)/);
  assert.match(registry, /createRetainedMacroAcquisition/);
});

test("MACRO-CUT-003B: macro execution/normalization do not statically load market acquisition and adapters", () => {
  const executor = readFileSync(new URL("./historical-ingestion-executor.ts", import.meta.url), "utf8");
  const registry = readFileSync(new URL("./historical-ingestion-provider-registry.ts", import.meta.url), "utf8");
  const normalizer = readFileSync(new URL("./historical-ingestion-macro-normalization.ts", import.meta.url), "utf8");
  const legacy = readFileSync(new URL("./historical-ingestion-normalization.ts", import.meta.url), "utf8");
  const request = readFileSync(new URL("./historical-ingestion-request.ts", import.meta.url), "utf8");
  const options = readFileSync(new URL("./historical-ingestion-options.ts", import.meta.url), "utf8");
  assert.doesNotMatch(executor, /import \{ canonicalizeHistoricalResult \} from/);
  assert.match(executor, /isRetainedMacroHistoricalProvider\(provider\)/);
  assert.match(executor, /await import\("\.\/historical-ingestion-normalization"\)/);
  assert.doesNotMatch(registry, /import \{ createNonMacroAcquisition \} from/);
  assert.doesNotMatch(registry, /needsNonMacro|historical-ingestion-nonmacro-providers/);
  assert.match(registry, /"Nonmacro historical acquisition has been retired"/);
  assert.doesNotMatch(normalizer, /crypto-market|defillama|sosovalue|cftc|binance|hyperliquid|yahoo/);
  assert.match(normalizer, /macroToCanonicalRecords/);
  assert.match(normalizer, /federalReserveSepToCanonicalRecords/);
  assert.match(normalizer, /gdeltGalSnapshotsToEvidence/);
  assert.match(legacy, /canonicalizeRetainedMacroResult\(result, provider\)/);
  for (const source of [request, options]) {
    assert.doesNotMatch(source, /from "\.\.\/data\/(?:sosovalue-etf-flow|cftc-gold-cot)"/);
    assert.match(source, /from "\.\.\/data\/provider-backfill-ranges"/);
  }
});


test("MACRO-CUT-003D: non-injected runner fails before initializing repos or fetching retired market providers", async () => {
  for (const provider of HISTORICAL_INGESTION_PROVIDERS) {
    if ((RETAINED_MACRO_INGESTION_PROVIDERS as readonly string[]).includes(provider)) continue;
    await assert.rejects(
      runHistoricalIngestion({ mode: "FORWARD", providers: [provider] }),
      new RegExp("Nonmacro historical ingestion is retired: " + provider),
    );
  }
  await assert.rejects(
    runHistoricalIngestion({ mode: "FORWARD", providers: ["fred", "coingecko-context"] }),
    /Nonmacro historical ingestion is retired: coingecko-context/,
  );
  const runner = readFileSync(new URL("./historical-ingestion.ts", import.meta.url), "utf8");
  const deny = runner.indexOf("Nonmacro historical ingestion is retired:");
  const initialize = runner.indexOf("await defaultDependencies(options)");
  assert.ok(deny >= 0 && initialize > deny, "retirement check must precede default repository initialization");
});

test("MACRO-CUT-003G: retained macro normalizer is independent of the mixed market-provider adapter", () => {
  const macro = readFileSync(new URL("./historical-ingestion-macro-normalization.ts", import.meta.url), "utf8");
  const adapter = readFileSync(new URL("../normalization/provider-canonical-macro.ts", import.meta.url), "utf8");
  const combined = readFileSync(new URL("../normalization/provider-canonical.ts", import.meta.url), "utf8");
  assert.match(macro, /from "\.\.\/normalization\/provider-canonical-macro"/);
  assert.doesNotMatch(macro, /from "\.\.\/normalization\/provider-canonical"/);
  assert.match(adapter, /export function macroToCanonicalRecords\(/);
  assert.match(adapter, /export function federalReserveSepToCanonicalRecords\(/);
  assert.match(adapter, /from "\.\.\/data\/fred"/);
  assert.match(adapter, /from "\.\.\/data\/federal-reserve-sep"/);
  assert.doesNotMatch(adapter, /data\/(?:crypto-market|defillama|sosovalue|cftc|binance|hyperliquid)|from "\.\/provider-canonical"/);
  assert.match(combined, /export \{ macroToCanonicalRecords, federalReserveSepToCanonicalRecords \} from "\.\/provider-canonical-macro"/);
});

test("MACRO-CUT-003I: orphaned news fetchers removed without deleting historical NEWS source identity", () => {
  assert.equal(existsSync(new URL("../data/alpha-vantage.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../data/coindesk-rss.ts", import.meta.url)), false);
  const durable = readFileSync(new URL("./durable-dashboard-read.ts", import.meta.url), "utf8");
  const types = readFileSync(new URL("../data/types.ts", import.meta.url), "utf8");
  assert.match(durable, /const NEWS_SOURCES = \["alpha-vantage", "coindesk-rss"\]/);
  assert.match(types, /"alpha-vantage"/);
  assert.match(types, /"coindesk-rss"/);
});

test("MACRO-CUT-003L: no market export from mixed barrel; legacy normalizer retains isolated market-only adapter", () => {
  const legacy = readFileSync(new URL("./historical-ingestion-normalization.ts", import.meta.url), "utf8");
  const market = readFileSync(new URL("../normalization/provider-canonical-market.ts", import.meta.url), "utf8");
  const combined = readFileSync(new URL("../normalization/provider-canonical.ts", import.meta.url), "utf8");
  assert.match(legacy, /from "\.\.\/normalization\/provider-canonical-market"/);
  assert.doesNotMatch(legacy, /from "\.\.\/normalization\/provider-canonical"/);
  assert.doesNotMatch(market, /from "\.\/provider-canonical"|from "\.\/provider-canonical-macro"|from "\.\/provider-canonical-events"/);
  for (const name of ["cryptoMarketToObservations", "stablecoinLiquidityToCanonicalRecords", "btcEtfFlowToCanonicalRecords", "cftcGoldCotToCanonicalRecords"]) {
    assert.ok(market.includes("export function " + name + "("), "missing market adapter " + name);
  }
  assert.doesNotMatch(combined, /from "\.\/provider-canonical-market"/);
  assert.doesNotMatch(combined, /(?:cryptoMarketToObservations|stablecoinLiquidityToCanonicalRecords|btcEtfFlowToCanonicalRecords|cftcGoldCotToCanonicalRecords)/);
  assert.doesNotMatch(combined, /from "\.\.\/data\/(?:crypto-market|defillama|sosovalue|cftc)/);
});
