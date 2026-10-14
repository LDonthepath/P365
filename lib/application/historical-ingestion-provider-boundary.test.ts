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
