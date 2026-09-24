import {
  createEventWindowSnapshotRepairHandler,
} from "./event-window-snapshot-repair-http";
import type {
  EventWindowCaptureReport,
  EventWindowSnapshotRepairRequest,
} from "./event-window-snapshot-capture";

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      label + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual),
    );
  }
}

const report: EventWindowCaptureReport = {
  status: "SUCCESS",
  evaluatedAt: "2026-10-16T00:00:00.000Z",
  candidateEvents: 1,
  qualifiedWindows: 1,
  dueSlots: 2,
  captured: 0,
  corrected: 2,
  alreadyCaptured: 0,
  unavailableEventSlots: 0,
  failed: 0,
  slots: [],
};

async function main(): Promise<void> {
  const calls: EventWindowSnapshotRepairRequest[] = [];
  const handler = createEventWindowSnapshotRepairHandler(
    async (request) => {
      calls.push(request);
      return report;
    },
    () => "secret",
  );

  const unauthorized = await handler(
    new Request("https://example.test/api/internal/snapshot-repair", {
      method: "POST",
      body: JSON.stringify({
        eventIdentityKey: "event:v1:US:2026-10-15T12:30:00.000Z:cpi",
      }),
    }),
  );
  assertEqual(unauthorized.status, 401, "repair requires cron auth");
  assertEqual(calls.length, 0, "unauthorized repair does not execute");

  const invalidIdentity = await handler(
    new Request("https://example.test/api/internal/snapshot-repair", {
      method: "POST",
      headers: { Authorization: "Bearer secret" },
      body: JSON.stringify({
        eventIdentityKey: "provider-specific-id",
      }),
    }),
  );
  assertEqual(invalidIdentity.status, 400, "repair rejects non-v1 Event identity");

  const authorized = await handler(
    new Request("https://example.test/api/internal/snapshot-repair", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventIdentityKey: "event:v1:US:2026-10-15T12:30:00.000Z:cpi",
      }),
    }),
  );
  assertEqual(authorized.status, 200, "authorized historical repair returns HTTP 200");
  assertEqual(calls.length, 1, "authorized repair executes exactly once");
  assertEqual(
    calls[0],
    {
      eventIdentityKey: "event:v1:US:2026-10-15T12:30:00.000Z:cpi",
    },
    "handler forwards only the provider-independent Event identity",
  );
  assertEqual(await authorized.json(), report, "handler returns repair report");
}

void main();
