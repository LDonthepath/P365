import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FactualMarketBriefingPanel } from "../../app/dashboard/factual-market-briefing-panel";
import { composeFactualMarketBriefing } from "./factual-market-briefing";
import type { CentralBankBalanceSheetReadModel } from "./central-bank-balance-sheets";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

const AS_OF = "2026-10-09T12:00:00.000Z";
const centralBanks: CentralBankBalanceSheetReadModel = {
  asOf: AS_OF,
  items: [
    {
      seriesKey: "ECBASSETSW", label: "Neraca Eurosystem (ECB)",
      cadence: "WEEKLY", displayUnit: "juta EUR", status: "AVAILABLE",
      latest: { id: "ecb-latest", value: 5917000, observedAt: "2026-10-02", retrievedAt: "2026-10-07T10:00:00Z", sourceId: "fred" },
      previous: { id: "ecb-previous", value: 5915000, observedAt: "2026-09-25" },
      changeFromPrevious: 2000,
    },
    {
      seriesKey: "JPNASSETS", label: "Neraca Bank of Japan",
      cadence: "MONTHLY", displayUnit: "100 juta JPY", status: "AVAILABLE",
      latest: { id: "boj-latest", value: 6446600, observedAt: "2026-09-01", retrievedAt: "2026-10-03T11:00:00Z", sourceId: "fred" },
      previous: { id: "boj-previous", value: 6442900, observedAt: "2026-08-01" },
      changeFromPrevious: 3700,
    },
  ],
};

test("Bagian 03 renders separate ECB/BoJ cards with native currencies, release cadence and real predecessors", () => {
  const briefing = composeFactualMarketBriefing({
    baselines: {}, observations: [], asOf: AS_OF, centralBankBalanceSheets: centralBanks,
  });
  const html = renderToStaticMarkup(createElement(FactualMarketBriefingPanel, { data: briefing }));
  const section = html.slice(html.indexOf('id="briefing-usd-liquidity"'), html.indexOf('id="briefing-credit-conditions"'));
  assert.match(section, /03 · Apa yang berubah pada likuiditas AS dan neraca bank sentral\?/);
  assert.match(section, /Neraca bank sentral · Zona Euro dan Jepang/);
  assert.match(section, /aria-label="Neraca Eurosystem \(ECB\)"/);
  assert.match(section, /aria-label="Neraca Bank of Japan"/);
  assert.match(section, /juta EUR/);
  assert.match(section, /100 juta JPY/);
  assert.match(section, /Observasi 02 Okt 2026 · mingguan/);
  assert.match(section, /Observasi 01 Sep 2026 · bulanan/);
  assert.match(section, /observasi mingguan sebelumnya · 25 Sep 2026/);
  assert.match(section, /observasi bulanan sebelumnya · 01 Agu 2026/);
  assert.match(section, /Tidak dikonversi ke USD/);
  assert.doesNotMatch(section, /TERBARU SAAT DIPEROLEH/);
  assert.doesNotMatch(section, /risk-on|risk-off|bullish|bearish/i);
  assert.ok(html.indexOf('id="briefing-credit-conditions"') > html.indexOf("Neraca bank sentral · Zona Euro"));
});

test("both cards remain visible but unavailable without durable ECB/BoJ observations", () => {
  const briefing = composeFactualMarketBriefing({
    baselines: {}, observations: [], asOf: AS_OF,
  });
  const html = renderToStaticMarkup(createElement(FactualMarketBriefingPanel, { data: briefing }));
  const section = html.slice(html.indexOf('id="briefing-usd-liquidity"'), html.indexOf('id="briefing-credit-conditions"'));
  assert.match(section, /Neraca Eurosystem \(ECB\)/);
  assert.match(section, /Neraca Bank of Japan/);
  assert.match(section, /neraca ECB\/BoJ tersedia 0 dari 2 seri/);
  assert.equal((section.match(/BELUM ADA DATA/g) ?? []).length, 2);
  assert.doesNotMatch(section, /100 juta JPY.*Observasi 01 Sep 2026/);
});
