import type { Event } from "../domain/types";
import { buildEventRiskWindow, formatCountdownID, isNearWindow } from "./event-risk-window";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(label + ": expected " + e + ", got " + a);
}

const NOW = new Date("2026-09-23T10:00:00.000Z");
const LIMIT = 6;

let seq = 0;
function event(overrides: Partial<Event> & { scheduledAt?: string }): Event {
  seq += 1;
  return {
    id: "e" + seq,
    subject: "Event " + seq,
    description: "",
    retrievedAt: NOW.toISOString(),
    status: "UPCOMING",
    importance: "HIGH",
    sourceId: "forex-factory",
    evidenceId: "ev" + seq,
    ...overrides,
  };
}

function ffFiller(count: number, startIso: string): Event[] {
  const start = Date.parse(startIso);
  return Array.from({ length: count }, (_, i) => event({ importance: "LOW", scheduledAt: new Date(start + i * 60_000).toISOString() }));
}

// 1. Only HIGH events inside the window are listed, nearest first.
{
  const result = buildEventRiskWindow(
    [
      event({ subject: "Later", scheduledAt: "2026-09-23T15:00:00.000Z" }),
      event({ subject: "Soon", scheduledAt: "2026-09-23T12:30:00.000Z" }),
      event({ subject: "Medium", importance: "MEDIUM", scheduledAt: "2026-09-23T11:00:00.000Z" }),
      event({ subject: "Too far", scheduledAt: "2026-09-24T11:00:00.000Z" }),
    ],
    NOW,
    { calendarLimit: LIMIT },
  );
  assertEqual(result.slots.map((s) => s.entries[0].subject), ["Soon", "Later"], "order + filter");
  assertEqual(result.slots.map((s) => s.minutesUntil), [150, 300], "minutesUntil");
}

// 2. Just-passed event stays for the post-release period, then drops.
{
  const result = buildEventRiskWindow(
    [
      event({ subject: "Released 10m ago", scheduledAt: "2026-09-23T09:50:00.000Z" }),
      event({ subject: "Released 45m ago", scheduledAt: "2026-09-23T09:15:00.000Z" }),
    ],
    NOW,
    { calendarLimit: LIMIT },
  );
  assertEqual(result.slots.map((s) => s.entries[0].subject), ["Released 10m ago"], "post window");
  assertEqual(result.slots[0].minutesUntil, -10, "negative minutes");
}

// 3. Same minute groups into one slot; exact repeats are dropped, different titles kept.
{
  const at = "2026-09-23T12:30:00.000Z";
  const result = buildEventRiskWindow(
    [
      event({ subject: "CPI m/m", scheduledAt: at }),
      event({ subject: "cpi m/m ", scheduledAt: at, sourceId: "biquote" }),
      event({ subject: "Core CPI m/m", scheduledAt: at }),
    ],
    NOW,
    { calendarLimit: LIMIT },
  );
  assertEqual(result.slots.length, 1, "one slot");
  assertEqual(result.slots[0].entries.map((e) => e.subject), ["CPI m/m", "Core CPI m/m"], "dedupe exact only");
}

// 4. Federal Reserve dates are date-only: no countdown, matched by date.
{
  const result = buildEventRiskWindow(
    [event({ subject: "FOMC meeting", sourceId: "federal-reserve", scheduledAt: "2026-09-23T00:00:00.000Z" })],
    NOW,
    { calendarLimit: LIMIT },
  );
  assertEqual(result.slots.length, 1, "fomc listed");
  assertEqual(result.slots[0].precision, "DATE_ONLY", "fomc precision");
  assertEqual(result.slots[0].minutesUntil, null, "fomc no countdown");
}

// 5. Events without a valid time are skipped.
{
  const result = buildEventRiskWindow([event({ scheduledAt: undefined }), event({ scheduledAt: "not-a-date" })], NOW, { calendarLimit: LIMIT });
  assertEqual(result.slots.length, 0, "invalid times skipped");
}

// 6. Coverage: no Forex Factory data means absence proves nothing.
assertEqual(buildEventRiskWindow([], NOW, { calendarLimit: LIMIT }).coverage, { kind: "NO_CALENDAR_DATA" }, "empty coverage");

// 7. Coverage: list below the cap is complete.
assertEqual(
  buildEventRiskWindow(ffFiller(3, "2026-09-23T10:30:00.000Z"), NOW, { calendarLimit: LIMIT }).coverage,
  { kind: "COMPLETE" },
  "below cap complete",
);

// 8. Coverage: capped list ending before the window end is truncated at its last event.
assertEqual(
  buildEventRiskWindow(ffFiller(6, "2026-09-23T10:30:00.000Z"), NOW, { calendarLimit: LIMIT }).coverage,
  { kind: "TRUNCATED", knownUntil: "2026-09-23T10:35:00.000Z" },
  "capped list truncated",
);

// 9. Coverage: capped list that already reaches past the window end is complete.
assertEqual(
  buildEventRiskWindow([...ffFiller(5, "2026-09-23T10:30:00.000Z"), event({ importance: "LOW", scheduledAt: "2026-09-24T12:00:00.000Z" })], NOW, { calendarLimit: LIMIT }).coverage,
  { kind: "COMPLETE" },
  "capped list past window",
);

// 10. Countdown text and proximity flag.
assertEqual(formatCountdownID(150), "dalam 2 j 30 mnt", "hours+min");
assertEqual(formatCountdownID(120), "dalam 2 j", "hours only");
assertEqual(formatCountdownID(45), "dalam 45 mnt", "minutes");
assertEqual(formatCountdownID(0), "sekarang", "now");
assertEqual(formatCountdownID(-12), "12 mnt lalu", "past");
assertEqual(isNearWindow(60), true, "near at 60");
assertEqual(isNearWindow(61), false, "far at 61");
assertEqual(isNearWindow(-10), true, "near when just started");
assertEqual(isNearWindow(null), false, "date-only never near");

console.log("event-risk-window: all assertions passed");
