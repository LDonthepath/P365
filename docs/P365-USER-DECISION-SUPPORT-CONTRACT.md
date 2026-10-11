# P365 — User & Decision-Support Contract

**Version:** Product Rebaseline v1.3 — research-grounded quantitative macro methods, owner direction 11 Oktober 2026  
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

## 5.1 Macro Intelligence Report — output/reference contract (owner example, 11 Oktober 2026)

The owner-provided **“Analisa Makro Global — Oktober 2026”** is a **reference for report structure, analytical depth and Indonesian presentation**, **NOT** a verified factual source, numerical fixture, calibrated model, or provider specification. Values, dates, ratings, scenario percentages and thresholds in that sample **must never be copied into live outputs unless independently sourced and qualified**.

P365 should aim for a coherent **full analytical report**, not merely cards, news summaries or disconnected tables. Output may be concise if evidence coverage is poor; no section may be padded with invented conclusions to fill a template.

| Section | Required information | Fallback / safety |
| --- | --- | --- |
| **Report header / as-of** | Coverage geography, output time/timezone, knowledge cutoff, latest effective dates and covered observation/release intervals | Show missing/partial coverage and report status |
| **Ringkasan Eksekutif** | Original, concise synthesis of *what materially changed*, macro tension and why a trader should monitor it | “Tidak ada perubahan makro signifikan yang dapat dikualifikasi” if justified; no general-purpose evergreen summary disguised as new |
| **Macro Regime Classification** | Separate **inflation trend**, growth/labor conditions, monetary policy stance, rates/financial/funding conditions where evidence permits; identify mixed/transition/unknown | No single overall regime inferred from one series; label *market-wide risk-on/off* NOT_EVALUATED if cross-market method unqualified |
| **Evidence Table** | Indicator, measured value, explicit unit, reference date, vintage, source and evidence ID, predecessor/consensus/historical baseline, compatible change, interpretation and confidence/quality reason | Omit unsupported deltas and “weights” or mark missing; never infer strength from level alone |
| **Konflik & Ketidakpastian** | Confirming, contradicting and missing dimensions; limitations and alternative hypotheses | Negative and missing evidence must be distinguishable |
| **Skenario Makro** | Conditional base/alternative economic paths, assumptions, catalysts, confirmations and invalidation with time horizon | Probabilitas, forecast, dan ambang numerik **diizinkan** bila dihitung atau diambil dari metode ilmiah/otoritas tepercaya yang benar-benar memenuhi eligibility, waktu, cakupan, parameter dan evaluasi; jika tidak, gunakan skenario kualitatif |
| **Katalis 7–30 Hari** | Known official dates and qualified potential new releases/decisions; separate unscheduled *candidate drivers* from scheduled events | No fabricated calendar, meeting, official speech, outcome or certainty; only dated when time proven |
| **Risk Flags & Invalidation** | Evidence-grounded macro/funding/fiscal/geopolitical risks and what observation would weaken the thesis | Hypotheses named conditional; numerical thresholds and ranges may follow published indicator definitions or validated estimation, with scope and sensitivity disclosed |
| **Data Quality Log** | Missing series/comparisons, staleness, source reliability, vintage/release lag, eligible as-of, classification fitness | Transparent UNKNOWN/INSUFFICIENT; numeric confidence and model intervals are allowed with model/estimation source, calibration and evaluation |

**Regime boundary:** The first MVP may narrate *macro environment classifications* (e.g. disinflation, growth cooling, tight policy) **only after qualified rate-of-change, baseline and methodology checks**. A **cross-asset risk-on/off** market classification remains deferred. Financial conditions should not be labeled loose/tight from a lone VIX or credit series without an approved composite/benchmark.

### Claim-level proof rules prompted by the example

1. **Price/index level is not an inflation growth rate:** CPI/PCE level alone does not establish YoY disinflation; derive YoY/MoM only from qualified same-series compatible history, with revisions, seasonality and units. Five-year inflation breakeven measures market compensation, not realized CPI/PCE or the Fed target itself.
2. **Employment stock is not payroll change:** PAYEMS employment level cannot prove NFP monthly gain without an eligible predecessor and seasonal-vintage compatibility. Any stated “positive NFP” must refer to qualified monthly difference/release.
3. **Yield level is not term premium causality:** Elevated 10Y/30Y yield alone does not prove fiscal/term-premium attribution. Curve inversion/re-steepening is not by itself proof of recession timing or soft landing.
4. **A single risk gauge is not risk-on:** Low VIX, narrow one credit spread and DXY level do not independently qualify a universal risk-on label. Cross-market interpretation is a later model/data-gated capability.
5. **Levels and comparison windows must match:** A quoted 52-week extreme is not proof of current trend without qualified series identity/calendar, matching timestamps and methodology. Distinguish rates in bps, percentages, index points, source-native prices and inflation expectations.
6. **Forecasts and thresholds are conditional:** The **specific values in the sample** are illustrative, not validated P365 estimates. But P365 **may calculate its own probabilities, weights, risk thresholds, forecasts and scenarios** from fit-for-purpose published or peer-reviewed methodology using eligible input vintages. Disclose model target/horizon, assumptions, version, empirical performance, uncertainty and source. If not qualified, provide qualitative alternatives rather than invented precision.
7. **Weights and confidence need method:** Weights, “Tinggi/Sedang” and numeric confidence may come from documented qualitative rubrics or calculated/published research models. Show whether the estimate is source-published, a faithful replication or an independently validated P365 adaptation.
8. **Timing and input accountability:** Qualify official release dates, scheduled events and availability cutoff for each factual statement. A source call's absence does not mean underlying economic series is unavailable; distinguish **not fetched / not qualified / actually unavailable**.
9. **Narrative is not a cosmetic summary:** A paragraph should explain *how multiple qualified facts interact as a conditional economic mechanism*, surface alternative explanations, and cite exact evidence references. No LLM-created facts beyond the vetted evidence bundle; assertions must survive automatic claim/evidence consistency checks.

### MVP evaluation fixtures derived from the example

- **Full-evidence:** qualified inflation/labor/policy/funding observations yield an executive synthesis, evidence table, candidate catalyst, supported & contradicted interpretation, conditional scenarios and watchlist.
- **Mixed:** cooling labor with tight funding or policy evidence generates **mixed/uncertain** conclusions rather than inventing a neat soft-landing narrative.
- **Partial:** no compatible CPI/PCE YoY, no NFP monthly predecessor, or no verified official calendar → state precise coverage gaps, suppress unsupported trend and dates while still discussing eligible remaining facts.
- **No-change:** no new meaningful macro development → produce a coherent status update and explicitly state **no new qualified catalyst**, not a fabricated event.
- **Historical replay:** output must only cite measurements and revisions available by the requested as-of; identical evidence bundle, model/methodology version and settings must yield testably consistent factual claims.
- **Asset independence:** complete the report without any BTC/Gold prices or MOVE trigger.

**Presentation:** The first MVP target is a usable, polished Indonesian narrative report with evidence drilldown, not a fixed count of rows or a fixed global risk verdict. Existing briefing and canonical evidence models must be reused where eligible; UI/model changes require separate approved issues.

## 5.2 Research-grounded macro methodology — quantitative analysis ALLOWED

**Owner clarification:** the report's probabilities, evidence weights, risk thresholds, macro regime classifications, model forecasts, nowcasts and scenario distributions are legitimate **target product outputs**, not prohibited formats. They may be calculated from **credible first-party methodology, official central-bank research, academic papers or peer-reviewed models**, provided the specific method, data, implementation and application can be defended. The **example's** numbers are not automatically valid.

### Model provenance levels (must remain distinct)

| Level | Output and conditions |
| --- | --- |
| **Official observation** | Factual released macro series; preserve source identity, vintage, release/knowledge time, units and adjustments |
| **Source-published statistical estimate** | Display source model's rate/probability/indicator, clearly attributed; check original target, horizon, calculation as-of, licensing, known accuracy and revisions |
| **Published model replicated by P365** | Compute equations/parameters from a research publication; validate reproduction on reference fixtures and eligible live/history input data |
| **Adapted or estimated P365 model** | Disclose modified assumptions and model/parameter version; perform time-separated/out-of-sample backtesting, probability calibration, sensitivity and bias checks |
| **Qualitative macro scenario** | Explain assumptions, conditions, conflicts and uncertainty without presenting an arbitrary percentage as model output |

**Source reputation alone does not validate the P365 implementation** or authorize transplanting a probability from one event/horizon to a different one. A trustworthy paper establishes a candidate methodology; exact applicable data, timing, reproduced calculations and evaluation remain necessary.

### Research examples for method selection (candidates, not runtime/provider approval)

| Analytical question | Credible source or paper | Target/limitation |
| --- | --- | --- |
| How are economic expansions/recessions assessed? | [NBER Business Cycle Dating](https://www.nber.org/research/business-cycle-dating/business-cycle-dating-procedure-frequently-asked-questions) | Depth, breadth and duration; **retrospective** dating, not a mechanical real-time probability |
| Is labor weakness reaching a published warning threshold? | [Sahm Rule real-time indicator, FRED](https://fred.stlouisfed.org/series/SAHMREALTIME) | 3-month unemployment average rise of **0.50 percentage points** versus prior 12-month minimum. This is a published rule, not a guessed trigger |
| What is a model-based 12-month recession probability? | [NY Fed Yield Curve Indicator](https://www.newyorkfed.org/research/capital_markets/ycfaq) | Term-spread model based on **10Y minus 3M** Treasury slope; its model probability is not an interchangeable probability for soft landing or Fed cuts |
| How can financial conditions be quantified? | [Chicago Fed NFCI methodology](https://www.chicagofed.org/research/data/nfci/background) | Broad standardized multi-indicator composite; don't infer its reading from one VIX or credit series |
| How can inflation be nowcast before release? | [Cleveland Fed Inflation Nowcasting](https://www.clevelandfed.org/our-research/indicators-and-data/inflation-nowcasting) | Defined pre-release CPI/PCE model output, distinct from official CPI/PCE data |
| How can macro releases alter a contemporaneous GDP estimate? | [NY Fed Staff Nowcast](https://www.newyorkfed.org/research/policy/nowcast/) | Dynamic factor/Bayesian/Kalman framework; new macro releases update model estimates rather than creating imaginary events |
| How can probabilities be objectively tested? | [Gneiting & Raftery (2007), JASA](https://doi.org/10.1198/016214506000001437); [Gneiting et al. (2007), JRSS B](https://doi.org/10.1111/j.1467-9868.2007.00587.x) | Proper scoring, calibration and sharpness diagnostics; **evaluation methodology**, not supplied macro scenario odds |

References above are **candidate methods**, not proof that all required time series/providers already exist in P365 or that source terms/licensing permit every use.

### Calculation and acceptance requirements

1. Each model-derived statement has a reproducible chain: **source/paper + cited method/formula → exact target/units/horizon → input evidence IDs and vintage/as-of → parameter/version → estimate → uncertainty/evaluation**.
2. Choose methods per question; NBER recession dating, Sahm labor warnings, NY Fed recession probability and NFCI financial conditions have **different target variables** and must not be treated as interchangeable labels.
3. **Probabilities are allowed:** either quote a qualified published estimate with publisher attribution, or estimate/calibrate a P365 model with appropriate historical sample, rolling-origin/out-of-sample testing and reliability metrics (e.g., proper scoring). Do not falsely claim independent validation of a publisher's model.
4. **Weights are allowed:** learned statistical/factor loadings or justified published composites may quantify contributions. Document feature signs, missing data handling, multicollinearity, stability and context.
5. **Numeric thresholds are allowed:** official indicator thresholds, defensible published research or transparently estimated history-based levels; record units, lookback, sensitivities and target. Avoid arbitrary values presented as scientific results.
6. **Scenario probabilities are allowed:** specify mutually exclusive/exhaustive events if percentages sum to 100; otherwise label overlapping/conditional probability events. A model that forecasts a recession does not automatically assign four-scenario “soft landing/hard landing/stagflation/reacceleration” odds.
7. Reports must separate observed fact, derived calculation, published estimate, P365 model, causal hypothesis and narrative inference. **Model-based doesn't mean causal proof**; retain uncertainty and cross-model disagreement.
8. If published data is accessible but a faithful model replication is not, show the original source estimate with attribution rather than manufacturing a P365 number. If neither is available, mark NOT_EVALUATED and explain missing inputs.

**Design decision:** the macro narrator should consume an evidence/model-results bundle and reason over those outputs; it should **not invent calculations through fluent prose**. Implementation of new models still requires small owner-approved issues/PRs; this contract authorizes the target behavior, not direct runtime activation.

## 6. Roadmap/activation boundary

Riset metodologi, source qualification, engine dan surface UI dibagi menjadi **single-purpose issues dan PR** sesuai [#360](https://github.com/LDonthepath/P365/issues/360). Keputusan product contract **tidak mengaktifkan** deferred `State`, `Risk`, `Regime`, `Intelligence` atau trading features; per-checkpoint owner approval tetap berlaku setelah factual/read model/temporal gates lulus. Pilot pertama adalah **macro narrative synthesis**, bukan generalized asset regime.

**Future after macro MVP:** macro liquidity trajectory, calibrated macro state; kemudian market-specific flow, risk-on/off cross-asset research, BTC/Gold/FX/equity integration menurut user value. Market universe target dalam ontology adalah aspirasi produk jangka panjang, **bukan target wajib sprint MVP**.

**Governance:** jangan membuat docs baru bila existing documents/issue roadmap menampung kebutuhan. #283 tetap release safety gate; #350 dan #353 tetap owner-paused. Jangan self-merge.
