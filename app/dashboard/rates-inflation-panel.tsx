"use client";

import type {
  RatesInflationReadModel,
  RatesSeriesChangeUnit,
  RatesSeriesPoint,
  RatesSeriesValueUnit,
} from "@/lib/application/rates-inflation";
import type { DataQuality } from "@/lib/domain/types";

const LABELS: Record<RatesSeriesPoint["seriesKey"], string> = {
  EFFR: "Effective Fed Funds Rate",
  IORB: "Interest on Reserve Balances",
  SOFR: "Secured Overnight Financing Rate",
  SOFR_IORB_SPREAD: "Spread SOFR−IORB",
  WRESBAL: "Reserve balances",
  DGS2: "Treasury AS 2 tahun",
  DFII10: "Real yield AS 10 tahun",
  DTWEXBGS: "Broad USD Index",
  T10Y2Y: "Kurva 10Y–2Y",
};

const QUALITY_LABELS: Record<DataQuality, string> = {
  FRESH: "TERBARU SAAT DIPEROLEH",
  STALE: "SUDAH LAMA SAAT DIPEROLEH",
  PARTIAL: "DATA SEBAGIAN",
  UNKNOWN: "KUALITAS TIDAK DIKETAHUI",
};

const GROUPS: Array<{
  label: string;
  description: string;
  keys: RatesSeriesPoint["seriesKey"][];
}> = [
  {
    label: "KORIDOR KEBIJAKAN & FUNDING",
    description: "EFFR, IORB, SOFR, dan spread SOFR−IORB.",
    keys: ["EFFR", "IORB", "SOFR", "SOFR_IORB_SPREAD"],
  },
  {
    label: "LIKUIDITAS RESERVE",
    description: "Reserve balances Federal Reserve; seri ini berkadensi mingguan.",
    keys: ["WRESBAL"],
  },
  {
    label: "RANTAI TRANSMISI",
    description: "Treasury 2Y, real yield 10Y, broad USD, dan kemiringan kurva 10Y−2Y.",
    keys: ["DGS2", "DFII10", "DTWEXBGS", "T10Y2Y"],
  },
];

function date(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateTime(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function sepHorizonLabel(horizon: string): string {
  if (horizon === "LONGER_RUN") return "Jangka panjang";
  const match = horizon.match(/^YEAR_END_(20\d{2})$/);
  return match ? `Akhir ${match[1]}` : horizon;
}

function signed(value: number, digits = 1): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  }).format(value);
}

function valueLabel(value: number, unit: RatesSeriesValueUnit): string {
  if (unit === "PERCENT") {
    return `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
  }
  if (unit === "BPS") {
    return `${signed(value, 1)} bps`;
  }
  if (unit === "USD_BILLIONS") {
    return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)} miliar USD`;
  }
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function changeLabel(value: number | null, unit: RatesSeriesChangeUnit, cadence: RatesSeriesPoint["cadence"], horizon: "1D" | "1W"): string {
  if (value === null) {
    if (cadence === "WEEKLY" && horizon === "1D") return "Tidak tersedia untuk data mingguan";
    return "Belum cukup riwayat";
  }
  if (unit === "BPS") return `${signed(value, 1)} bps`;
  if (unit === "USD_BILLIONS") return `${signed(value, 1)} miliar USD`;
  return `${signed(value, 2)}%`;
}

function Horizon({
  label,
  value,
  from,
  point,
}: {
  label: "1 HARI" | "1 MINGGU";
  value: number | null;
  from: string | null;
  point: RatesSeriesPoint;
}) {
  const horizon = label === "1 HARI" ? "1D" : "1W";
  return <div>
    <strong>{label}</strong>
    <span>{changeLabel(value, point.changeUnit, point.cadence, horizon)}</span>
    <small>
      {from
        ? `dibanding observasi ${date(from)}`
        : point.cadence === "WEEKLY" && horizon === "1D"
          ? "Cadence canonical seri ini mingguan."
          : "Tidak ada observasi pada atau sebelum target."}
    </small>
  </div>;
}

function SeriesCard({ point }: { point: RatesSeriesPoint }) {
  return <article className="panel" style={{ margin: 0 }}>
    <div className="panel-label">
      <span>{point.seriesKey}</span>
      <span>{QUALITY_LABELS[point.quality]}</span>
    </div>
    <h3 style={{ marginBottom: ".35rem" }}>{LABELS[point.seriesKey]}</h3>
    <strong style={{ display: "block", fontSize: "1.55rem" }}>{valueLabel(point.value, point.valueUnit)}</strong>
    <p className="muted" style={{ marginTop: ".35rem" }}>
      Observasi {date(point.observedAt)} · diperoleh {date(point.retrievedAt)}
    </p>
    <div className="monitor-list" style={{ marginTop: ".75rem" }}>
      <Horizon label="1 HARI" value={point.change1d} from={point.change1dFrom} point={point} />
      <Horizon label="1 MINGGU" value={point.change1w} from={point.change1wFrom} point={point} />
    </div>
  </article>;
}

function SepPolicyExpectation({ data }: { data: RatesInflationReadModel["sep"] }) {
  if (data.status === "UNAVAILABLE") {
    return <section style={{ marginTop: "1rem" }}>
      <div className="panel-label"><span>EKSPEKTASI KEBIJAKAN · SEP</span><span>BELUM TERSEDIA</span></div>
      <p className="muted" style={{ marginTop: ".4rem" }}>{data.reason}</p>
    </section>;
  }

  const meeting = data.meetingStartDate && data.meetingEndDate
    ? `FOMC ${date(data.meetingStartDate)}–${date(data.meetingEndDate)}`
    : null;

  return <section style={{ marginTop: "1rem" }}>
    <div className="panel-label">
      <span>EKSPEKTASI KEBIJAKAN · SEP</span>
      <span>{data.points.length} HORIZON · RILIS RESMI</span>
    </div>
    <p className="muted" style={{ marginTop: ".4rem" }}>
      Median suku bunga kebijakan yang dipublikasikan peserta FOMC. Ini adalah expectation resmi SEP,
      bukan probabilitas pasar dan bukan sinyal hawkish/dovish.
    </p>
    <p className="muted" style={{ marginTop: ".35rem" }}>
      Rilis {dateTime(data.observedAt)} UTC · diperoleh {dateTime(data.retrievedAt)} UTC
      {meeting ? ` · ${meeting}` : ""}
    </p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: ".75rem", marginTop: ".75rem" }}>
      {data.points.map((point) => <article className="panel" style={{ margin: 0 }} key={point.seriesKey}>
        <div className="panel-label">
          <span>{sepHorizonLabel(point.horizon)}</span>
          <span>{QUALITY_LABELS[point.quality]}</span>
        </div>
        <strong style={{ display: "block", fontSize: "1.45rem" }}>
          {new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(point.valuePct)}%
        </strong>
        <small className="muted">Median resmi Federal Reserve</small>
      </article>)}
    </div>
  </section>;
}

export function RatesInflationPanel({ data }: { data: RatesInflationReadModel }) {
  const byKey = new Map(data.status === "OK" ? data.series.map((point) => [point.seriesKey, point]) : []);

  return <section className="panel" aria-labelledby="rates-policy-title">
    <div className="panel-label"><span>RATES & POLICY</span><span>FAKTUAL · DURABLE</span></div>
    <h2 id="rates-policy-title">Apa yang berubah pada rates, policy corridor, dan transmisi?</h2>
    <p className="lead-copy">
      Nilai terakhir, perubahan 1 hari dan 1 minggu, serta freshness dibaca dari Market Memory.
      Spread SOFR−IORB dihitung dari observasi yang sinkron secara tanggal. Tidak ada label bullish,
      bearish, regime, atau atribusi sebab-akibat.
    </p>

    {data.status === "UNAVAILABLE"
      ? <p className="muted">{data.reason}</p>
      : GROUPS.map((group) => {
          const points = group.keys.flatMap((key) => {
            const point = byKey.get(key);
            return point ? [point] : [];
          });
          return <section key={group.label} style={{ marginTop: "1rem" }}>
            <div className="panel-label"><span>{group.label}</span><span>{points.length}/{group.keys.length} SERI</span></div>
            <p className="muted" style={{ marginTop: ".4rem" }}>{group.description}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: ".75rem", marginTop: ".75rem" }}>
              {points.map((point) => <SeriesCard key={point.seriesKey} point={point} />)}
            </div>
          </section>;
        })}

    <SepPolicyExpectation data={data.sep} />

    <p className="muted" style={{ marginBottom: 0, marginTop: "1rem" }}>
      P365 hanya menampilkan fakta rates & policy serta expectation SEP yang sudah durable. Distribusi dot lengkap
      sudah tersimpan tetapi belum divisualisasikan pada irisan tipis ini. Fed funds futures/OIS, gap SEP-versus-market,
      MOVE Index, dan aturan perubahan regime belum diaktifkan.
    </p>
  </section>;
}
