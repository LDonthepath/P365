import assert from "node:assert/strict";
import test from "node:test";
import { formatEventResultValue } from "./event-result-display";

test("formats provider multiplier without changing the factual numeric value", () => {
  assert.equal(
    formatEventResultValue(0.922, "barrel", "millions"),
    "0,922 juta barel",
  );
  assert.equal(
    formatEventResultValue(-0.701, "barrel", "millions"),
    "-0,701 juta barel",
  );
});

test("keeps ordinary units unchanged when no multiplier exists", () => {
  assert.equal(formatEventResultValue(4.89, "%"), "4,89 %");
  assert.equal(formatEventResultValue(56, "none"), "56");
  assert.equal(formatEventResultValue(undefined, "barrel", "millions"), "—");
});
