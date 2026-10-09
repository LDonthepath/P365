import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBriefingBasisPoints,
  formatBriefingNumber,
  formatBriefingPercent,
} from "./briefing-number-format";

test("format Bagian 01–02 konsisten memakai titik ribuan dan koma desimal", () => {
  assert.equal(formatBriefingNumber(82308), "82.308");
  assert.equal(formatBriefingNumber(4200.3, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), "4.200,30");
  assert.equal(formatBriefingPercent(-0.61), "-0,61%");
  assert.equal(formatBriefingPercent(0.19), "+0,19%");
  assert.equal(formatBriefingBasisPoints(-12.5), "-12,5 bps");
});
