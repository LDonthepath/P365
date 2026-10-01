import assert from "node:assert/strict";
import test from "node:test";

test("canonical batch ID grammar remains restricted to deterministic P365 IDs", () => {
  const safe = [
    "observation-v1-abc123",
    "event:v1:US:2026-09-30T14:30:00.000Z:eia-crude-oil-stocks-change",
    "snapshot_v1.example-1",
  ];
  const unsafe = [
    "observation-v1-a,b",
    "observation-v1-a)",
    "observation-v1-a(",
    " observation-v1-a",
  ];
  const pattern = /^[A-Za-z0-9:._-]+$/;
  safe.forEach((id) => assert.match(id, pattern));
  unsafe.forEach((id) => assert.doesNotMatch(id, pattern));
});
