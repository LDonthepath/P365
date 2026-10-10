import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FactualMarketBriefingPanel } from "../../app/dashboard/factual-market-briefing-panel";
import { composeFactualMarketBriefing } from "./factual-market-briefing";
import type { MaterialMoveMonitorReadModel } from "./material-move-monitor";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

const AS_OF = "2026-10-07T12:00:00.000Z";

const monitor: MaterialMoveMonitorReadModel = {
  asOf: AS_OF,
  status: "OK",
  causalAttribution: "NOT_EVALUATED",
  assets: [
    {
      asset: "BTC",
      seriesKey: "btc.spot.usd",
      sourceId: "coingecko-market",
      observedAt: AS_OF,
      marketContext: {
        currentValue: 84250,
        valueUnit: "USD",
        changePercent: 3.1,
        changeBasis: "ROLLING_24H",
      },
      status: "MATERIAL_MOVE",
      hasMaterialMove: true,
      horizons: [
        {
          targetStartObservedAt: "2026-10-07T11:00:00.000Z",
          targetEndObservedAt: AS_OF,
          horizonMinutes: 60,
          status: "MATERIAL_MOVE",
          signedPercentChange: 1.2,
          materialityThresholdPercent: 0.8,
          targetPercentileRank: 98,
          historicalSampleSize: 400,
        },
        {
          targetStartObservedAt: "2026-10-07T10:00:00.000Z",
          targetEndObservedAt: AS_OF,
          horizonMinutes: 120,
          status: "MATERIAL_MOVE",
          signedPercentChange: 1.6,
          materialityThresholdPercent: 1.1,
          targetPercentileRank: 98.5,
          historicalSampleSize: 395,
        },
      ],
      evidence: null,
      causalAttribution: "NOT_EVALUATED",
    },
    {
      asset: "GOLD",
      seriesKey: "gold.futures.usd",
      sourceId: "yahoo-finance",
      observedAt: AS_OF,
      marketContext: {
        currentValue: 4149.4,
        valueUnit: "USD",
        changePercent: -0.9,
        changeBasis: "PREVIOUS_CLOSE",
      },
      status: "BELOW_MATERIALITY_THRESHOLD",
      hasMaterialMove: false,
      horizons: [{
        horizonMinutes: 120,
        status: "BELOW_MATERIALITY_THRESHOLD",
        signedPercentChange: -0.35,
        materialityThresholdPercent: 0.8,
        targetPercentileRank: 62,
        historicalSampleSize: 405,
      }],
      evidence: null,
      causalAttribution: "NOT_EVALUATED",
    },
  ],
};

test("hari normal hanya menampilkan satu ringkasan tidak ada pergerakan material", () => {
  const normal: MaterialMoveMonitorReadModel = {
    ...monitor,
    assets: monitor.assets.map((asset) => ({
      ...asset, status: "BELOW_MATERIALITY_THRESHOLD", hasMaterialMove: false,
    })),
  };
  const data = composeFactualMarketBriefing({ baselines: {}, observations: [], asOf: AS_OF, materialMoveMonitor: normal });
  const html = renderToStaticMarkup(createElement(FactualMarketBriefingPanel, { data }));
  assert.equal((html.match(/Tidak ada pergerakan intraday material pada penilaian yang tersedia\./g) ?? []).length, 1);
  assert.doesNotMatch(html, /Status bukti pendukung belum tersedia/);
});

test("briefing leads with market change and keeps MOVE horizons as diagnostics", () => {
  const data = composeFactualMarketBriefing({
    baselines: {},
    observations: [],
    asOf: AS_OF,
    materialMoveMonitor: monitor,
  });

  const html = renderToStaticMarkup(
    createElement(FactualMarketBriefingPanel, { data }),
  );

  assert.match(html, /01 · Apa yang bergerak sekarang\?/);
  assert.match(html, /US\$ 84\.250/);
  assert.match(html, /\+3,10% \(naik\)/);
  assert.match(html, /Perubahan dalam 24 jam/);
  assert.match(html, /US\$ 4\.149,40/);
  assert.match(html, /-0,90% \(turun\)/);
  assert.match(html, /Perubahan terhadap penutupan sebelumnya/);
  assert.match(html, /BTC naik \+1,60% pada horizon 120 menit/);
  assert.equal((html.match(/Tidak ada pergerakan intraday material pada penilaian yang tersedia/g) ?? []).length, 0);
  assert.match(html, /Bitcoin \(BTC\)/);
  assert.match(html, /Emas berjangka COMEX \(GC=F\)/);
  assert.match(html, /per 1 BTC/);
  assert.match(html, /Perubahan 24 jam dan perubahan intraday diukur pada rentang yang berbeda\./);
  assert.match(html, /RINCIAN PERGERAKAN DAN BUKTI/);
  assert.match(html, /60 menit/);
  assert.match(html, /120 menit/);
  assert.doesNotMatch(html, /BTC dan Gold dinilai lebih dulu terhadap ambang historis/);
});
