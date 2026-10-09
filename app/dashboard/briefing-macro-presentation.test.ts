import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FactualMarketBriefingPanel } from "./factual-market-briefing-panel";
import { composeFactualMarketBriefing, type FactualMarketBriefing } from "@/lib/application/factual-market-briefing";

(globalThis as typeof globalThis & { React?: typeof React }).React = React;

test("Bagian 05 memakai field makro existing, basis bertanggal, dan format id-ID tanpa mengubah formatter domain", () => {
  const base = composeFactualMarketBriefing({
    baselines: {}, observations: [], asOf: "2026-10-09T10:00:00.000Z",
  });
  const data: FactualMarketBriefing = {
    ...base,
    whatChanged: {
      evidenceStatus: "AVAILABLE",
      reasoningStatus: "NOT_EVALUATED",
      reason: null,
      items: [
        {
          seriesId: "DGS10", subject: "US Treasury 10Y", unit: "Percent",
          currentValue: "4.10", baselineValue: "4.00", changeValue: 0.1,
          currentObservedAt: "2026-10-08T00:00:00.000Z",
          baselineObservedAt: "2026-10-07T00:00:00.000Z", sourceId: "fred",
        },
        {
          seriesId: "DGS2", subject: "US Treasury 2Y", unit: "Percent",
          currentValue: "3.9", baselineValue: "3.95", changeValue: -0.05,
          currentObservedAt: "2026-10-08T00:00:00.000Z",
          baselineObservedAt: "2026-10-07T00:00:00.000Z", sourceId: "fred",
        },
      ],
    },
  };
  const html = renderToStaticMarkup(createElement(FactualMarketBriefingPanel, { data }));
  const section = html.slice(html.indexOf('id="briefing-macro-background"'), html.indexOf("ANALISIS EVENT"));
  assert.match(section, /05 · Apa yang berubah pada latar makro\?/);
  assert.match(section, /aria-label="US Treasury 10Y"/);
  assert.match(section, /4,10%/);
  assert.match(section, /\+0,10 poin persentase/);
  assert.match(section, /-0,05 poin persentase/);
  assert.match(section, /baseline 4,00% · 07 Okt 2026/);
  assert.match(section, /Observasi 08 Okt 2026/);
  assert.match(section, /<details class="briefing-rate-details">/);
  assert.match(section, /sumber fred/);
  assert.doesNotMatch(section, /4\.10%|bullish|bearish|SEGAR|TERTUNDA|USANG/);
});
