"use client";

import type { MacroDashboardData } from "@/lib/data/dashboard-data";
import type { Context, Observation } from "@/lib/domain/types";
import type { BaselinePresentation } from "@/lib/presentation/baseline";
import { formatMacroDisplayDelta, formatMacroDisplayValue } from "@/lib/presentation/macro-display";
import { EmptyPanelNote } from "./dashboard-common-ui";
import { NetLiquidityPanel } from "./net-liquidity-panel";
import { RatesInflationPanel } from "./rates-inflation-panel";

export const MACRO_CONTEXT_LABELS: Record<string, string> = {
  MACRO_MONETARY_POLICY: "Monetary Policy",
  MACRO_LIQUIDITY: "Liquidity",
  MACRO_INFLATION: "Inflation",
  MACRO_LABOR: "Labor",
  MACRO_RATES: "Rates",
  MACRO_USD: "USD",
  MACRO_GROWTH: "Growth",
};

export const MACRO_HEADLINE_SERIES: Record<string, string> = {
  MACRO_MONETARY_POLICY: "EFFR",
  MACRO_LIQUIDITY: "RRPONTSYD",
  MACRO_INFLATION: "CPIAUCSL",
  MACRO_LABOR: "ICSA",
  MACRO_RATES: "DGS10",
  MACRO_USD: "DTWEXBGS",
  MACRO_GROWTH: "GDPC1",
};

export const MACRO_SERIES_LABELS: Record<string, string> = {
  FEDFUNDS: "Federal Funds Rate", EFFR: "Effective Fed Funds Rate", WALCL: "Fed Balance Sheet", WRESBAL: "Reserve Balances",
  M2SL: "M2 Money Stock", WTREGEN: "Treasury General Account", RRPONTSYD: "Overnight Reverse Repo",
  CPIAUCSL: "Headline CPI", CPILFESL: "Core CPI", PCEPI: "PCE Price Index", PCEPILFE: "Core PCE",
  UNRATE: "Unemployment Rate", PAYEMS: "Nonfarm Payrolls", ICSA: "Initial Claims", CCSA: "Continued Claims", JTSJOL: "Job Openings", JTSQUR: "Quits Rate", SAHMREALTIME: "Sahm Rule",
  DGS2: "US Treasury 2Y", DGS10: "US Treasury 10Y", DFII10: "US 10Y Real Yield", T10YIE: "10Y Breakeven Inflation", T10Y2Y: "10Y–2Y Spread", BAMLC0A0CM: "US Corporate Credit Spread", BAMLH0A0HYM2: "US High Yield Spread",
  DTWEXBGS: "Fed Broad USD Index", GDPC1: "Real GDP",
};


function macroThemeItems(context: Context, observations: Observation[]): Observation[] {
  return context.observationIds.map((id) => observations.find((item) => item.id === id)).filter((item): item is Observation => Boolean(item));
}

function macroHeadline(context: Context, items: Observation[]): Observation | undefined {
  const preferred = MACRO_HEADLINE_SERIES[context.scope];
  return items.find((item) => String(item.metadata?.seriesId ?? "") === preferred)
    ?? [...items].sort((a, b) => ({ DAILY: 0, WEEKLY: 1, MONTHLY: 2, QUARTERLY: 3 }[String(a.metadata?.frequency)] ?? 9) - ({ DAILY: 0, WEEKLY: 1, MONTHLY: 2, QUARTERLY: 3 }[String(b.metadata?.frequency)] ?? 9))[0];
}

function MacroThemeCard({ context, observations, baselines, expanded, onToggle }: { context: Context; observations: Observation[]; baselines: Map<string, BaselinePresentation>; expanded: boolean; onToggle: () => void }) {
  const items = macroThemeItems(context, observations);
  const headline = macroHeadline(context, items);
  if (!headline) return null;
  const headlineUnit = String(headline.metadata?.unit ?? "");
  const label = MACRO_CONTEXT_LABELS[context.scope] ?? context.scope;
  const headlineSeries = String(headline.metadata?.seriesId ?? "");

  return <article className={`macro-theme-card${expanded ? " expanded" : ""}`}>
    <button type="button" className="macro-theme-summary" aria-expanded={expanded} onClick={onToggle}>
      <div className="macro-tile-header"><span className="macro-frequency">{label.toUpperCase()}</span><span className="macro-quality">{headline.quality}</span></div>
      <div className="macro-tile-main"><div><h3>{MACRO_SERIES_LABELS[headlineSeries] ?? headline.subject}</h3><small>{headlineSeries} · {String(headline.metadata?.frequency ?? "")}</small></div><strong className="macro-value">{formatMacroDisplayValue(headline.value, headlineUnit)}</strong></div>
      <div className="macro-tile-footer"><span>{items.length} INDIKATOR</span><span>{expanded ? "TUTUP ↑" : "LIHAT DETAIL ↓"}</span></div>
    </button>
    {expanded && <div className="macro-theme-detail">{items.map((item) => {
      const metadata = item.metadata ?? {};
      const unit = String(metadata.unit ?? "");
      const seriesId = String(metadata.seriesId ?? "");
      const baseline = baselines.get(seriesId) ?? null;
      return <div className="macro-detail-row" key={item.id}><div><strong>{MACRO_SERIES_LABELS[seriesId] ?? item.subject}</strong><small>{seriesId} · {String(metadata.frequency ?? "UNKNOWN")} · {item.quality}</small></div><div className="macro-detail-values"><strong>{formatMacroDisplayValue(item.value, unit)}</strong><small>{baseline?.baselineValue !== null && baseline?.baselineValue !== undefined ? `Ref ${formatMacroDisplayValue(baseline.baselineValue, unit)} · ${formatMacroDisplayDelta(baseline.changeValue, unit)}` : `Pembanding ${baseline?.status ?? "MISSING"}`}</small></div></div>;
    })}<div className="macro-theme-metadata"><span>Setiap indikator tetap dihitung terpisah; kartu ini hanya mengelompokkan tampilan.</span><span>Sumber · FRED</span></div></div>}
  </article>;
}


export function MacroSection({ data, baselinesBySeries, expandedMacroTheme, onToggleMacroTheme }: { data: MacroDashboardData; baselinesBySeries: Map<string, BaselinePresentation>; expandedMacroTheme: string | null; onToggleMacroTheme: (id: string) => void }) {
  const { contexts, macroObservations } = data;
  const macroContexts = contexts.filter((context) => context.scope.startsWith("MACRO_"));
  return <>
        <div className="page-intro">
          <span>MAKRO</span>
          <h1>Lingkungan makro</h1>
          <p>Suku bunga, inflasi, likuiditas, tenaga kerja, USD, dan pertumbuhan ditempatkan di bagian ini. Jadwal event dan berita berada di Konteks.</p>
        </div>
        <div className="intraday-secondary-grid">
          <NetLiquidityPanel data={data.netLiquidity} />
          <RatesInflationPanel data={data.ratesInflation} />
        </div>
        <div className="menu-grid" style={{ marginTop: "1rem" }}>
          <section className="panel calendar macro-theme-panel">
            <div className="panel-label"><span>DATA MAKRO</span><span>{macroContexts.length} TEMA · {macroObservations.length} INDIKATOR</span></div>
            <h2>Indikator utama</h2>
            {macroObservations.length
              ? macroContexts.map((context) => <MacroThemeCard
                  context={context}
                  observations={macroObservations}
                  baselines={baselinesBySeries}
                  expanded={expandedMacroTheme === context.id}
                  onToggle={() => onToggleMacroTheme(context.id)}
                  key={context.id}
                />)
              : <EmptyPanelNote label="observasi makro" />}
          </section>
        </div>
      </>;
}
