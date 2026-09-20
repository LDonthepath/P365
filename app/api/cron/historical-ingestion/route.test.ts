import assert from "node:assert/strict";
import {
  createHistoricalIngestionHandler,
  isHistoricalIngestionAuthorized,
} from "../../../../lib/application/historical-ingestion-http";
import type { HistoricalIngestionOptions, HistoricalIngestionReport } from "../../../../lib/application/historical-ingestion";

const token = ["test", "bearer", "token"].join("-");

function request(authorization?: string): Request {
  return new Request("https://p365.test/api/cron/historical-ingestion?mode=FORWARD&providers=coingecko", {
    headers: authorization === undefined ? undefined : { authorization },
  });
}

async function main(): Promise<void> {
  assert.equal(isHistoricalIngestionAuthorized(null, undefined), false);
  assert.equal(isHistoricalIngestionAuthorized(null, token), false);
  assert.equal(isHistoricalIngestionAuthorized(`Basic ${token}`, token), false);
  assert.equal(isHistoricalIngestionAuthorized("Bearer wrong-token", token), false);
  assert.equal(isHistoricalIngestionAuthorized(`Bearer ${token}`, token), true);

  let executions = 0;
  let received: HistoricalIngestionOptions | undefined;
  const report: HistoricalIngestionReport = {
    mode: "FORWARD",
    status: "EMPTY",
    providers: [],
    persistedObservations: 0,
    persistedEvidence: 0,
  };
  const runner = async (options: HistoricalIngestionOptions): Promise<HistoricalIngestionReport> => {
    executions += 1;
    received = options;
    return report;
  };

  const missingServerSecret = createHistoricalIngestionHandler(runner, () => undefined);
  assert.equal((await missingServerSecret(request(`Bearer ${token}`))).status, 401);

  const handler = createHistoricalIngestionHandler(runner, () => token);
  assert.equal((await handler(request())).status, 401);
  assert.equal((await handler(request(`Basic ${token}`))).status, 401);
  assert.equal((await handler(request("Bearer wrong-token"))).status, 401);
  assert.equal(executions, 0, "unauthorized requests must not invoke ingestion");

  const authorized = await handler(request(`Bearer ${token}`));
  assert.equal(authorized.status, 200);
  assert.equal(executions, 1);
  assert.deepEqual(received, { mode: "FORWARD", providers: ["coingecko"] });
}

void main();
