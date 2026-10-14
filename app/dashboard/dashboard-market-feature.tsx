"use client";

import type { DashboardData } from "@/lib/data/dashboard-data";
import type { DataQuality, Observation } from "@/lib/domain/types";
import type { BaselinePresentation } from "@/lib/presentation/baseline";
import { relativeTimeID } from "@/lib/data/format";
import { formatMacroDisplayValue } from "@/lib/presentation/macro-display";
import { buildFinancialMarketOverview } from "@/lib/presentation/financial-market-overview";
import { MACRO_CONTEXT_LABELS, MACRO_HEADLINE_SERIES, MACRO_SERIES_LABELS } from "./dashboard-macro-feature";
import { StatusBadge, EmptyPanelNote, observationStatus, numberValue, formatMoney, qualityLabel, observationChangePercent, TerminalChange, marketTapeQualityTone } from "./dashboard-common-ui";
import { FinancialMarketOverviewPanel } from "./financial-market-overview-panel";
import { MaterialMoveMonitorPanel } from "./material-move-monitor-panel";

function OverviewMarketTape({ data, observations }: { data: DashboardData; observations: Observation[] }) {
  const bitcoin = observations.find((item) => item.subject === "btc.spot.usd");
  const gold = observations.find((item) => item.subject === "gold.futures.usd");
  const dxy = observations.find((item) => item.subject === "dxy.index.usd");
  const us10y = observations.find((item) => String(item.metadata?.seriesId ?? "") === "DGS10");
  const bitcoinValue = bitcoin ? numberValue(bitcoin.value) : null;
  const goldValue = gold ? numberValue(gold.value) : null;
  const dxyValue = dxy ? numberValue(dxy.value) : null;

  return <section className="market-terminal-strip" aria-labelledby="market-tape-title">
    <div className="market-terminal-ambient" aria-hidden="true" />
    <div className="market-terminal-head">
      <div>
        <span className="market-terminal-kicker">MARKET TAPE · FAKTUAL</span>
        <h2 id="market-tape-title">Snapshot lintas pasar</h2>
        <p className="market-terminal-subtitle">Harga dan yield lintas pasar dalam satu pandangan. Flow ETF dan likuiditas stablecoin tetap berada di bagian Crypto.</p>
      </div>
      <div className="market-terminal-cutoff">
        <span>CUTOFF</span>
        <strong>{relativeTimeID(data.mvpFactualContext.asOf)}</strong>
      </div>
    </div>

    <div className="market-terminal-grid market-terminal-grid-four">
      <article className="market-terminal-card primary">
        <div className="market-terminal-card-head">
          <div><span className="market-terminal-asset">BTC</span><small>SPOT</small></div>
          <span className={`market-terminal-status ${marketTapeQualityTone(bitcoin?.quality)}`}>{bitcoin ? qualityLabel(bitcoin.quality) : "BELUM ADA"}</span>
        </div>
        <strong className="market-terminal-value">{bitcoinValue !== null ? formatMoney(bitcoinValue) : "—"}</strong>
        <TerminalChange value={observationChangePercent(bitcoin)} />
        <small className="market-terminal-source">{bitcoin ? `CoinGecko · ${relativeTimeID(bitcoin.observedAt)}` : "Harga spot belum tersedia"}</small>
      </article>

      <article className="market-terminal-card">
        <div className="market-terminal-card-head">
          <div><span className="market-terminal-asset">GOLD</span><small>FUTURES</small></div>
          <span className={`market-terminal-status ${marketTapeQualityTone(gold?.quality)}`}>{gold ? qualityLabel(gold.quality) : "BELUM ADA"}</span>
        </div>
        <strong className="market-terminal-value">{goldValue !== null ? formatMoney(goldValue) : "—"}</strong>
        <TerminalChange value={observationChangePercent(gold)} />
        <small className="market-terminal-source">{gold ? `Yahoo · GC=F · ${relativeTimeID(gold.observedAt)}` : "Gold futures belum tersedia"}</small>
      </article>

      <article className="market-terminal-card">
        <div className="market-terminal-card-head">
          <div><span className="market-terminal-asset">DXY</span><small>USD INDEX</small></div>
          <span className={`market-terminal-status ${marketTapeQualityTone(dxy?.quality)}`}>{dxy ? qualityLabel(dxy.quality) : "BELUM ADA"}</span>
        </div>
        <strong className="market-terminal-value">{dxyValue !== null ? dxyValue.toFixed(2) : "—"}</strong>
        <TerminalChange value={observationChangePercent(dxy)} />
        <small className="market-terminal-source">{dxy ? `Yahoo · DX-Y.NYB · ${relativeTimeID(dxy.observedAt)}` : "Dollar Index belum tersedia"}</small>
      </article>

      <article className="market-terminal-card">
        <div className="market-terminal-card-head">
          <div><span className="market-terminal-asset">US 10Y</span><small>YIELD</small></div>
          <span className={`market-terminal-status ${marketTapeQualityTone(us10y?.quality)}`}>{us10y ? qualityLabel(us10y.quality) : "BELUM ADA"}</span>
        </div>
        <strong className="market-terminal-value">{us10y ? formatMacroDisplayValue(us10y.value, String(us10y.metadata?.unit ?? "")) : "—"}</strong>
        <span className="terminal-change neutral">TREASURY YIELD</span>
        <small className="market-terminal-source">{us10y ? `FRED · DGS10 · ${relativeTimeID(us10y.observedAt)}` : "Yield 10Y belum tersedia"}</small>
      </article>

    </div>

    <div className="market-terminal-foot">
      <span>FAKTUAL · NON-PRESKRIPTIF</span>
      <span>Detail flow dan likuiditas crypto tersedia di bagian Crypto.</span>
    </div>
  </section>;
}

type CrossAssetMetric = {
  id: string;
  label: string;
  providerLabel: string;
  value: number;
  unit: "USD" | "INDEX";
  observedAt: string;
  quality: DataQuality;
};

function buildCrossAssetMetrics(observations: Observation[]): CrossAssetMetric[] {
  const definitions: Array<Omit<CrossAssetMetric, "value" | "observedAt" | "quality">> = [
    { id: "gold.futures.usd", label: "GOLD · COMEX FRONT-MONTH", providerLabel: "Yahoo Finance · GC=F", unit: "USD" },
    { id: "russell2000.index.usd", label: "RUSSELL 2000 INDEX", providerLabel: "Yahoo Finance · ^RUT", unit: "INDEX" },
    { id: "dxy.index.usd", label: "DXY · ICE U.S. DOLLAR INDEX", providerLabel: "Yahoo Finance · DX-Y.NYB", unit: "INDEX" },
  ];

  return definitions.flatMap((definition) => {
    const item = observations.find((observation) => observation.subject === definition.id);
    if (!item) return [];
    const value = numberValue(item.value);
    if (value === null) return [];
    return [{ ...definition, value, observedAt: item.observedAt, quality: item.quality }];
  });
}

function CrossAssetMarketPanel({ observations }: { observations: Observation[] }) {
  const metrics = buildCrossAssetMetrics(observations);
  const broadUsd = observations.find((item) => String(item.metadata?.seriesId ?? "") === "DTWEXBGS");

  return <section className="panel" aria-labelledby="cross-asset-title">
    <div className="panel-label"><span>CROSS-ASSET MARKET</span><StatusBadge value={observationStatus(metrics.map((metric) => metric.quality))} /></div>
    <h2 id="cross-asset-title">Gold, Russell 2000 & Dollar Index</h2>
    <p className="lead-copy">Market observations are shown as distinct instruments. DXY is the ICE U.S. Dollar Index and is not the Federal Reserve broad trade-weighted dollar index.</p>
    {metrics.length ? <div className="metric-card-grid">{metrics.map((metric) => <article className="compact-metric-card" key={metric.id}><div className="compact-metric-head"><span>{metric.label}</span><small>{metric.quality}</small></div><strong>{metric.unit === "USD" ? formatMoney(metric.value) : metric.value.toFixed(2)}</strong><p>{metric.providerLabel} · {relativeTimeID(metric.observedAt)}</p></article>)}</div> : <EmptyPanelNote label="Gold, Russell 2000, dan DXY" />}
    <div className="monitor-list" style={{ marginTop: "1rem" }}><div><strong>USD INDEX SEMANTICS</strong><span>DXY / ICE U.S. Dollar Index = DX-Y.NYB · Fed Broad Trade-Weighted USD = DTWEXBGS{broadUsd ? " · keduanya tersedia sebagai metric berbeda" : ""}.</span></div></div>
  </section>;
}

type HeatmapTile = {
  id: string;
  label: string;
  group: "CROSS-ASSET" | "MACRO" | "CRYPTO";
  value: string;
  delta: number | null;
  deltaUnit: "ABSOLUTE" | "PERCENT";
  changeBasis?: string;
  source: string;
};

function MarketHeatmap({ observations, baselines }: { observations: Observation[]; baselines: BaselinePresentation[] }) {
  const baselineBySeries = new Map(baselines.map((item) => [item.seriesId, item]));
  const definitions = [
    { id: "gold.futures.usd", label: "GOLD", group: "CROSS-ASSET" as const, source: "Yahoo · GC=F" },
    { id: "russell2000.index.usd", label: "RUSSELL 2000", group: "CROSS-ASSET" as const, source: "Yahoo · ^RUT" },
    { id: "dxy.index.usd", label: "DXY · ICE", group: "CROSS-ASSET" as const, source: "Yahoo · DX-Y.NYB" },
    { id: "btc.spot.usd", label: "BITCOIN", group: "CRYPTO" as const, source: "CoinGecko" },
    { id: "eth.spot.usd", label: "ETHEREUM", group: "CRYPTO" as const, source: "CoinGecko" },
    { id: "crypto.btc_dominance.pct", label: "BTC DOMINANCE", group: "CRYPTO" as const, source: "CoinGecko" },
  ];
  const marketTiles: HeatmapTile[] = definitions.flatMap((definition) => {
    const observation = observations.find((item) => item.subject === definition.id);
    if (!observation) return [];
    const rawChangePct = observation.metadata?.changePct;
    const hasProviderChange = rawChangePct !== null && rawChangePct !== undefined && Number.isFinite(Number(rawChangePct));
    const providerChangePct = hasProviderChange ? Number(rawChangePct) : null;
    return [{ ...definition, value: observation.value, delta: providerChangePct, deltaUnit: "PERCENT" as const, changeBasis: hasProviderChange ? String(observation.metadata?.changeBasis ?? "provider_reference") : undefined }];
  });
  const macroScopes = ["MACRO_MONETARY_POLICY", "MACRO_LIQUIDITY", "MACRO_INFLATION", "MACRO_LABOR", "MACRO_RATES", "MACRO_USD", "MACRO_GROWTH"];
  const macroTiles: HeatmapTile[] = macroScopes.flatMap((scope) => {
    const preferredSeries = MACRO_HEADLINE_SERIES[scope];
    const observation = observations.find((item) => item.domain === "MACRO" && String(item.metadata?.seriesId ?? "") === preferredSeries);
    if (!observation) return [];
    const seriesId = String(observation.metadata?.seriesId ?? "");
    const baseline = baselineBySeries.get(seriesId);
    return [{ id: scope, label: MACRO_CONTEXT_LABELS[scope] ?? scope, group: "MACRO" as const, value: formatMacroDisplayValue(observation.value, String(observation.metadata?.unit ?? "")), delta: baseline?.status === "VALID" ? baseline.changeValue : null, deltaUnit: "ABSOLUTE" as const, source: `${MACRO_SERIES_LABELS[seriesId] ?? seriesId} · ${seriesId}` }];
  });
  const tiles = [...marketTiles, ...macroTiles];
  const groups: Array<HeatmapTile["group"]> = ["CROSS-ASSET", "MACRO", "CRYPTO"];

  return <section className="heatmap-view" aria-labelledby="heatmap-title">
    <div className="heatmap-heading"><div><div className="panel-label"><span>PETA PASAR</span><span>FAKTUAL · NON-PRESKRIPTIF</span></div><h2 id="heatmap-title">Heatmap Pasar</h2><p className="lead-copy">Warna hanya menunjukkan perubahan faktual terhadap baseline valid. Tanpa baseline yang valid, tile tetap netral.</p></div><div className="heatmap-legend"><span><i className="heatmap-dot up" /> Naik</span><span><i className="heatmap-dot down" /> Turun</span><span><i className="heatmap-dot neutral" /> Netral / belum ada baseline</span></div></div>
    <div className="heatmap-groups">{groups.map((group) => {
      const items = tiles.filter((tile) => tile.group === group);
      if (!items.length) return null;
      return <section className="heatmap-group" key={group}><div className="heatmap-group-head"><strong>{group}</strong><span>{items.length} METRIC</span></div><div className="heatmap-grid">{items.map((tile) => {
        const direction = tile.delta === null || tile.delta === 0 ? "neutral" : tile.delta > 0 ? "up" : "down";
        return <article className={`heatmap-tile ${direction}`} key={tile.id}><span className="heatmap-name">{tile.label}</span><strong>{tile.delta === null ? "—" : `${tile.delta > 0 ? "+" : ""}${tile.delta.toFixed(2)}${tile.deltaUnit === "PERCENT" ? "%" : ""}`}</strong><span className="heatmap-value">{tile.value}</span><small>{tile.source}{tile.changeBasis ? ` · ${tile.changeBasis.replace("_", " ")}` : ""}</small></article>;
      })}</div></section>;
    })}</div>
    <div className="heatmap-semantic-note"><strong>USD INDEX SEMANTICS</strong><span>DXY · ICE = DX-Y.NYB. FED BROAD USD = DTWEXBGS. Keduanya merupakan metric berbeda dan tidak diperlakukan sebagai substitusi.</span></div>
  </section>;
}


export function MarketSection({ data, baselinePresentations }: { data: DashboardData; baselinePresentations: BaselinePresentation[] }) {
  const { observations, macroObservations } = data;
  return <>
        <div className="page-intro">
          <span>PASAR</span>
          <h1>Harga dan pergerakan material</h1>
          <p>Bagian Pasar menampung snapshot lintas pasar, deteksi pergerakan material, dan heatmap faktual. Tidak ada sinyal trading yang ditambahkan.</p>
        </div>
        <OverviewMarketTape data={data} observations={observations} />
        <FinancialMarketOverviewPanel data={buildFinancialMarketOverview({
          readContext: data.marketReadContext,
          observations: [...observations, ...macroObservations],
          baselines: baselinePresentations,
          unifiedMacro: data.ratesInflation.unifiedMacro,
          materialMove: data.materialMoveMonitor,
        })} />
        <div style={{ marginTop: "1rem" }}>
          <MaterialMoveMonitorPanel data={data.materialMoveMonitor} />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <MarketHeatmap observations={observations} baselines={baselinePresentations} />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <CrossAssetMarketPanel observations={observations} />
        </div>
      </>;
}
