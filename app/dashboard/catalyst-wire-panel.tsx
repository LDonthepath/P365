import { relativeTimeID } from "@/lib/data/format";
import type { DashboardData } from "@/lib/data/dashboard-data";

const SOURCE_ROLE_LABEL: Record<
  DashboardData["catalystWire"]["items"][number]["sourceRole"],
  string
> = {
  PRIMARY: "SUMBER RESMI",
  MEDIA: "MEDIA",
  DISCOVERY: "PENEMUAN",
};

const TIME_BASIS_LABEL: Record<
  DashboardData["catalystWire"]["items"][number]["timeBasis"],
  string
> = {
  PUBLISHED: "DITERBITKAN",
  SOURCE_OR_FIRST_SEEN: "WAKTU SUMBER / PERTAMA TERLIHAT",
  DISCOVERED: "DITEMUKAN P365",
};

const DISCOVERY_STATUS_LABEL: Record<
  DashboardData["catalystWire"]["discoveryStatus"],
  string
> = {
  CURRENT: "GDELT AKTIF",
  STALE: "GDELT TERTUNDA",
  UNAVAILABLE: "GDELT BELUM TERSEDIA",
};

export function CatalystWirePanel({
  data,
}: {
  data: DashboardData["catalystWire"];
}) {
  return (
    <section className="catalyst-wire" aria-labelledby="catalyst-wire-title">
      <div className="catalyst-wire-head">
        <div>
          <span className="catalyst-wire-kicker">CATALYST WIRE · FAKTUAL</span>
          <h2 id="catalyst-wire-title">Informasi baru yang perlu diperiksa</h2>
          <p>
            Sumber resmi, media, dan discovery dipisahkan. Kedekatan headline dengan
            pergerakan pasar bukan bukti sebab-akibat.
          </p>
        </div>
        <div className="catalyst-wire-status">
          <strong>{DISCOVERY_STATUS_LABEL[data.discoveryStatus]}</strong>
          <span>
            {data.discoveryFeedAt
              ? `feed ${relativeTimeID(data.discoveryFeedAt)}`
              : "belum ada snapshot discovery"}
          </span>
        </div>
      </div>

      <div className="catalyst-wire-legend" aria-label="Peran sumber berita">
        <span className="primary">SUMBER RESMI</span>
        <span className="media">MEDIA</span>
        <span className="discovery">PENEMUAN</span>
      </div>

      {data.items.length ? (
        <div className="catalyst-wire-list">
          {data.items.map((item) => (
            <article className="catalyst-wire-item" key={item.id}>
              <div className="catalyst-wire-meta">
                <span className={`source-role ${item.sourceRole.toLowerCase()}`}>
                  {SOURCE_ROLE_LABEL[item.sourceRole]}
                </span>
                <span>{item.scope}</span>
                <time dateTime={item.displayAt}>{relativeTimeID(item.displayAt)}</time>
              </div>
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.title}
              </a>
              <div className="catalyst-wire-source">
                <span>{item.sourceLabel}</span>
                <span>{TIME_BASIS_LABEL[item.timeBasis]}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="catalyst-wire-empty">
          Belum ada catalyst terbaru dari sumber yang tersedia pada cutoff ini.
        </p>
      )}

      <div className="catalyst-wire-foot">
        <span>{data.items.length} ITEM DITAMPILKAN</span>
        <span>
          RESMI {data.primaryItemCount} · MEDIA {data.mediaItemCount} · PENEMUAN {data.discoveryItemCount}
        </span>
      </div>
    </section>
  );
}
