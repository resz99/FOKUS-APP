# Panduan Setup Fokus

Waktu yang dibutuhkan ±20–30 menit, cukup sekali saja. Semuanya **gratis**: Firebase paket Spark, GitHub Pages, dan GitHub Actions.

Gambaran sistemnya:

- **GitHub Pages**: tempat aplikasi di-host. Alamatnya `https://USERNAME.github.io/fokus-app/`.
- **Firebase**: login Google, database (sinkron HP ↔ laptop), dan pengiriman notifikasi push.
- **GitHub Actions**: "jam weker" yang mengirim notifikasi pukul 08.00, 23.00, dan Minggu 20.00 WIB.

---

## Langkah 1: Repository GitHub

1. Buka https://github.com/new
2. Nama repository: `fokus-app`
3. Pilih **Public**. GitHub Pages gratis hanya untuk repo publik. Kode aplikasinya memang publik, tapi **data pribadimu tetap aman** di Firebase dan hanya bisa dibaca oleh akunmu.
4. Jangan centang README atau .gitignore. Klik **Create repository**.
5. Beri tahu Claude nama repo-nya (`USERNAME/fokus-app`) agar kodenya bisa langsung di-push.

## Langkah 2: Buat project Firebase

1. Buka https://console.firebase.google.com, lalu klik **Create a project** / **Add project**.
2. Nama project: `fokus-app`. Google Analytics boleh **dimatikan**. Klik **Create**.

### 2a. Login Google
1. Menu kiri **Build → Authentication → Get started**.
2. Tab **Sign-in method → Google → Enable**, pilih email support, lalu **Save**.
3. Tab **Settings → Authorized domains → Add domain**: masukkan `USERNAME.github.io` (ganti USERNAME dengan username GitHub-mu).

### 2b. Database
1. Menu kiri **Build → Firestore Database → Create database**.
2. Lokasi: **asia-southeast2 (Jakarta)**. Mode: **production**. Klik **Create**.
3. Buka tab **Rules**, hapus isinya, lalu tempel isi file `firestore.rules` berikut:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
4. Klik **Publish**.

### 2c. Daftarkan aplikasi web → kirim config ke Claude
1. Klik ⚙️ **Project settings → General**. Di bagian "Your apps" klik ikon **</>** (Web).
2. Nickname: `Fokus`. **Jangan** centang Firebase Hosting. Klik **Register app**.
3. Salin blok `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`.
4. **Kirim ke Claude.** Config ini memang dirancang untuk publik, jadi aman.

### 2d. Kunci notifikasi web (VAPID) → kirim ke Claude
1. **Project settings → Cloud Messaging**. Gulir ke **Web configuration → Web Push certificates**.
2. Klik **Generate key pair** dan salin kuncinya (teks panjang).
3. **Kirim ke Claude.** Ini kunci publik, aman dibagikan.

### 2e. Kunci server (RAHASIA, jangan dikirim ke siapa pun, termasuk Claude)
1. **Project settings → Service accounts → Generate new private key → Generate key**. Sebuah file `.json` akan terunduh.
2. Buka repo GitHub-mu: **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: buka file .json tadi dengan Notepad, lalu **salin seluruh isinya** ke sini.
3. Klik **Add secret**. Setelah itu file .json di komputermu boleh dihapus.

## Langkah 3: Aktifkan GitHub Pages
Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Setelah kode di-push, aplikasi otomatis online dalam ±2 menit. Progresnya bisa dilihat di tab **Actions**.

## Langkah 4: Pasang di HP & laptop
Buka `https://USERNAME.github.io/fokus-app/`, lalu login dengan Google.

- **Android (Chrome):** menu ⋮ → **Install app / Tambahkan ke layar utama**.
- **iPhone (Safari, iOS 16.4+):** tombol Bagikan → **Tambah ke Layar Utama**, lalu **buka dari ikon tersebut** dan login. Notifikasi di iPhone hanya berjalan dari ikon layar utama.
- **Laptop (Chrome/Edge):** klik ikon install di address bar.

Di **setiap perangkat**, buka **Pengaturan → Aktifkan notifikasi di perangkat ini**.

## Langkah 5: Tes notifikasi
Repo → tab **Actions → Kirim pengingat → Run workflow →** pilih `pagi` (atau `tugas` untuk tes pengingat tugas), lalu **Run**. Dalam ±1 menit notifikasi akan masuk.

---

## Catatan penting
- **Notifikasi bisa telat 5–20 menit.** Jadwal GitHub Actions kadang tertunda saat server sedang ramai.
- **Jadwal otomatis GitHub berhenti kalau repo tidak ada aktivitas selama 60 hari.** GitHub akan mengirim email peringatan. Cukup buka tab Actions lalu klik **Enable workflow**.
- Jam notifikasi pagi & malam diatur dari **Pengaturan** di aplikasi. GitHub mengecek setiap 15 menit.
- **Tugas berjam** diingatkan lewat notifikasi Fokus, kecuali yang sudah ditambahkan ke Kalender iPhone (tombol 📅). Untuk tugas penting, pakai Kalender karena tepat waktu dan berbunyi.
- **Mode Demo:** selama `src/firebase-config.js` masih kosong, aplikasi tetap bisa dicoba, tapi data hanya tersimpan di browser itu.
