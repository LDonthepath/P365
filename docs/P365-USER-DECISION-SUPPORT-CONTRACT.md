# P365 — User & Decision-Support Contract

**Version:** Product Rebaseline v1.0 — keputusan owner 11 Oktober 2026  
**Status:** Arah produk disetujui owner; menjadi otoritatif di repository setelah PR dokumentasi untuk issue #360 di-merge  
**Product identity:** Multi-Asset Financial Market Intelligence & Trader Decision Support System  
**Primary user:** Self-directed trader yang menganalisis pasar lintas timeframe (intraday, swing, position)  
**Product boundary:** Intelijen berbasis evidence; bukan sinyal, advis personal, prediksi pasti, atau eksekusi

## 1. Product promise

P365 membantu trader memahami **kondisi pasar saat ini**, **perubahan penting**, **konteks lintas aset dan makro**, **bukti yang mendukung/bertentangan**, **ketidakpastian**, serta **kondisi yang perlu dipantau** sebelum trader membuat keputusannya sendiri.

P365 adalah **market-first, multi-asset, multi-horizon**. P365 tidak memerlukan economic event atau material MOVE sebagai parent untuk menghasilkan pembacaan yang berguna. BTC dan Gold tetap menjadi implementation deep slices yang sudah tersedia, **bukan batas produk atau syarat yang menghalangi first-class market lain secara permanen**. Aktivasi tiap pasar tetap bertahap dan memerlukan qualification eksplisit.

Macro berperan sebagai **environmental context** (economic/policy/liquidity state dan contextual regime), bukan penjelas kausal otomatis bagi pergerakan satu instrumen. State/regime instrumen harus diturunkan dari data pasar pada horizon dan metodologi yang didefinisikan. Macro tidak boleh menggantikan informasi price structure, volatility, liquidity, flow dan positioning.

**Dokumen terkait:** [Market Universe v1.0](P365-MARKET-UNIVERSE-CONTRACT-v1.0.md), [Rebaseline Roadmap v1.0](P365-PRODUCT-REBASELINE-ROADMAP-v1.0.md). Ontologi serta invariant historis tetap berada pada dokumen canonical yang sudah ada. Audit/recovery #283 tetap mengatur fakta implementasi dan sequencing pekerjaan fondasi.

## 2. Model nilai untuk trader

Pembacaan dasar P365, termasuk saat pasar relatif tenang, harus menjawab:

1. **What is the market doing?** Market state pada horizon yang dipilih: arah/struktur, volatilitas, aktivitas, liquidity, breadth/participation bila relevan, serta perubahan terakhir.
2. **What is changing?** Perubahan fakta relatif terhadap predecessor dan baseline yang benar; materialitas tidak boleh ditentukan dari threshold tebakan.
3. **How broad or divergent is the move?** Keselarasan/kontradiksi antar instrumen yang benar-benar comparable, tanpa mengasumsikan korelasi atau transmisi sebagai sebab.
4. **What is the macro backdrop?** Economic/policy/liquidity state, risiko jadwal dan regime kontekstual, dengan frekuensi data dan tanggal publikasinya masing-masing.
5. **What supports and challenges this interpretation?** Market evidence, data coverage, conflict, serta confidence/uncertainty bila dapat dikalibrasi.
6. **What could change the assessment?** Kondisi observasi berikutnya, kandidat invalidation, dan data yang masih belum tersedia. Ini bukan instruction entry/exit.

Tidak semua pertanyaan harus menghasilkan jawaban numerik. **INSUFFICIENT / UNKNOWN / NOT_EVALUATED** yang disertai alasan lebih benar daripada klaim tanpa bukti.

## 3. Definisi operasional yang tidak boleh dicampur

| Istilah | Makna | Source/method boundary |
| --- | --- | --- |
| Market observation | Harga, yield, volume, flow, OI, funding, spread, dsb. sebagai fakta instrumen | Source-qualified + provenance/temporal |
| Market state | Kondisi deskriptif satu instrumen atau kelompok pada **horizon tertentu** (trend, range, volatilitas, partisipasi) | Derived; methodology, baseline & version diperlukan |
| Market regime | Pola perilaku lebih persisten, dengan kriteria onset, transition, exit dan evidence historis | Derived/model; butuh validasi point-in-time + kalibrasi |
| Macro backdrop/state | Keadaan growth, inflation, labor, policy, liquidity/funding, USD/rates secara kontekstual | Factual/derived dibedakan, cadence tetap eksplisit |
| Macro regime | Klasifikasi perubahan fase makro yang dapat dipertanggungjawabkan | Derived; tidak sama dengan kondisi pasar satu aset |
| Catalyst/event | Peristiwa terjadwal atau tak terjadwal yang relevan untuk monitoring | Temporal evidence; proximity bukan causality |
| Cross-market relation | Co-move, relative strength, divergence, lag atau korelasi pada interval qualified | Comparative fact/statistic; transmission/causality harus tetap NOT_EVALUATED kecuali ada metodologi dan validasi khusus |

Regime tidak boleh direkayasa dari satu indikator seperti DXY, VIX, yield atau funding. Juga tidak boleh menggunakan satu label global untuk menyembunyikan state berlawanan pada horizon berbeda.

## 4. Horizon contract

| Horizon decision | Tujuan | Contoh cadences/constraints |
| --- | --- | --- |
| Intraday | Session movement, perubahan kondisi likuiditas/volatilitas, anomaly | Menit/jam hanya jika data dan session/venue qualified |
| Swing | Struktur multi-hari/mingguan, persistence, volatility transition | Data harian dengan kalender perdagangan dan baseline |
| Position | Tren multi-minggu/bulanan, regime shift, kontekstual makro | History cukup panjang, policy/economic release vintage |

Ini **horizon analitis**, bukan janji ingest/freshness. P365 harus menampilkan horizon, sample/window, last effective observation, retrieved/available time, market session, quality dan completeness. Ketidakselarasan cadence harus dipisah sebagai context, bukan disulap menjadi pergerakan serempak.

## 5. Produk dan alur informasi

**Information hierarchy**:

1. **Financial Market Overview:** apa kondisi penting lintas market families dan apa yang berubah, dengan coverage dan as-of.
2. **Market workspace/detail:** state per instrumen dan timeframe, market structure, volatility/liquidity/positioning sesuai evidence qualified; disagreement lintas horizon.
3. **Cross-market & macro context:** rates, FX, equities, commodities, credit, crypto, policy, growth/inflation/liquidity sebagai konteks, bukan harus menjadi akar analysis.
4. **Briefing / investigation:** factual change → baseline → supporting/conflicting evidence → uncertainty → watch/invalidation. Material MOVE dan event-trigger hanyalah shortcut opsional.
5. **Evidence drilldown:** nilai, unit, identitas instrumen, venue, source, cutoff, revision/vintage, methodology, completeness dan sumber error.

UI berbahasa Indonesia, membedakan yang terukur, derived, model, serta yang unavailable. Semua pernyataan state/regime perlu referensi evidence dan identitas algoritme.

## 6. Universe activation vs product scope

Produk dirancang untuk semua major financial market families yang didaftarkan dalam **Market Universe Contract v1.0**. Namun setiap market/instrumen hanya boleh dipromosikan dari target/watch menjadi **first-class qualified** melalui data identity, provenance, temporal/session, history, baseline, test, entitlement/cost, dan user-value gates. Keberadaan label keluarga pasar di UI tidak membuktikan readiness provider.

**Multi-asset adalah produk, bukan instruksi menghidupkan seluruh provider sekaligus.** Rilis awal tetap memanfaatkan BTC/Gold dan existing qualified cross-market facts, dengan target factual usefulness lintas kelompok sebelum state/regime reasoning diperluas. Provider baru, scheduler, database, credential, deletion, dan paid entitlement memerlukan checkpoint owner terpisah.

## 7. Non-negotiable evidence contracts

- Canonical Market Memory append-only, provenance, identity, revision/supersession, dan compatibility dipertahankan.
- Bedakan observed/effective time, published/released time, retrieved/available time dan persisted/captured time. Replay hanya boleh memakai data yang diketahui pada as-of.
- Price, yield, spread, index point, return, percentage point, dan basis point tidak boleh disamakan. Gold futures GC=F tidak sama dengan XAU/USD spot.
- Session/venue/calendar, corporate actions/contract rollover bila relevan, time-zone, data gaps dan provider delay harus terlihat; no false common timestamp.
- Source facts, deterministic derived metrics, model estimates, state/regime serta inference dipisahkan.
- Misaligned, stale, missing, partial, immature, rate-limited, unauthorized, atau unavailable harus ditandai dengan alasan; dilarang mengisi 0 atau proxy diam-diam.
- Statistik hubungan tidak otomatis membuktikan mekanisme kausal, prediksi, atau advice.
- Model dan threshold baru harus punya methodology/version, input lineage, distribution/calibration, confidence limitations, replay/out-of-sample checks serta tests sebelum production adoption.

## 8. Explicit exclusions

Tidak menghasilkan instruksi BUY/SELL/LONG/SHORT, entry/SL/TP preskriptif, rekomendasi sizing/leverage, portfolio auto-allocation, trading bot, order routing atau klaim prediksi pasti. Evaluasi *setup conditions* dan *invalidation* boleh sebagai **deskripsi bersyarat**, tidak sebagai trade signal tanpa checkpoint produk baru yang eksplisit.

Tidak boleh menduplikasi data layers, menyulap event-centred pipeline sebagai satu-satunya reasoning path, memaksakan satu timeframe, atau menjanjikan market regime sebelum empirical qualification.

## 9. User-value acceptance

Suatu slice dianggap berguna bila trader dapat, untuk satu instrumen/horizon nyata:

- mengetahui state faktual market dan basis waktu/venue-nya;
- membedakan perubahan terhadap baseline compatible, bukan hanya latest quote;
- mengetahui evidence mana yang mendukung dan mana yang menolak pembacaan;
- melihat macro backdrop yang relevan tanpa klaim sebab otomatis;
- mengetahui ketidakpastian dan apa yang perlu diawasi berikutnya;
- menelusuri setiap kesimpulan sampai data, waktu dan metodologinya.

**MVP arah baru:** bukan memenuhi setiap instrumen global sekaligus, tetapi **membuktikan alur market-first lintas minimal beberapa keluarga pasar** dengan data yang qualified, sambil memperdalam BTC/Gold sebagai starting implementations. Kriteria detail, keluasan cakupan dan exit gates berada pada roadmap; tidak boleh menganggap panel dengan placeholder sebagai bukti keberhasilan.

## 10. Change control

Keputusan produk ini **tidak mengaktifkan** deferred State/Risk/Intelligence/Regime code. Semua delivery mengikuti AGENTS.md, recovery gates #283, 1 bounded issue = 1 focused PR, owner merger, produksi diverifikasi setelah merge.

Dokumen lama BTC/Gold evidence map tetap normative **untuk slice yang sudah ada**, bukan batas permanen future product. Ringkasan dan milestone lama di F0 adalah historical implementation records; jika tidak lagi selaras dengan kontrak produk ini, lakukan koreksi terkendali, jangan ubah evidence historis diam-diam.
