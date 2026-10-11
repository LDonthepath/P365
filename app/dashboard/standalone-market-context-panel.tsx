import type { StandaloneMarketContextReadModel, MarketContextStatus } from "@/lib/application/standalone-market-context";

const STATUS: Record<MarketContextStatus, string> = {
  CURRENT: "TERBARU",
  PARTIAL: "CAKUPAN SEBAGIAN",
  STALE: "DATA TERTUNDA",
  EMPTY: "TANPA KANDIDAT PADA SNAPSHOT",
  UNAVAILABLE: "DATA BELUM TERSEDIA",
  UNKNOWN: "GAGAL DIVERIFIKASI",
};

function formatTime(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Belum diketahui";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  }).format(new Date(value)) + " WIB";
}

function formatBtc(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value);
}

/**
 * Read-only, independent of the MATERIAL_MOVE trigger.
 * "Available" describes source coverage, never causality or trading direction.
 */
export function StandaloneMarketContextPanel({
  data,
}: {
  data: StandaloneMarketContextReadModel;
}) {
  const flow = data.flow;
  const gdelt = data.discovery;
  return (
    <section className="panel standalone-market-context" aria-labelledby="market-activity-title" style={{ marginTop: "1rem" }}>
      <div className="panel-label">
        <span>KONTEKS PASAR · FAKTUAL</span>
        <time dateTime={data.asOf}>Cutoff {formatTime(data.asOf)}</time>
      </div>
      <h2 id="market-activity-title">Apa yang teramati di pasar sekarang?</h2>
      <p className="lead-copy">
        Informasi dari data tersimpan, tersedia tanpa menunggu sinyal pergerakan material (MOVE).
        Aktivitas transaksi dan kandidat berita tidak membuktikan penyebab perubahan harga.
      </p>

      <div className="decision-grid" style={{ marginTop: "1rem" }}>
        <article className="panel" aria-label="Aktivitas spot BTC Binance">
          <div className="panel-label">
            <span>BTC · ARUS TAKER SPOT</span>
            <strong>{STATUS[flow.status]}</strong>
          </div>
          <h3>Binance BTCUSDT</h3>
          <p className="lead-copy">
            {flow.netTakerBaseVolumeBtc === null
              ? "Net taker beli dikurangi taker jual: belum tersedia."
              : <>Net taker 5-menit terakhir: <strong>{formatBtc(flow.netTakerBaseVolumeBtc)} BTC</strong> (beli {formatBtc(flow.takerBuyBaseVolumeBtc)} BTC; jual {formatBtc(flow.takerSellBaseVolumeBtc)} BTC).</>}
          </p>
          <p className="muted">
            Cakupan: {flow.observedWindows}/{flow.expectedWindows} interval 5-menit berurutan ·
            Sumber: {flow.source}, satu venue saja.
          </p>
          <p className="muted">Interval: {formatTime(flow.windowStartAt)} – {formatTime(flow.observedAt)}. Diambil P365: {formatTime(flow.retrievedAt)}.</p>
          <p className="section-note">{flow.reason}</p>
        </article>

        <article className="panel" aria-label="Kandidat berita BTC dan Gold GDELT">
          <div className="panel-label">
            <span>BERITA · PENEMUAN GDELT GAL</span>
            <span>FEED 15 MENIT</span>
          </div>
          <h3>Kandidat berita BTC dan Emas</h3>
          {gdelt.map((asset) => (
            <div key={asset.asset} style={{ padding: "0.5rem 0", borderBottom: "1px solid var(--line)" }}>
              <p className="lead-copy">
                <strong>{asset.asset === "BTC" ? "BTC" : "Emas"}</strong> · {STATUS[asset.status]}
                {asset.matchingCandidates !== null ? <> · {asset.matchingCandidates} kandidat terdeteksi</> : null}
              </p>
              <p className="muted">
                Cakupan feed: {formatTime(asset.feedWindowStartAt)} – {formatTime(asset.feedLastBuildAt)}.
                Diterima: {formatTime(asset.retrievedAt)}. Sumber: {asset.source}.
              </p>
              <p className="section-note">{asset.reason}</p>
            </div>
          ))}
          <p className="muted">Kandidat GDELT adalah hasil pencarian sumber terbuka, bukan konfirmasi kebenaran atau atribusi kausal.</p>
        </article>
      </div>
    </section>
  );
}
