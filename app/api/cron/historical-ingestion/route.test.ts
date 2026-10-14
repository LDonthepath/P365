import assert from "node:assert/strict";
import {
  createHistoricalIngestionHandler,
  isHistoricalIngestionAuthorized,
} from "../../../../lib/application/historical-ingestion-http";
import {
  HISTORICAL_INGESTION_PROVIDERS,
  type HistoricalIngestionOptions,
  type HistoricalIngestionReport,
} from "../../../../lib/application/historical-ingestion";
import { RETAINED_MACRO_INGESTION_PROVIDERS } from "../../../../lib/application/historical-ingestion-macro-providers";

const token = ["test", "bearer", "token"].join("-");

function request(authorization?: string): Request {
  return new Request("https://p365.test/api/cron/historical-ingestion?mode=FORWARD&providers=fred", {
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
  assert.deepEqual(received, { mode: "FORWARD", providers: ["fred"] });

  const gdelt = new Request("https://p365.test/api/cron/historical-ingestion?mode=FORWARD&providers=gdelt", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal((await handler(gdelt)).status, 200);
  assert.deepEqual(received, { mode: "FORWARD", providers: ["gdelt"] });
  assert.equal(executions, 2);

  const sep = new Request("https://p365.test/api/cron/historical-ingestion?mode=FORWARD&providers=federal-reserve-sep", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal((await handler(sep)).status, 200);
  assert.deepEqual(received, { mode: "FORWARD", providers: ["federal-reserve-sep"] });
  assert.equal(executions, 3);

  // Nonmacro legacy identifiers remain readable in compatibility contracts,
  // but no live cron/manual caller can reenable their ingestion through HTTP.
  const allowed = new Set<string>(RETAINED_MACRO_INGESTION_PROVIDERS);
  assert.deepEqual([...allowed].sort(), ["federal-reserve-sep", "fred", "gdelt"]);
  const excluded = HISTORICAL_INGESTION_PROVIDERS.filter((provider) => !allowed.has(provider));
  assert.equal(excluded.length, 13);
  for (const provider of excluded) {
    for (const method of ["GET", "POST"]) {
      const req = new Request(
        `https://p365.test/api/cron/historical-ingestion?mode=FORWARD&providers=${provider}`,
        { method, headers: { authorization: `Bearer ${token}` } },
      );
      const result = await handler(req);
      assert.equal(result.status, 400, `${method}: ${provider}`);
      assert.match((await result.json()).error, /Nonmacro historical ingestion providers are retired/);
      assert.equal(executions, 3, "excluded provider may not run");
    }
  }
  for (const selected of ["fred,coingecko-context", "gdelt,binance-spot", "fred,gdelt,defillama"]) {
    const result = await handler(new Request(
      `https://p365.test/api/cron/historical-ingestion?providers=${selected}`,
      { headers: { authorization: `Bearer ${token}` } },
    ));
    assert.equal(result.status, 400, `mixed-provider request: ${selected}`);
    assert.equal(executions, 3);
  }

  for (const invalid of [
    "mode=BACKFILL&providers=cftc&cftcReleaseAware=1",
    "mode=FORWARD&providers=coingecko&cftcReleaseAware=1",
    "mode=FORWARD&providers=cftc,fred&cftcReleaseAware=1",
    "mode=FORWARD&providers=cftc&cftcReleaseAware=true",
  ]) {
    const request = new Request(`https://p365.test/api/cron/historical-ingestion?${invalid}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal((await handler(request)).status, 400);
    assert.equal(executions, 3, "invalid release-aware requests never invoke ingestion");
  }
}

void main();
