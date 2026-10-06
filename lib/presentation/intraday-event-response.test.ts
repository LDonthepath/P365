import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRoundedMove,
  displayEventResultUnit,
  formatEventResultValue,
  formatMovePercent,
} from "./intraday-event-response";

test("event result display hides provider sentinel units", () => {
  assert.equal(displayEventResultUnit("none"), null);
  assert.equal(displayEventResultUnit(" NONE "), null);
  assert.equal(displayEventResultUnit("unknown"), null);
  assert.equal(formatEventResultValue(197, "none"), "197");
  assert.equal(formatEventResultValue(3.2, "%"), "3.2 %");
});


test("event result display preserves provider multiplier without rescaling", () => {
  assert.equal(displayEventResultUnit("job", "thousands"), "ribu pekerjaan");
  assert.equal(formatEventResultValue(29, "job", "thousands"), "29 ribu pekerjaan");
  assert.equal(formatEventResultValue(52, "job", "thousands"), "52 ribu pekerjaan");
  assert.equal(formatEventResultValue(162, "job", "thousands"), "162 ribu pekerjaan");
  assert.equal(formatEventResultValue(0.922, "barrel", "millions"), "0.92 juta barel");
});

test("event result display keeps none or missing multipliers visually neutral", () => {
  assert.equal(displayEventResultUnit("%", "none"), "%");
  assert.equal(displayEventResultUnit("%"), "%");
  assert.equal(formatEventResultValue(3.2, "%", "none"), "3.2 %");
});

test("rounded zero movement is described as flat instead of directional", () => {
  assert.deepEqual(classifyRoundedMove(0.004, 2), {
    verb: "relatif datar",
    amount: "",
  });
  assert.deepEqual(classifyRoundedMove(-0.004, 2), {
    verb: "relatif datar",
    amount: "",
  });
  assert.deepEqual(classifyRoundedMove(0.006, 2), {
    verb: "naik",
    amount: " 0.01%",
  });
  assert.deepEqual(classifyRoundedMove(-0.006, 2), {
    verb: "turun",
    amount: " 0.01%",
  });
});

test("detail-table move formatting uses the same rounded sign semantics", () => {
  assert.equal(formatMovePercent(0.004), "0.00%");
  assert.equal(formatMovePercent(-0.004), "0.00%");
  assert.equal(formatMovePercent(0.006), "+0.01%");
  assert.equal(formatMovePercent(-0.006), "-0.01%");
});
