import assert from "node:assert/strict";
import test from "node:test";
import { netLiquidityQualityLabel } from "./mvp-factual-context-panel";

test("translates every Net Liquidity quality without leaking raw enums", () => {
  assert.equal(netLiquidityQualityLabel("FRESH"), "PROXY FAKTUAL · TERBARU SAAT DIPEROLEH");
  assert.equal(netLiquidityQualityLabel("STALE"), "PROXY FAKTUAL · SUDAH LAMA SAAT DIPEROLEH");
  assert.equal(netLiquidityQualityLabel("PARTIAL"), "PROXY FAKTUAL · DATA SEBAGIAN");
  assert.equal(netLiquidityQualityLabel("UNKNOWN"), "PROXY FAKTUAL · KUALITAS TIDAK DIKETAHUI");
});
