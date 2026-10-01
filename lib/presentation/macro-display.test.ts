import assert from "node:assert/strict";
import test from "node:test";
import { formatMacroDisplayDelta, formatMacroDisplayValue } from "./macro-display";

test("formats FRED monetary units at their declared scale", () => {
  assert.equal(
    formatMacroDisplayValue("6747704", "Millions of U.S. Dollars"),
    "$6.75T",
  );
  assert.equal(
    formatMacroDisplayValue("2932035", "Millions of U.S. Dollars"),
    "$2.93T",
  );
  assert.equal(
    formatMacroDisplayDelta(1156, "Millions of U.S. Dollars"),
    "+$1.16B",
  );
  assert.equal(
    formatMacroDisplayDelta(-83601, "Millions of U.S. Dollars"),
    "-$83.60B",
  );
});

test("formats percent values and deltas without duplicate signs or raw provider units", () => {
  assert.equal(formatMacroDisplayValue("3.63", "Percent"), "3.63%");
  assert.equal(formatMacroDisplayDelta(0, "Percent"), "tidak berubah");
  assert.equal(formatMacroDisplayDelta(0.18, "Percent"), "+0.18 poin persentase");
  assert.equal(formatMacroDisplayDelta(-0.1, "Percent"), "-0.10 poin persentase");
});
