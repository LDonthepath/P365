import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("MACRO-CUT-001A: provider inventory stays unchanged and separate from non-MVP adapters", () => {
  assert.equal(HISTORICAL_INGESTION_PROVIDERS.length, 16);
  const retained = new Set<string>(RETAINED_MACRO_INGESTION_PROVIDERS);
  const otherProviders = HISTORICAL_INGESTION_PROVIDERS.filter((provider) => !retained.has(provider));
  assert.equal(otherProviders.length, 13);
  assert.equal(new Set([...RETAINED_MACRO_INGESTION_PROVIDERS, ...otherProviders]).size, 16);

  const nonMacro = readFileSync(new URL("./historical-ingestion-nonmacro-providers.ts", import.meta.url), "utf8");
  assert.doesNotMatch(nonMacro, /import\("\.\.\/data\/(?:fred|federal-reserve-sep|gdelt-gal)"\)/);
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
  assert.match(registry, /needsNonMacro[\s\S]*?import\("\.\/historical-ingestion-nonmacro-providers"\)/);
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
