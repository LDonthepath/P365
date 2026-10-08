import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { MACRO_SERIES_REGISTRY } from "../data/macro-registry";
import { planFredReleaseAwareObservations } from "./fred-release-aware-selection";

const activate = readFileSync(resolve("scripts/ops/frs003_set_nonhourly_fred.sql"), "utf8");
const restore = readFileSync(resolve("scripts/ops/frs003_restore_hourly_fred.sql"), "utf8");

const newCadence = "17 4,13,14,21,22 * * *";
const oldCadence = "31 * * * *";

test("five UTC FRED windows per day replace 24 hourly FRED runs", () => {
  assert.equal(newCadence.split(" ")[1].split(",").length, 5);
  assert.equal(new Set(newCadence.split(" ")[1].split(",")).size, 5);
  assert.match(activate, /schedule := '17 4,13,14,21,22 \* \* \*'/);
  assert.match(activate, /fred\.schedule <> '31 \* \* \* \*'/);
  assert.match(restore, /fred\.schedule <> '17 4,13,14,21,22 \* \* \*'/);
  assert.match(restore, /schedule := '31 \* \* \* \*'/);
  assert.notEqual(oldCadence, newCadence);
});

test("SQL modifies ONLY job 24, guards job 4 and rejects active FRED overlaps", () => {
  for (const sql of [activate, restore]) {
    assert.match(sql, /\nBEGIN;\nDO /);
    assert.match(sql, /\nCOMMIT;/);
    assert.match(sql, /jobid=24 AND jobname='p365-fred-release-aware'/);
    assert.match(sql, /jobid=4 AND jobname='p365-fred'/);
    assert.match(sql, /context_job\.schedule <> '31 \* \* \* \*'/);
    assert.match(sql, /position\('providers=coingecko-context' IN context_job\.command\)/);
    assert.match(sql, /position\('providers=fred&fredReleaseAware=1' IN fred\.command\)/);
    assert.match(sql, /EXISTS \(\s*SELECT 1 FROM cron\.job j WHERE j\.active/);
    assert.equal((sql.match(/PERFORM cron\.alter_job/g) ?? []).length, 1);
    assert.doesNotMatch(sql, /cron\.schedule\(|cron\.unschedule\(|UPDATE cron\.job\b/i);
    assert.doesNotMatch(sql, /pg_sleep\(|INSERT INTO public\.market_memory|DELETE FROM/i);
  }
});

test("04 UTC window invokes true 33 series daily safety sweep (no source calendar required)", async () => {
  const slots = [4, 13, 14, 21, 22];
  const expected = MACRO_SERIES_REGISTRY.map((s) => s.seriesId);
  let called = 0;
  for (const hour of slots) {
    if (hour !== 4) continue;
    const plan = await planFredReleaseAwareObservations({
      now: new Date("2026-10-08T04:17:00Z"),
      apiKey: "sandbox-placeholder",
      fetcher: (async () => {
        called++;
        throw new Error("metadata must not be called for full sweep");
      }) as typeof fetch,
    });
    assert.equal(plan.mode, "DAILY_FULL_SWEEP");
    assert.deepEqual(plan.seriesIds, expected);
    assert.equal(plan.requestedSeriesCount, 33);
  }
  assert.equal(called, 0);
});

test("candidate morning/evening UTC slots cover both US DST offsets without claiming first FRED availability", () => {
  const hours = new Set(newCadence.split(" ")[1].split(",").map(Number));
  for (const offset of [-4, -5]) {
    // At EST and EDT, these slots bracket 08:30 ET and 16:15 ET.
    const morningAfter830ET = 9 + (-offset);
    const afternoonAfter1615ET = 17 + (-offset);
    assert.ok(hours.has(morningAfter830ET), "post-08:30 slot missing");
    assert.ok(hours.has(afternoonAfter1615ET), "post-16:15 slot missing");
  }
});

test("existing FRED acquisition remains fail-open if publisher calendar is unavailable", async () => {
  const plan = await planFredReleaseAwareObservations({
    now: new Date("2026-10-08T13:17:00Z"), apiKey: "sandbox-placeholder",
    fetcher: (async () => new Response("unavailable", {status:503})) as typeof fetch,
  });
  assert.equal(plan.mode, "FAIL_OPEN_FULL_SWEEP");
  assert.equal(plan.requestedSeriesCount, 33);
});
