# Market Briefing

Dashboard pre-trade pribadi untuk mengumpulkan berita makro, berita crypto, kalender ekonomi, dan briefing harian berbahasa Indonesia.

## Sprint 1

Sprint ini menyediakan fondasi aplikasi Next.js, halaman login berbasis satu akun dari environment variable, layout dashboard responsif bergaya terminal, dan data mock untuk kebutuhan review UI. Belum ada integrasi provider berita, kalender ekonomi, atau ringkasan AI.

## Menjalankan secara lokal

1. Salin `.env.example` menjadi `.env.local`.
2. Isi `DASHBOARD_AUTH_SECRET` dengan nilai acak yang panjang serta atur email dan password akses.
3. Jalankan `npm install` lalu `npm run dev`.
4. Buka `http://localhost:3000` dan login memakai kredensial yang Anda atur.

## Environment variables

| Variable | Kegunaan |
| --- | --- |
| `DASHBOARD_AUTH_SECRET` | Kunci HMAC untuk menandatangani cookie sesi. |
| `DASHBOARD_ACCESS_EMAIL` | Satu email yang diizinkan untuk Sprint 1. |
| `DASHBOARD_ACCESS_PASSWORD` | Password akun tersebut. |

Untuk deployment Vercel, atur ketiga nilai tersebut pada Project Settings → Environment Variables. Jangan commit `.env.local` atau nilai rahasia lain ke repository.
