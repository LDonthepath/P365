# P365 — User & Decision-Support Contract

**Version:** Product Rebaseline v1.1 — owner direction 11 Oktober 2026  
**Status:** Approved **product intent**; canonical in repo only after PR #361 is owner-merged  
**Long-term product:** Multi-Asset Financial Market Intelligence & Trader Decision Support (intraday, swing, position)  
**Immediate MVP:** **Evidence-Based Macro Catalyst & Narrative Intelligence** — dapat menghasilkan analisis makro secara mandiri **tanpa harus memilih/menjelaskan satu aset**  
**Boundary:** Bukan trading signal, prediction, autonomous execution, atau klaim penyebab tanpa bukti.

## 1. Prioritas produk dan batas MVP

P365 pada **MVP pertama** harus dapat memproses data makro terverifikasi menjadi **narasi analitis yang baru, tertelusur, dan relevan bagi trader**. Tujuan MVP bukan menambah jumlah indikator di dashboard, mencari headline, membuat daftar economic calendar, mendeteksi pergerakan BTC/Gold, atau lebih dulu mengklasifikasi harga aset.

Urutan produk yang disetujui:

1. **Makro mandiri (MVP sekarang):** identifikasi perubahan makro dan relevansi relatif terhadap history, consensus/expectation yang sah bila tersedia, dan kondisi sebelumnya; hasilkan *candidate catalyst*, konteks/interpretasi bersyarat, counter-evidence, ketidakpastian, dan *what to watch*.
2. **Macro liquidity / policy / financial-conditions context:** tampilkan arah perubahan pada **variabel makro yang terukur**, misalnya reserves, funding spreads, central bank balance sheet, TGA/RRP dan policy expectations. **Jangan** mengklaim bahwa data agregat tersebut membuktikan aliran modal ke instrumen tertentu.
3. **Lintas aset nanti, melalui issue tersendiri:** aplikasikan analisis makro yang sudah qualified ke instrumen/market, kemudian uji risk-on/risk-off lintas market, price response/flow dan market regime jika data dan kalibrasi memenuhi syarat.

Visi multi-asset tetap berlaku, tetapi **bukan MVP exit gate pertama**. Crypto/Gold yang sudah dikembangkan tidak dibuang; pekerjaan terkait aset tidak menjadi dependensi wajib untuk membuktikan kemampuan membuat narasi makro.

**Otoritas:** [Financial Market Ontology](P365-FINANCIAL-MARKET-ONTOLOGY-v0.1.md) untuk klasifikasi dan future market universe; [issue #360](https://github.com/LDonthepath/P365/issues/360) untuk phase roadmap dan acceptance; [recovery #283](https://github.com/LDonthepath/P365/issues/283) untuk engineering/reliability gates. Hindari dokumen parallel.

## 2. Empat kemampuan wajib dalam MVP makro pertama

| Kemampuan | Pertanyaan utama | Outcome minimum |
| --- | --- | --- |
| **Macro Change Detection** | Apa yang berubah dan seberapa tidak biasa? | Temukan perubahan aktual pada indikator growth, inflation, labor, policy, yields, funding/liquidity yang benar-benar eligible; nilai versus predecessor, history, consensus/forecast atau rilis sebelumnya **hanya jika tersedia dan sebanding** |
| **Macro Catalyst Qualification** | Perubahan mana yang layak dianggap pemicu/perkembangan makro penting? | Buat daftar **candidate macro catalysts** dari perubahan yang lolos aturan signifikansi & kelayakan, dengan waktu rilis, asal data, novelty, disagreement dan status CONFIRMED_FACT / HYPOTHESIS / INSUFFICIENT. P365 **tidak membuat event/headline palsu** |
| **Evidence-Based Macro Narrative** | Apa makna rangkaian perubahan tersebut? | Sintesis lintas tema makro menjadi narasi orisinal yang menyebut *what changed*, dibanding basis apa, konsekuensi/interpretasi **bersyarat**, bukti yang mendukung, yang bertentangan, dan informasi yang belum ada; bukan headline rephrasing atau daftar metrik |
| **Macro Context & Monitoring** | State/kondisi makro sekarang dan apa yang bisa mengubahnya? | Pembacaan kontekstual growth/inflation/policy/liquidity/financial conditions serta data/rilis/ambang observasi yang patut dipantau berikutnya; status UNKNOWN/NOT_EVALUATED eksplisit bila bukti kurang |

**MVP tidak boleh dianggap selesai jika hanya menghasilkan teks generik yang tampak masuk akal.** Setiap klaim numerik/naratif harus bisa menunjuk ke evidence ID, sumber, observed/released/retrieved timestamps, vintage/revision, unit, comparison basis, reasoning/method version, dan peran data (fact/expectation/pricing/proxy/interpretation).

### 2.1 Arti “membuat katalis sendiri”

P365 boleh **menemukan kandidat katalis dari perubahan data**, contohnya revisi historis besar, rilis di luar ekspektasi, perubahan stance yang didukung beberapa ukuran, atau divergensi inflasi versus tenaga kerja. Kandidat demikian berbeda dari:
- **Event faktual:** data release, keputusan, pernyataan resmi atau kejadian yang benar-benar tercatat.
- **Hypothesis:** cerita/implikasi ekonomi yang mungkin konsisten dengan sejumlah bukti, **belum** diuji sebagai sebab market move.
- **Market impact/causal attribution:** membutuhkan evidence harga dan metode pengujian tersendiri **di luar MVP makro pertama**.

Output aman: “Perubahan X dan Y konsisten dengan kemungkinan meningkatnya tekanan Z, tetapi A dan B belum mengonfirmasi; pantau C.” Output tidak aman: “X menyebabkan BTC turun” atau “Fed pasti akan memangkas suku bunga”, apabila bukti tidak mendukung.

### 2.2 Source selection dan tematik

Mulai dari **existing qualified durable facts**, bukan menghidupkan sumber baru otomatis:
- **Growth/activity:** GDP, PMI/ISM, retail sales/industrial production ketika valid.
- **Inflation:** CPI, PCE, PPI, inflation expectations apabila sumber dan basis sah.
- **Labor:** NFP, unemployment, wages, claims/JOLTS dengan konsensus & revision saat ada.
- **Policy & rates:** FOMC, SEP/dots, policy rates, nominal/real yields, curve; official expectations ≠ market-implied pricing.
- **Macro liquidity/funding:** Fed balance sheet/reserves, TGA/RRP, money/credit, SOFR/EFFR/IORB spread; bedakan **stock/level, flow/change, cost and proxy**.

US/China/Japan adalah **kandidat geographical context**, bukan klaim bahwa seluruh seri tersedia. Jangan mengarang harian/intraday jika sumber weekly/monthly. Economic news boleh mendukung fakta apabila source-qualified, bukan syarat membuat narasi.

## 3. Minimal reasoning path (MVP)

```text
Qualified Macro Observations / Events / Expectations / Pricing
  ↓ point-in-time + source/revision/quality validation
Compare against correct predecessor / historical distribution / consensus
  ↓
Detect qualified macro changes & contradictions
  ↓
Assess candidate catalysts (not invented events or causes)
  ↓
Synthesize a new evidence-linked macro narrative
  ↓
State context + uncertainty + what to watch
  ↓
Indonesian Macro Briefing (read-only)
```

**Tidak diperlukan:** BTC/Gold MOVE, ETF flow, market prices, cross-asset time alignment, risk-on/off price-regime, trading entry/exit atau asset attribution sebagai input wajib MVP pertama.

*Attribution* tetap NOT_EVALUATED jika tidak ada cara valid menguji hubungan sebab akibat. Engine boleh menghasilkan “TIDAK CUKUP BUKTI” dengan penyebab, tanpa memaksakan narasi.

## 4. Temporal, explanation, and risk guardrails

1. Pertahankan canonical append-only Market Memory, Observation/Event/Evidence identity, provider provenance, revision/supersession dan F0/recovery invariants.
2. Bedakan observedAt, released/publishedAt, retrievedAt/knowledge availability, capturedAt; replay tidak boleh melihat data masa depan atau revisi yang belum diketahui.
3. Perbandingan hanya pada unit, calendar, horizon, basis dan vintage sebanding. Semua klasifikasi *unusual/material* perlu distribusi historis dan kebijakan threshold yang dikalibrasi; **jangan menebak ambang**.
4. Jangan mengubah policy projection SEP menjadi market pricing; jangan mengubah stock/funding proxy menjadi capital flow terukur.
5. **Fact → derived comparison → hypothesis/interpretation** ditandai jelas. Confidence hanya jika punya metodologi teruji; tidak boleh memakai confidence numerik dekoratif.
6. Narasi harus melewati checks untuk contradiction, stale, unavailable, partial, missing, unknown, duplicate, not-yet-released, source immaturity dan unit/sign ambiguity. Teks UI bahasa Indonesia.
7. Tidak ada panggilan LLM yang diberi kebebasan menambah fakta. Jika AI natural-language dipakai kemudian, inputnya evidence bundle tersaring dan outputnya harus divalidasi, terikat evidence dan dapat diuji deterministik pada level klaim.

## 5. MVP acceptance — visible usefulness, not number of indicators

MVP dianggap selesai setelah satu alur nyata di produksi memungkinkan pengguna membaca sebuah **Macro Briefing** yang:

- [ ] Menghasilkan **narasi baru dari data terverifikasi**, bukan headline tiruan atau template generik/daftar angka.
- [ ] Menjelaskan minimal satu perubahan makro yang qualified: *before vs after, magnitude, baseline, observed/released/retrieved timestamp, source*.
- [ ] Menyebut **candidate catalyst** yang layak, **atau** secara eksplisit tidak menetapkan katalis bila data tidak cukup.
- [ ] Menunjukkan minimal satu *confirming* dan satu *contradicting/missing* dimension **bila ada**, tanpa membuat data sintetis.
- [ ] Memberi interpretasi makro **bersyarat**, derajat ketidakpastian/gap, dan pengamatan/publikasi selanjutnya yang relevan.
- [ ] Menghasilkan **UNKNOWN/INSUFFICIENT** yang benar saat provider gagal, data terlalu lama, basis salah atau tidak ada perubahan material.
- [ ] Menjalankan historical point-in-time replay yang konsisten tanpa look-ahead dan lulus targeted+regression tests.
- [ ] Berguna meski tidak ada data harga aset, event live, berita baru atau pergerakan MOVE.
- [ ] Terhubung ke UI Indonesia yang dapat dibaca; diuji dengan fixture positif/negatif serta data produksi yang benar-benar qualified.

**Acceptance scenario minimum:** (A) macro surprise yang mendukung satu hipotesis; (B) mixed macro signals yang menghasilkan narasi balanced; (C) no fresh material change/insufficient data dengan penjelasan jujur. Domain tersedianya bukti harus ditentukan melalui read-only inventory; tidak mengasumsikan coverage 4 market families.

## 6. Roadmap/activation boundary

Riset metodologi, source qualification, engine dan surface UI dibagi menjadi **single-purpose issues dan PR** sesuai [#360](https://github.com/LDonthepath/P365/issues/360). Keputusan product contract **tidak mengaktifkan** deferred `State`, `Risk`, `Regime`, `Intelligence` atau trading features; per-checkpoint owner approval tetap berlaku setelah factual/read model/temporal gates lulus. Pilot pertama adalah **macro narrative synthesis**, bukan generalized asset regime.

**Future after macro MVP:** macro liquidity trajectory, calibrated macro state; kemudian market-specific flow, risk-on/off cross-asset research, BTC/Gold/FX/equity integration menurut user value. Market universe target dalam ontology adalah aspirasi produk jangka panjang, **bukan target wajib sprint MVP**.

**Governance:** jangan membuat docs baru bila existing documents/issue roadmap menampung kebutuhan. #283 tetap release safety gate; #350 dan #353 tetap owner-paused. Jangan self-merge.
