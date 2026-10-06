import { relativeTimeID } from "@/lib/data/format";
import type { DashboardData } from "@/lib/data/dashboard-data";

type CatalystItem = DashboardData["catalystWire"]["items"][number];

const SOURCE_ROLE_LABEL: Record<CatalystItem["sourceRole"], string> = {
  PRIMARY: "SUMBER RESMI",
  MEDIA: "MEDIA",
  DISCOVERY: "PENEMUAN",
};

const TIME_BASIS_LABEL: Record<CatalystItem["timeBasis"], string> = {
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

function CatalystRow({ item }: { item: CatalystItem }) {
  return (
    <article className="catalyst-wire-item">
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
  );
}

export function CatalystWirePanel({
  data,
}: {
  data: DashboardData["catalystWire"];
}) {
  const visibleItems = data.items.slice(0, 5);
  const overflowItems = data.items.slice(5);

  return (
    <section className="catalyst-wire" aria-labelledby="catalyst-wire-title">
      <div className="catalyst-wire-head">
        <div>
          <span className="catalyst-wire-kicker">CATALYST WIRE · FAKTUAL</span>
          <h2 id="catalyst-wire-title">Catalyst terbaru</h2>
          <p>
            Berita pasar terbaru untuk ditelusuri. Kedekatan waktu bukan bukti sebab-akibat.
          </p>
        </div>
        <div className="catalyst-wire-status">
          <strong>{DISCOVERY_STATUS_LABEL[data.discoveryStatus]}</strong>
          <span>
            {data.discoveryFeedAt
              ? `feed ${relativeTimeID(data.discoveryFeedAt)}`
              : "belum ada snapshot"}
          </span>
        </div>
      </div>

      <div className="catalyst-wire-legend" aria-label="Peran sumber berita">
        <span className="primary">RESMI</span>
        <span className="media">MEDIA</span>
        <span className="discovery">DISCOVERY</span>
      </div>

      {visibleItems.length ? (
        <>
          <div className="catalyst-wire-list">
            {visibleItems.map((item) => <CatalystRow item={item} key={item.id} />)}
          </div>

          {overflowItems.length > 0
            ? <details className="catalyst-wire-more">
                <summary>
                  <span>{overflowItems.length} catalyst lainnya</span>
                  <strong>LIHAT SEMUA</strong>
                </summary>
                <div className="catalyst-wire-list catalyst-wire-list-more">
                  {overflowItems.map((item) => <CatalystRow item={item} key={item.id} />)}
                </div>
              </details>
            : null}
        </>
      ) : (
        <p className="catalyst-wire-empty">
          Belum ada headline yang ditampilkan dari sumber yang tersedia pada cutoff ini.
        </p>
      )}

      <div className="catalyst-wire-foot">
        <span>{data.items.length} ITEM</span>
        {data.excludedTitleCount > 0
          ? <span>{data.excludedTitleCount} judul promosi/topik lain tersaring</span>
          : null}
        <span>
          RESMI {data.primaryItemCount} · MEDIA {data.mediaItemCount} · DISCOVERY {data.discoveryItemCount}
        </span>
      </div>
    </section>
  );
}
