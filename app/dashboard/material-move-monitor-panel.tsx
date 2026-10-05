import type {
  MaterialMoveAssetReadModel,
  MaterialMoveMonitorReadModel,
} from "@/lib/application/material-move-monitor";
import { relativeTimeID } from "@/lib/data/format";

const ASSET_LABEL: Record<MaterialMoveAssetReadModel["asset"], string> = {
  BTC: "Bitcoin",
  GOLD: "Gold",
};

const ASSESSMENT_LABEL: Record<MaterialMoveAssetReadModel["status"], string> = {
  MATERIAL_MOVE: "GERAKAN MATERIAL",
  BELOW_MATERIALITY_THRESHOLD: "DI BAWAH AMBANG",
  INSUFFICIENT_DATA: "DATA BELUM CUKUP",
  INCOMPATIBLE: "DATA TIDAK KOMPATIBEL",
  UNKNOWN: "STATUS BELUM PASTI",
  UNAVAILABLE: "DATA TIDAK TERSEDIA",
};

const HORIZON_LABEL: Record<MaterialMoveAssetReadModel["horizons"][number]["status"], string> = {
  MATERIAL_MOVE: "MATERIAL",
  BELOW_MATERIALITY_THRESHOLD: "NORMAL",
  INSUFFICIENT_DATA: "DATA KURANG",
  INCOMPATIBLE: "TIDAK KOMPATIBEL",
  UNKNOWN: "BELUM PASTI",
};

const COVERAGE_LABEL = {
  COMPLETE: "LENGKAP",
  PARTIAL: "SEBAGIAN",
  EMPTY: "KOSONG",
  BOUNDED_QUERY_LIMIT_REACHED: "BATAS QUERY TERCAPAI",
  UNAVAILABLE: "TIDAK TERSEDIA",
} as const;


const SYNCHRONOUS_SERIES_LABEL: Record<string, string> = {
  "btc.spot.usd": "BTC",
  "eth.spot.usd": "ETH",
  "dxy.index.usd": "DXY",
  "gold.futures.usd": "GOLD",
  "fx.usdjpy.jpy_per_usd": "USD/JPY",
  "fx.usdcnh.cnh_per_usd": "USD/CNH",
};

const SYNCHRONOUS_STATE_LABEL = {
  AVAILABLE_SYNCHRONOUS: "TERSEDIA",
  INSUFFICIENT_DATA: "DATA KURANG",
  UNKNOWN: "BELUM PASTI",
} as const;

function percent(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function percentile(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `P${value.toFixed(1)}`;
}


function btcAmount(value: number, signed = false): string {
  if (!Number.isFinite(value)) return "—";
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} BTC`;
}

function integer(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("id-ID");
}

function AssetCard({ item }: { item: MaterialMoveAssetReadModel }) {
  const material = item.hasMaterialMove;

  return (
    <article className={`move-monitor-card${material ? " material" : ""}`}>
      <div className="move-monitor-card-head">
        <div>
          <span className="move-monitor-asset">{ASSET_LABEL[item.asset]}</span>
          <small>{item.seriesKey} · {item.sourceId}</small>
        </div>
        <span className={`move-monitor-badge${material ? " material" : ""}`}>
          {ASSESSMENT_LABEL[item.status]}
        </span>
      </div>

      {item.observedAt
        ? <p className="move-monitor-time">Observasi terakhir · {relativeTimeID(item.observedAt)}</p>
        : <p className="move-monitor-time">Belum ada observasi durable yang layak.</p>}

      {item.horizons.length > 0
        ? <div className="move-monitor-horizons">
            {item.horizons.map((horizon) => (
              <div className={`move-monitor-horizon${horizon.status === "MATERIAL_MOVE" ? " material" : ""}`} key={horizon.horizonMinutes}>
                <div>
                  <span>{horizon.horizonMinutes}M</span>
                  <small>{HORIZON_LABEL[horizon.status]}</small>
                </div>
                <strong>{percent(horizon.signedPercentChange)}</strong>
                <p>
                  Ambang {percent(horizon.materialityThresholdPercent)} · {percentile(horizon.targetPercentileRank)}
                </p>
              </div>
            ))}
          </div>
        : null}

      {item.evidence
        ? <div className="move-monitor-evidence">
            <div className="move-monitor-evidence-head">
              <strong>Evidence window</strong>
              <span>
                {item.evidence.evidenceCompleteness === "EVIDENCE_COMPLETE"
                  ? "CAKUPAN LENGKAP"
                  : "CAKUPAN BELUM LENGKAP"}
              </span>
            </div>
            <div className="move-monitor-evidence-grid">
              <div>
                <span>Lintas aset</span>
                <strong>{COVERAGE_LABEL[item.evidence.synchronousCoverage]}</strong>
              </div>
              <div>
                <span>Event terjadwal</span>
                <strong>{item.evidence.scheduledCatalystCount}</strong>
              </div>
              <div>
                <span>Kandidat berita</span>
                <strong>{item.evidence.unscheduledCandidateCount}</strong>
              </div>
              {item.evidence.btcSpotFlow
                ? <div>
                    <span>Spot flow BTC</span>
                    <strong>
                      {item.evidence.btcSpotFlow.observedWindowCount}/{item.evidence.btcSpotFlow.expectedWindowCount}
                    </strong>
                  </div>
                : null}
            </div>

            {item.evidence.synchronousFingerprint.map((fingerprint) => (
              <div className="move-monitor-fingerprint" key={fingerprint.horizonMinutes}>
                <div className="move-monitor-fingerprint-head">
                  <strong>Fingerprint lintas aset</strong>
                  <span>{fingerprint.horizonMinutes}M · {COVERAGE_LABEL[fingerprint.coverage]}</span>
                </div>
                <div className="move-monitor-fingerprint-grid">
                  {fingerprint.series.map((series) => (
                    <div className="move-monitor-fingerprint-item" key={series.seriesKey}>
                      <div>
                        <span>{SYNCHRONOUS_SERIES_LABEL[series.seriesKey] ?? series.seriesKey}</span>
                        <small>{SYNCHRONOUS_STATE_LABEL[series.state]}</small>
                      </div>
                      <strong>{series.state === "AVAILABLE_SYNCHRONOUS" ? percent(series.signedPercentChange) : "—"}</strong>
                    </div>
                  ))}
                </div>
                <p>
                  Perubahan dihitung dari titik point-in-time pada window MOVE yang sama. Gerak bersama tidak membuktikan hubungan sebab-akibat.
                </p>
              </div>
            ))}

            {item.evidence.btcSpotFlow
              ? <div className="move-monitor-spot-flow">
                  <div className="move-monitor-spot-flow-head">
                    <div>
                      <strong>Partisipasi spot BTC</strong>
                      <span>{item.evidence.btcSpotFlow.venue} SPOT · {item.evidence.btcSpotFlow.pair}</span>
                    </div>
                    <span>
                      {item.evidence.btcSpotFlow.windowMinutes !== null
                        ? `${item.evidence.btcSpotFlow.windowMinutes}M · `
                        : ""}
                      {COVERAGE_LABEL[item.evidence.btcSpotFlow.coverage]} · {item.evidence.btcSpotFlow.observedWindowCount}/{item.evidence.btcSpotFlow.expectedWindowCount}
                    </span>
                  </div>
                  <div className="move-monitor-spot-flow-grid">
                    <div>
                      <span>Volume total</span>
                      <strong>{btcAmount(item.evidence.btcSpotFlow.totalBaseVolumeBtc)}</strong>
                    </div>
                    <div>
                      <span>Taker buy</span>
                      <strong>{btcAmount(item.evidence.btcSpotFlow.takerBuyBaseVolumeBtc)}</strong>
                    </div>
                    <div>
                      <span>Taker sell</span>
                      <strong>{btcAmount(item.evidence.btcSpotFlow.takerSellBaseVolumeBtc)}</strong>
                    </div>
                    <div>
                      <span>Net taker</span>
                      <strong>{btcAmount(item.evidence.btcSpotFlow.netTakerBaseVolumeBtc, true)}</strong>
                    </div>
                    <div>
                      <span>Buy share</span>
                      <strong>{item.evidence.btcSpotFlow.takerBuyShare === null
                        ? "—"
                        : percent(item.evidence.btcSpotFlow.takerBuyShare * 100, 1)}</strong>
                    </div>
                    <div>
                      <span>Trade count</span>
                      <strong>{integer(item.evidence.btcSpotFlow.tradeCount)}</strong>
                    </div>
                  </div>
                  <p>
                    Evidence venue-specific Binance Spot. Tidak mewakili seluruh pasar BTC dan tidak membuktikan penyebab pergerakan.
                  </p>
                </div>
              : null}
            <p>
              Window {relativeTimeID(item.evidence.investigationWindow.startAt)} → {relativeTimeID(item.evidence.investigationWindow.endAt)}.
              Evidence hanya menunjukkan fakta yang tersedia pada cutoff tersebut.
            </p>
          </div>
        : null}
    </article>
  );
}

export function MaterialMoveMonitorPanel({ data }: { data: MaterialMoveMonitorReadModel }) {
  const materialCount = data.assets.filter((item) => item.hasMaterialMove).length;

  return (
    <section className="panel move-monitor" aria-labelledby="move-monitor-title">
      <div className="move-monitor-head">
        <div>
          <span className="move-monitor-kicker">MOVE MONITOR · FAKTUAL</span>
          <h2 id="move-monitor-title">Pergerakan material BTC & Gold</h2>
          <p>
            Membandingkan perubahan 15/30/60/120 menit dengan distribusi historis rolling yang sudah dikalibrasi.
            Status material berarti pergerakan melewati ambang historis, bukan sinyal trading.
          </p>
        </div>
        <div className="move-monitor-summary">
          <strong>{materialCount} MATERIAL</strong>
          <span>Cutoff {relativeTimeID(data.asOf)}</span>
        </div>
      </div>

      <div className="move-monitor-grid">
        {data.assets.map((item) => <AssetCard item={item} key={item.asset} />)}
      </div>

      <div className="move-monitor-foot">
        <span>Atribusi kausal belum dievaluasi.</span>
        <span>Sinkronisasi atau korelasi tidak membuktikan penyebab.</span>
      </div>
    </section>
  );
}
