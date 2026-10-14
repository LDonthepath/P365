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

