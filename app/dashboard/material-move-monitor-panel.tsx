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

function percent(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function percentile(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `P${value.toFixed(1)}`;
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
