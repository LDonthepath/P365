import { relativeTimeID } from "@/lib/data/format";
import type { FinancialMarketOverview, FinancialMarketRow } from "@/lib/presentation/financial-market-overview";
import styles from "./financial-market-overview.module.css";

const SOURCE: Record<string, string> = {
  fred: "FRED", "yahoo-finance": "Yahoo Finance",
  "coingecko-market": "CoinGecko",
};
const SERIES: Record<string, string> = {
  "btc.spot.usd": "BTC Spot", "eth.spot.usd": "ETH Spot",
  "gold.futures.usd": "Emas berjangka COMEX (GC=F)",
  "dxy.index.usd": "DXY", "fx.usdjpy.jpy_per_usd": "USD/JPY",
  "fx.usdcnh.cnh_per_usd": "USD/CNH",
};

function valueLabel(row: FinancialMarketRow): string {
  if (row.value === null) return "—";
  const decimals = row.unit === "USD" || row.unit === "USD_PER_BARREL" ? 2
    : row.unit === "PERCENT" ? 3 : row.unit === "INDEX" ? 2 : 4;
  const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: decimals }).format(row.value);
  switch (row.unit) {
    case "USD": return "USD " + number;
    case "USD_PER_BARREL": return "USD " + number + "/barel";
    case "PERCENT": return number + "%";
    case "JPY_PER_USD": return number + " JPY/USD";
    case "CNH_PER_USD": return number + " CNH/USD";
    default: return number + " indeks";
  }
}

function changeLabel(row: FinancialMarketRow): string {
  if (row.change === null || !row.predecessorAt) return "Perubahan: belum cukup data";
  const sign = row.change > 0 ? "+" : row.change < 0 ? "−" : "";
  const abs = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Math.abs(row.change));
  const unit = row.changeUnit === "BPS" ? "bps" : row.changeUnit === "INDEX_POINTS"
    ? "poin indeks" : row.changeUnit === "PERCENTAGE_POINTS" ? "poin persentase" : "USD";
  return sign + abs + " " + unit + " vs " + row.predecessorAt.slice(0, 10);
}

function dateLabel(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "waktu belum tersedia";
  return value.length === 10 ? value + " (tanggal observasi)" : value.slice(0, 16) + " UTC";
}

export function FinancialMarketOverviewPanel({ data }: { data: FinancialMarketOverview }) {
  return <section className={"panel " + styles.root} aria-labelledby="financial-market-overview-title">
    <div className="panel-label">
      <span>FINANCIAL MARKET · LINTAS DOMAIN</span>
      <span>FAKTA, BUKAN SINYAL</span>
    </div>
    <div className={styles.heading}>
      <div>
        <h2 id="financial-market-overview-title">Financial Market Overview</h2>
        <p>Harga, yield, risiko, likuiditas, dan cakupan data menurut cadence aslinya. Angka harian FRED bukan pergerakan intraday.</p>
      </div>
      <small>Cutoff {relativeTimeID(data.asOf)}</small>
    </div>

    <div className={styles.groups}>
      {data.groups.map((group) => <article className={styles.group} key={group.name}>
        <header className={styles.groupHead}>
          <h3>{group.name}</h3>
          <span aria-label={"Cakupan " + group.name + ": " + group.coverage}>{group.coverage} · {group.available}/{group.total}</span>
        </header>
        <div className={styles.rows}>
          {group.items.map((row) => <div className={styles.entry} key={row.key}>
            <div className={styles.rowTop}>
              <div className={styles.instrument}>
                <strong>{row.name}</strong>
                <small>{row.cadence} · {row.sourceId ? (SOURCE[row.sourceId] ?? row.sourceId) : "Sumber belum tersedia"}</small>
              </div>
              <div className={styles.metric}>
                <strong>{valueLabel(row)}</strong>
                <span>{row.status}</span>
              </div>
            </div>
            <div className={styles.meta}>
              <span>{changeLabel(row)}</span>
              <span>{row.quality === "STALE" ? "Kualitas: perlu diperbarui"
                : row.quality === "PARTIAL" ? "Kualitas: sebagian"
                : row.quality === "UNKNOWN" ? "Kualitas: belum pasti"
                : row.quality === "FRESH" ? "Kualitas saat diambil: baik" : "Belum ada observasi"}</span>
            </div>
            <details className={styles.details}>
              <summary>Asal dan waktu</summary>
              <div>Seri: {row.key} · sumber: {row.sourceId || "belum tersedia"}</div>
              <div>Observasi: {row.observedAt ? dateLabel(row.observedAt) : "belum tersedia"}</div>
              <div>Diperoleh: {row.retrievedAt ? dateLabel(row.retrievedAt) : "belum tersedia"}</div>
              {row.note ? <div>{row.note}</div> : null}
            </details>
          </div>)}
        </div>
      </article>)}
    </div>

    <div className={styles.comparison}>
      <div className={styles.comparisonHead}>
        <h3>Pergerakan lintas pasar</h3>
        <span>60 / 120 MENIT · MOVE EXISTING</span>
      </div>
      <p>Hanya pasangan intraday yang sudah lolos alignment timestamp di bukti MOVE. Yield harian dan credit spread tidak digabung ke perbandingan ini.</p>
      {data.pairs.length
        ? <div className={styles.pairs}>{data.pairs.map((pair) => <div className={styles.pair} key={pair.target + "-" + pair.companion + "-" + pair.horizonMinutes}>
            <strong>{SERIES[pair.target] ?? pair.target} / {SERIES[pair.companion] ?? pair.companion}</strong>
            <span>{pair.direction} · {pair.horizonMinutes} menit</span>
            <small>{pair.targetChange.toFixed(2)}% / {pair.companionChange.toFixed(2)}% · {SOURCE[pair.sourceId] ?? pair.sourceId}</small>
            <small>Target: {dateLabel(pair.targetStartAt)} → {dateLabel(pair.targetEndAt)}</small>
            <small>Pembanding: {dateLabel(pair.companionStartAt)} → {dateLabel(pair.companionEndAt)}</small>
          </div>)}</div>
        : <p className={styles.empty}>{data.comparisonNote}</p>}
      <small>Hubungan hanya deskriptif; kausalitas tidak dievaluasi. Tidak ada return relatif BTC/XAU Spot atau skor market regime.</small>
    </div>
  </section>;
}
