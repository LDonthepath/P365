import assert from "node:assert/strict";
import { FRESHNESS_POLICIES, qualityFromMarketHours } from "./freshness";

const MAX_AGE = FRESHNESS_POLICIES.MARKET_REALTIME.maxAgeMs;

function quality(
  observedAt: string,
  evaluatedAt: string,
  calendar: Parameters<typeof qualityFromMarketHours>[0]["calendar"],
) {
  return qualityFromMarketHours({ observedAt, evaluatedAt, maxAgeMs: MAX_AGE, calendar });
}

function main(): void {
  assert.equal(
    quality("2026-09-20T12:00:00.000Z", "2026-09-20T12:15:00.000Z", "CONTINUOUS_24_7"),
    "FRESH",
    "24/7 crypto remains fresh through the realtime threshold",
  );
  assert.equal(
    quality("2026-09-20T12:00:00.000Z", "2026-09-20T12:15:01.000Z", "CONTINUOUS_24_7"),
    "STALE",
    "24/7 crypto ages in wall-clock time even on weekends",
  );

  assert.equal(
    quality("2026-09-18T20:59:59.000Z", "2026-09-20T13:14:58.000Z", "CME_GLOBEX_GOLD"),
    "FRESH",
    "Friday GC close does not age through the weekend closure",
  );
  assert.equal(
    quality("2026-09-18T20:59:59.000Z", "2026-09-20T22:16:00.000Z", "CME_GLOBEX_GOLD"),
    "STALE",
    "unchanged GC quote becomes stale after enough Sunday reopen time elapses",
  );
  assert.equal(
    quality("2026-09-18T20:59:00.000Z", "2026-09-18T21:30:00.000Z", "CME_GLOBEX_GOLD"),
    "FRESH",
    "GC daily maintenance closure does not consume the freshness budget",
  );

  assert.equal(
    quality("2026-09-18T20:59:59.000Z", "2026-09-20T13:14:58.000Z", "ICE_USDX"),
    "FRESH",
    "Friday USDX close does not age through the weekend closure",
  );
  assert.equal(
    quality("2026-09-18T20:59:59.000Z", "2026-09-20T22:16:00.000Z", "ICE_USDX"),
    "STALE",
    "unchanged USDX quote becomes stale after the Sunday special reopen",
  );
  assert.equal(
    quality("2026-09-21T20:59:00.000Z", "2026-09-21T23:30:00.000Z", "ICE_USDX"),
    "FRESH",
    "USDX weekday 17:00-20:00 ET closure does not consume the freshness budget",
  );

  assert.equal(
    quality("2026-09-18T20:30:13.000Z", "2026-09-20T23:03:39.000Z", "RUSSELL_2000_CASH_INDEX"),
    "FRESH",
    "Friday Russell cash close remains current through the weekend",
  );
  assert.equal(
    quality("2026-09-18T20:30:13.000Z", "2026-09-21T13:44:13.000Z", "RUSSELL_2000_CASH_INDEX"),
    "FRESH",
    "Russell remains fresh at exactly 15 minutes of qualified freshness-window time",
  );
  assert.equal(
    quality("2026-09-18T20:30:13.000Z", "2026-09-21T13:44:14.000Z", "RUSSELL_2000_CASH_INDEX"),
    "STALE",
    "Russell becomes stale one second beyond the qualified freshness-window threshold",
  );
  assert.equal(
    quality("2026-09-18T20:31:00.000Z", "2026-09-20T23:03:39.000Z", "RUSSELL_2000_CASH_INDEX"),
    "UNKNOWN",
    "sessioned observations outside their qualified freshness window fail safe",
  );

  assert.equal(
    quality("2026-09-22T18:00:00.000Z", "2026-09-22T17:59:59.000Z", "CONTINUOUS_24_7"),
    "UNKNOWN",
    "future observations relative to acquisition are never fresh",
  );
  assert.equal(
    quality("invalid", "2026-09-22T18:00:00.000Z", "CONTINUOUS_24_7"),
    "UNKNOWN",
    "invalid observation timestamps are fail-safe",
  );
  assert.equal(
    quality("2026-09-22T18:00:00.000Z", "invalid", "CME_GLOBEX_GOLD"),
    "UNKNOWN",
    "invalid acquisition timestamps are fail-safe",
  );

  const deterministicInput = {
    observedAt: "2026-09-18T20:59:59.000Z",
    evaluatedAt: "2026-09-20T13:14:58.000Z",
    maxAgeMs: MAX_AGE,
    calendar: "CME_GLOBEX_GOLD" as const,
  };
  const originalDateNow = Date.now;
  let early: ReturnType<typeof qualityFromMarketHours>;
  let late: ReturnType<typeof qualityFromMarketHours>;
  try {
    Date.now = () => Date.parse("2000-01-01T00:00:00.000Z");
    early = qualityFromMarketHours(deterministicInput);
    Date.now = () => Date.parse("2100-01-01T00:00:00.000Z");
    late = qualityFromMarketHours(deterministicInput);
  } finally {
    Date.now = originalDateNow;
  }
  assert.equal(early, late, "market freshness is deterministic from observedAt and retrievedAt");
}

main();
