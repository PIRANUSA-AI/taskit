# Kebijakan Keamanan

TASKIT memproses rekaman suara, transkrip rapat, ringkasan, action items, akun pengguna, dan metadata kerja tim. Data seperti ini bisa memuat informasi pribadi, rahasia perusahaan, keputusan bisnis, atau data lain yang dilindungi hukum. Karena itu, keamanan dan privasi bukan fitur tambahan, tetapi bagian utama dari cara aplikasi ini harus dijalankan.

Dokumen ini menjelaskan cara melaporkan celah keamanan, ruang lingkup yang kami perhatikan, dan praktik operasional yang wajib dijaga saat TASKIT dipakai di lingkungan produksi.

---

## Melaporkan Celah Keamanan

Jika Anda menemukan celah keamanan, jangan membuat issue publik, jangan mengunggah bukti eksploitasi ke forum terbuka, dan jangan membagikan data pengguna.

Kirim laporan secara langsung ke tim pengelola:

- Email: security at piranusa dot id
- PGP: tersedia jika diminta

Sertakan informasi berikut jika memungkinkan:

- Jenis celah keamanan.
- Langkah reproduksi yang jelas.
- Endpoint, versi, atau komponen yang terdampak.
- Dampak yang mungkin terjadi.
- Bukti secukupnya tanpa membocorkan data sensitif.
- Saran perbaikan, jika ada.

Kami menghargai laporan yang bertanggung jawab dan tidak merusak sistem, data, atau layanan pihak ketiga.

---

## Target Respons

Target waktu berikut adalah panduan operasional, bukan jaminan hukum:

| Tingkat Risiko | Contoh | Target Respons Awal | Target Perbaikan |
|---|---|---:|---:|
| Kritis | Akses tidak sah ke data rapat, bypass auth, bocor secret produksi | 24 jam | 1-3 hari kerja |
| Tinggi | Privilege escalation, IDOR, upload file berbahaya, data exposure terbatas | 48 jam | 7 hari kerja |
| Sedang | Rate limit lemah, validasi input kurang, konfigurasi CORS tidak tepat | 3 hari kerja | 14 hari kerja |
| Rendah | Hardening, header keamanan, informasi versi | 5 hari kerja | Sesuai prioritas |

Selama proses perbaikan, kami dapat meminta reporter menjaga kerahasiaan detail teknis sampai patch tersedia.

---

## Ruang Lingkup

Yang termasuk ruang lingkup:

- Backend API TASKIT.
- Worker transkripsi.
- Frontend web/PWA.
- Autentikasi dan session cookie.
- Kontrol akses user/admin.
- Upload audio dan akses file Supabase Storage.
- Penyimpanan metadata, transkrip, ringkasan, action items, dan cache di Postgres.
- Integrasi Deepgram dan GLM/Zhipu AI sepanjang dipakai oleh aplikasi ini.
- Konfigurasi CORS, secret, dan deployment Fly.io/Vercel yang berhubungan langsung dengan TASKIT.

Yang tidak termasuk ruang lingkup:

- Layanan pihak ketiga yang diserang secara langsung di luar penggunaan TASKIT.
- Social engineering terhadap karyawan atau pengguna.
- Serangan fisik.
- Spam, brute force masif, atau load test tanpa izin.
- Laporan tanpa dampak keamanan yang jelas.

---

## Data dan Kepatuhan Indonesia

TASKIT harus dijalankan dengan memperhatikan ketentuan Indonesia, terutama:

- UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
- UU ITE beserta perubahannya.
- PP No. 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik.
- Kebijakan internal organisasi terkait klasifikasi data, retensi, audit, dan akses.

Praktik minimum yang harus diterapkan:

- Beri tahu peserta rapat bahwa audio akan direkam dan diproses oleh sistem.
- Pastikan ada dasar pemrosesan data yang sah sebelum upload rekaman.
- Jangan upload data sensitif jika tidak perlu.
- Batasi akses transkrip berdasarkan kebutuhan kerja.
- Siapkan mekanisme koreksi atau penghapusan data jika dibutuhkan.
- Hapus file audio dan transkrip sesuai masa retensi yang ditetapkan organisasi.
- Audit akses admin secara berkala.

Dokumen ini bukan nasihat hukum. Untuk pemrosesan data berskala besar, data pelanggan, data karyawan, atau data sensitif, lakukan penilaian bersama tim legal/compliance.

---

## Praktik Keamanan Wajib

### Secret dan Kredensial

- Simpan secret di Fly.io secrets, Vercel environment variables, atau secret manager yang setara.
- Jangan commit `.env`, service role key, S3 secret, Deepgram key, GLM key, token Fly, atau kredensial database.
- Rotasi secret jika pernah muncul di log, chat, screenshot, commit, atau perangkat yang tidak tepercaya.
- Gunakan kredensial Supabase Storage S3 khusus, bukan key yang lebih luas dari kebutuhan.

### Autentikasi dan Akses

- Gunakan password admin yang kuat.
- Batasi jumlah admin.
- Matikan `ALLOW_PUBLIC_SIGNUP` jika pendaftaran publik tidak dibutuhkan.
- Terapkan prinsip least privilege untuk database, storage, dan dashboard.
- Gunakan session cookie secure di production.

### Upload dan Storage

- Batasi ukuran upload dengan `MAX_UPLOAD_MB`.
- Validasi MIME type audio.
- Simpan file audio hanya di bucket yang ditentukan.
- Jangan membuat bucket publik kecuali benar-benar diperlukan.
- Gunakan path storage yang terikat ke user dan job.
- Pastikan worker hanya memproses job yang valid dan dimiliki sistem.

### CORS dan Origin

- Gunakan `ALLOWED_ORIGINS` yang spesifik, misalnya domain Vercel production dan localhost development.
- Jangan gunakan wildcard untuk credentialed requests.
- Jika direct upload ke Supabase diaktifkan, pastikan CORS Storage mengizinkan origin, method, dan header yang sesuai. Jika tidak, gunakan jalur upload melalui backend.

### Logging

- Log boleh mencatat status job, request path, dan error teknis.
- Jangan log isi transkrip, audio, password, session token, API key, atau secret.
- Hati-hati saat membagikan screenshot log karena bisa memuat path object, user id, atau nama file.

### AI dan Data Pihak Ketiga

- Audio dikirim ke Deepgram untuk transkripsi.
- Teks/transkrip dikirim ke GLM/Zhipu AI untuk ringkasan dan action items.
- Pastikan penggunaan provider AI sesuai kebijakan organisasi dan dasar pemrosesan data.
- Jangan upload data yang tidak boleh diproses oleh pihak ketiga.

---

## Checklist Produksi

Sebelum production:

- `NODE_ENV=production`.
- `DATABASE_URL` memakai Supabase pooler yang sesuai.
- `STORAGE_PROVIDER=s3`.
- `S3_ENDPOINT`, `S3_BUCKET`, dan kredensial S3 benar.
- `ALLOWED_ORIGINS` hanya berisi origin yang sah.
- `DEFAULT_ADMIN_PASSWORD` kuat dan sudah diganti dari default.
- `ALLOW_PUBLIC_SIGNUP` sesuai kebijakan.
- `MAX_UPLOAD_MB` sesuai kebutuhan dan kapasitas.
- Worker process aktif.
- `/health` mengembalikan 200.
- Backup dan retensi database disepakati.
- Prosedur hapus data tersedia.

Setelah production:

- Monitor health check Fly.io.
- Monitor job gagal dan error worker.
- Review akun admin secara berkala.
- Rotasi secret berkala atau saat ada insiden.
- Evaluasi kebijakan retensi audio dan transkrip.

---

## Disclosure

Kami mengikuti prinsip responsible disclosure:

1. Reporter mengirim laporan secara privat.
2. Tim memverifikasi dan mengukur dampak.
3. Perbaikan dibuat dan diuji.
4. Patch dideploy.
5. Pengungkapan publik, jika diperlukan, dilakukan setelah risiko terkendali atau sesuai kesepakatan.

Mohon tidak melakukan eksploitasi lanjutan, exfiltration data, perubahan data, persistence, atau akses ke akun pengguna lain. Jika pembuktian membutuhkan data, gunakan data milik sendiri atau data dummy.

---

## Versi yang Didukung

| Versi | Status |
|---|---|
| 1.x | Didukung |

---

Hak cipta 2026 Contrivention. Dibangun untuk penggunaan internal dan operasional tim di Indonesia.
