# Fokus

Aplikasi produktivitas pribadi (PWA): 3 prioritas harian, kuota konten otomatis, tracker target (konten PMO/Pribadi/Clipper, berat badan, olahraga mingguan), bank ide & kalender konten, evaluasi malam, dan notifikasi push.

- Setup: lihat **[PANDUAN-SETUP.md](PANDUAN-SETUP.md)**
- Jalankan lokal: `npm install` lalu `npm run dev`
- Stack: React + Vite, Firebase (Auth, Firestore, Cloud Messaging), GitHub Pages, GitHub Actions (pengingat terjadwal)

## Struktur
```
src/pages/        Hari Ini, Target, Konten, Sehat, Evaluasi, Pengaturan
src/lib/goals.js  Perhitungan progress, kuota harian, on-track, cek realistis
src/lib/backend.js  Firestore (cloud) & localStorage (mode demo)
scripts/          Pengirim notifikasi terjadwal
```
Menambah jenis target/fitur baru: tambah logika di `src/lib/goals.js` + halaman di `src/pages/`, daftarkan di `PAGES` pada `src/App.jsx`.
