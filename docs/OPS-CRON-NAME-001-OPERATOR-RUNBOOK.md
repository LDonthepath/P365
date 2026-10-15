# OPS-CRON-NAME-001 — Alias operator untuk job `p365-fred`

**Keterkinian:** angka job, nama, fingerprint dan status review dalam runbook adalah **hasil audit 11 Oktober 2026**, bukan jaminan keadaan produksi saat ini. Periksa `cron.job` read-only dan registry kode sebelum menjalankan prosedur; perubahan dokumentasi ini tidak mengubah scheduler.

**Issue:** [#332](https://github.com/LDonthepath/P365/issues/332)  
**Jenis keputusan:** **OPERATOR ALIAS** — nama `cron.job.jobname` produksi sengaja **tidak diubah**.  
**Baseline:** `main@ee1280368dc05b890f3a651d65378781fa267f02` (11 Oktober 2026, sekitar 08.41 WIB).  
**Status:** **PR REVIEW / owner merge diperlukan**, kemudian bukti read-only pascamerge.  
**SQL inventaris yang dapat diulang:** [`scripts/ops/ops_cron_name_001_operator_inventory.sql`](../scripts/ops/ops_cron_name_001_operator_inventory.sql).  
**Audit terkait:** [#228](https://github.com/LDonthepath/P365/issues/228) (scheduler); [#283](https://github.com/LDonthepath/P365/issues/283) (Recovery Roadmap).

## 1. Temuan terverifikasi langsung di Supabase produksi

SQL read-only pada 11 Oktober 2026, sekitar 01.40 UTC (08.40 WIB), `project_id=orwhuzexnuochctccqvl`, membaca `cron.job` dan `cron.job_run_details` (tanpa membuka `cron.command`):

| ID | Nama job di database (legacy) | **Alias operator: fungsi sesungguhnya** | Cron UTC | Eksekusi/succeeded/failed 24h |
|---|---|---|---|---|
| **4** | `p365-fred` | **CoinGecko Context — data konteks kripto per jam** | `31 * * * *` | **24 / 24 / 0** |
| **24** | `p365-fred-release-aware` | **FRED Provider Updates — pemeriksaan pembaruan setiap 5 menit** | `*/5 * * * *` | **288 / 288 / 0** |

Keduanya `active=true`. Fingerprint `md5(command)` saat pemeriksaan, **diagnostik saja**, bukan rahasia atau kontrak hash permanen:

- Job **4**: `782d0148c1e7cd41d59e484bfb53ffeb`.
- Job **24**: `7a0bee49972f37d113637024b1c45750`.

Identitas endpoint terverifikasi menggunakan pencocokan selector internal **tanpa mencetak URL lengkap/credential**:

| Pemeriksaan | Job 4 | Job 24 |
|---|---|---|
| Selector `providers=coingecko-context` | Benar | Tidak |
| Selector `providers=fred&fredProviderUpdates=1` | Tidak | Benar |
| FRED lama `fredReleaseAware=1` | Tidak | Tidak |
| Transport `net.http_get`, Vault, host produksi `p365-kappa.vercel.app` | Benar | Benar |
| Provider FRED + CoinGecko digabung dalam satu job | Tidak | Tidak |
| Jumlah job aktif yang memakai selector tersebut | 1 CoinGecko Context | 1 FRED |

**Penting:** `cron.job_run_details.status='succeeded'` hanya membuktikan perintah SQL cron berhasil melakukan *dispatch/queue*, bukan HTTP 200, keberhasilan respons aplikasi, data provider baru, atau insert fisik Market Memory. Bila terjadi insiden, lakukan pemeriksaan berlapis pada respons `pg_net`, laporan provider, dan Observation/Evidence durable melalui runbook operasional terkait, tanpa mengasumsikan `succeeded` = ingestion sehat.

## 2. Mengapa tidak mengganti nama job produksi pada issue ini?

Nama `p365-fred` menyesatkan, tetapi **ada dependensi nyata**: tiga skrip operasional masih mengharuskan **`jobid=4 AND jobname='p365-fred'`**, dan satu skrip split lama masih mengambil `jobname='p365-fred'`:

- `scripts/ops/frs003_enable_fred_provider_updates.sql`
- `scripts/ops/frs003_restore_hourly_release_aware_fred.sql`
- `scripts/ops/frs003_activate.sql` dan `scripts/ops/frs003_rollback.sql`

Rename lewat pembuatan ulang job berpotensi mengganti **job ID**, memisahkan histori `cron.job_run_details`, dan memerlukan operasi `unschedule/schedule` yang salah urut bisa membuat **duplikasi atau hilangnya tick**. `cron.alter_job` yang tersedia tidak menerima parameter `jobname` (dibuktikan lewat `pg_proc` produksi); jangan mengarang mekanisme rename yang dianggap aman. Pengubahan langsung `cron.job` juga bukan bagian dari kontrak produksi yang disetujui.

**Keputusan:** gunakan alias operator yang diperoleh dari **selector command nyata** lewat SELECT aman. Ini menyelesaikan salah identifikasi oleh manusia tanpa mengubah cron. Rename fisik (jika masih diperlukan) harus menjadi *issue berbeda*, termasuk migrasi semua referensi skrip, bukti transaksi/identitas, backup manifest command secara aman, uji restore, dan **persetujuan owner terpisah sebelum SQL mutatif**.

## 3. Cara operator membaca status

Jalankan **persis** `scripts/ops/ops_cron_name_001_operator_inventory.sql` di SQL editor Supabase dengan akses operator tepercaya.

Output menampilkan `jobid`, `actual_jobname`, `operator_label`, `mapping_status`, `schedule_utc`, `active`, hitungan dispatch 24 jam, `latest_dispatch_utc`, status terakhir, dan *fingerprint* command. **Tidak mengembalikan command lengkap, Vault token, header autentikasi, atau respons HTTP.**

Jika `mapping_status='TERVERIFIKASI'`, **gunakan kolom `operator_label`**, bukan nama lama, dalam inspeksi, laporan insiden, dan komunikasi:

- **Job 4 / CoinGecko Context (hourly):** masalahnya dapat memengaruhi `btc.market_cap.usd`, `eth.market_cap.usd`, total market cap, volume 24 jam, dan dominansi BTC/ETH. Ini bukan seri harga spot BTC/ETH 5-menit; *jangan* menyebutnya kegagalan FRED.
- **Job 24 / FRED Provider Updates (5 menit):** tugasnya memantau pembaruan seri FRED yang terdaftar, bukan menjamin setiap seri terdaftar berubah setiap 5 menit (registry kode memuat **37 seri** pada `main@0ee4d3cd`, 14 Oktober 2026). Pemeriksaan perubahan provider tidak sama dengan waktu rilis statistik ekonomi.

Jika `mapping_status` berawalan `DRIFT_`, `JOB_TIDAK_DITEMUKAN`, atau `JOB_NONAKTIF`, query sengaja mengganti label dengan **`ALIAS DITAHAN — PERIKSA DRIFT`**. **Jangan terus memakai mapping lama seolah valid.** Periksa perubahan jadwal, selector, duplikasi aktif, atau job hilang melalui jalur read-only; jangan jalankan skrip legacy untuk "memulihkan" job tanpa owner review.

Jika `cron_failed_24h>0` atau dispatch lebih sedikit dari yang diharapkan, tinjau `cron.job_run_details` dan status cron/time window. Angka 24/288 adalah **pengukuran tertanggal**, bukan SLA semua hari (scheduled ticks bisa bergeser dalam insiden).

## 4. Kontrak keselamatan operasional

- **Tidak boleh ada perubahan schedule, job ID, target endpoint, mode ingest, bearer/Vault, rate, provider, Supabase role, canonical data, atau cron runner** dalam checkpoint alias ini.
- Dashboard aplikasi P365 tidak diubah. Kolom `cron.job.jobname` dan log historis masih berisi nama legacy; alias hanya muncul pada **query operator dan runbook**. Jangan menyatakan bahwa dashboard/monitoring eksternal otomatis berubah.
- Nama `p365-fred-release-aware` juga **legacy**: selector runtime sekarang memakai `fredProviderUpdates=1`. Operator wajib melihat alias **FRED Provider Updates**, bukan mengasumsikan algoritma release-aware lama.
- Skrip FRS-003 yang tersimpan adalah artefak operasional historis; beberapa preflight atau rollback lama memiliki **asumsi jadwal/selector yang tidak sesuai keadaan kini**. Jangan eksekusi ulang script lama tanpa evaluasi ulang terhadap job aktual.
- Histori Market Memory dan provider chronology tetap append-only; tidak ada backfill, dedup tambahan, atau penghapusan pada checkpoint ini.
- Dokumen [P365-CRON-CADENCE-AND-EVIDENCE-PERSISTENCE-AUDIT-2026-10-06](P365-CRON-CADENCE-AND-EVIDENCE-PERSISTENCE-AUDIT-2026-10-06.md) adalah **snapshot lama**, bukan daftar scheduler real-time.

## 5. Bukti, acceptance, dan rollback

**Proven:** SQL SELECT inventory berhasil dijalankan langsung di Supabase produksi pada 11 Oktober 2026, mengembalikan **2 baris `TERVERIFIKASI`** dengan jadwal, selector, host/Vault, dan eksekusi 24 jam sesuai tabel. Tidak ada DML, perubahan cron/job identity, atau request ke provider berbayar.

**Acceptance untuk issue #332 (jalur alias):**

1. **IN REVIEW:** PR satu issue berisi query operator read-only dan runbook; G0 tests/typecheck/lint/build pada HEAD PASS.
2. **Owner merge:** verifikasi `main` exact SHA dan dokumen sudah berada di branch utama; tidak perlu SQL aktivasi/deployment runtime karena tidak ada perubahan scheduler.
3. **Post-merge:** ulangi SELECT inventory pada produksi; kedua label tetap `TERVERIFIKASI` dan endpoint/jadwal masih identik. Catat pemeriksaan timestamp dan batasan bahwa `cron succeeded` bukan bukti data tersimpan.
4. **CLOSED (completed):** bila owner menerima **alias operator** sebagai resolusi Issue #332, tanpa memaksa rename fisik. Jika owner mengharuskan nama fisik diganti, status **BLOCKED — rename risk** sampai isu migrasi tersendiri disetujui.

**Rollback:** tidak ada perubahan state scheduler untuk dibatalkan. Revert dua file dokumentasi/SELECT melalui PR bila mapping keliru; berhenti menggunakan alias pada waktu drift dan verifikasi ulang. **Jangan melakukan DDL/DML terhadap `cron.job` sebagai rollback dokumen.**


## MACRO-CUT-004 — Retired cron operator boundary (15 Oct 2026)

Owner-approved [Issue #455](https://github.com/LDonthepath/P365/issues/455) consolidates provider-code, tests, cron, Market Memory, source IDs and docs into a **single PR**. This section records a **read-only** operator preflight, **not authorization** to unschedule a job or invoke its endpoint.

Verified from `cron.job.command` on 15 Oct 2026 14:10 UTC: #2 `p365-market-fast` actively calls GDELT, #5 `p365-event-calendar` calls retained calendars, #6 Snapshot, #24 FRED release-aware, #23 storage, and #25 retention are active and **protected**. #3 `p365-event-fast` is **inactive but Biquote-retained**. #4 `p365-fred` is **inactive** but actually called `providers=coingecko-context`, not FRED. Jobs #10 DefiLlama, #15 SoSoValue and #20 CFTC are inactive **retirement candidates**.

Run `scripts/ops/macro_cut_004_inventory_readonly.sql` immediately before any proposed scheduler change. Guard actual job ID, state, schedule, full **command** and MD5 command fingerprint. Baseline fingerprints: #4 `782d0148c1e7cd41d59e484bfb53ffeb`, #10 `9f21d7a688723db4b92eb25dcc2ae660`, #15 `2a3284586383140692bc07c0bfbfbe1a`, #20 `b957907670c619dabfc8d0aac5f59ce6`. A mismatch must STOP operations, not attempt best-effort removal.

**No automatic cron mutation in this PR.** A future operator-approved unschedule requires a **private exact command/schedule snapshot** per retired job before mutation; hashes alone cannot recreate jobs. Rollback means reinstating precisely those operator-captured commands, schedule, state, and job identity semantics, after explicit approval; do not commit command strings, CRON_SECRET, database secrets, or credentials to this public repository. If full rollback cannot be demonstrated privately, do not unschedule. Job #3 remains inactive but preserved. Independently verify retained jobs' natural HTTP receipts, but HTTP200 does not prove Market Memory inserts.

Related: [backup blocker #331](https://github.com/LDonthepath/P365/issues/331), [Snapshot timeout #438](https://github.com/LDonthepath/P365/issues/438). The intentionally blocked execution example is `scripts/ops/macro_cut_004_execution_blocked.sql`.

## MACRO-CUT-004 — Operator-approved cron retirement completed (15 October 2026, ~14:46 UTC)

The owner explicitly approved production removal. The **four inactive nonmacro jobs #4 (CoinGecko context; legacy name p365-fred), #10 (DefiLlama), #15 (SoSoValue) and #20 (CFTC)** were unscheduled transactionally using supported `cron.unschedule`. Exact original commands, schedules, database, username and active=false were first copied into the **private** `p365_ops.macro_cut_004_cron_rollback` relation. The stored command bytes are NOT published, and anon/authenticated/service_role cannot read the schema/table. A live SELECT confirmed all four absent and private backups present.

Retained job state verified unchanged: active #2 GDELT, #5 Forex Factory/Federal Reserve, #6 Snapshot, #24 FRED, #23/#25 operations, plus **#3 Biquote preserved inactive**. `scripts/ops/macro_cut_004_inventory_readonly.sql` now verifies the *post-retirement* state; guarded manual restoration procedure is `scripts/ops/macro_cut_004_cron_rollback_operator.sql` (not automatically executed). If restored, job IDs may differ; source commands and inactive state are validated. This is the **only production mutation** in this checkpoint.

**Historical data deletion did NOT run.** `public.market_memory` has active `market_memory_append_only` DELETE/UPDATE prevention trigger; 181 Snapshots/171 Contexts include retained references into CoinGecko/Yahoo history. Verified full encrypted offsite archive + full isolated restore remain undocumented in #331/#357. The owner's authorization is acknowledged but does not itself remove these technical constraints. Do not bypass triggers or mass purge history without a safe reference/backup path. The remaining data cleanup stays **BLOCKED**, not completed.
