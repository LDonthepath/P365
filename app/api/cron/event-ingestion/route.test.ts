import assert from "node:assert/strict";
import { createEventIngestionHandler } from "../../../../lib/application/event-ingestion-http";
import type { EventIngestionOptions, EventIngestionReport } from "../../../../lib/application/event-ingestion";

const token = ["event", "cron", "test"].join("-");

function request(authorization?: string): Request {
  return new Request("https://p365.test/api/cron/event-ingestion?providers=biquote&jurisdictions=US,CHINA,JAPAN", {
    headers: authorization === undefined ? undefined : { authorization },
  });
}

async function main(): Promise<void> {
  let executions = 0;
  let received: EventIngestionOptions | undefined;
  const report: EventIngestionReport = {
    status: "EMPTY",
    jurisdictions: ["US", "CHINA", "JAPAN"],
    providers: [],
    persistedEvents: 0,
    persistedEvidence: 0,
    persistedResults: 0,
  };
  const runner = async (options: EventIngestionOptions): Promise<EventIngestionReport> => {
    executions += 1;
    received = options;
    return report;
  };

  assert.equal((await createEventIngestionHandler(runner, () => undefined)(request(`Bearer ${token}`))).status, 401);
  const handler = createEventIngestionHandler(runner, () => token);
  assert.equal((await handler(request())).status, 401);
  assert.equal((await handler(request(`Basic ${token}`))).status, 401);
  assert.equal((await handler(request("Bearer wrong-token"))).status, 401);
  assert.equal(executions, 0, "unauthorized requests must not execute ingestion");
  const authorized = await handler(request(`Bearer ${token}`));
  assert.equal(authorized.status, 200);
  assert.equal(executions, 1);
  assert.deepEqual(received, { providers: ["biquote"], jurisdictions: ["US", "CHINA", "JAPAN"] });
}

void main();
