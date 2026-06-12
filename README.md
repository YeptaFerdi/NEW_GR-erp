# NEW_GR-ERP

Aplikasi Enterprise Resource Planning (ERP) berbasis web untuk manajemen pesanan, stok, distribusi, piutang, modal, dan laporan. Dibangun dengan React + Vite + TypeScript + Tailwind, menggunakan Supabase sebagai backend (database, auth, storage).

---

## 1. Project

### 1.1 Prasyarat

Pastikan sudah terinstall:

- **Node.js** versi 18 atau lebih baru — download (https://nodejs.org/)
- **Git** — download (https://git-scm.com/)
- **VS Code** — download (https://code.visualstudio.com/)

Cek instalasi:

```bash
node -v    # harus >= v18
npm -v
git --version
```

### 1.2 Install Dependency

Di terminal VS Code (Ctrl+`):

```bash
npm install
```

### 1.3 Konfigurasi Environment (.env)

Buat file `.env` di root project (satu folder dengan `package.json`):

```bash
cp .env.example .env
```

Isi `.env` dengan kredensial Supabase Anda:

```env
VITE_SUPABASE_URL=https://zpxasirklmlioctxabth.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...dst
```

**Catatan penting:**

- File `.env` **tidak boleh** di-commit ke Git (sudah ada di `.gitignore`).
- Nilai di atas adalah kredensial aktif project Supabase yang sudah disiapkan. Bila Anda memakai project Supabase milik sendiri, ganti dengan URL dan anon key Anda — lihat bagian 2.1 cara mendapatkannya.

### 1.4 Jalankan Project

```bash
npm run dev
```

Buka `http://localhost:5173` di browser. Anda akan dialihkan ke halaman login.

---

## 2. Supabase — Database, Auth, dan Storage

Semua data aplikasi tersimpan di Supabase cloud. Anda **tidak perlu** menginstall PostgreSQL lokal.

### 2.1 Akses Dashboard Supabase

1. Buka [https://supabase.com](https://supabase.com) dan login.
2. Pilih project **zpxasirklmlioctxabth** (atau project milik Anda).
3. Menu penting:
   - **Table Editor** — lihat & edit data per tabel.
   - **SQL Editor** — jalankan query SQL langsung.
   - **Authentication > Users** — kelola user (tambah, hapus, reset password).
   - **Storage > uploads** — lihat file gambar yang diunggah.
   - **Project Settings > API** — ambil `Project URL` dan `anon public key` untuk `.env`.

### 2.2 Skema Database

Struktur tabel terdefinisi di file migrasi berikut (jangan edit manual):

```
supabase/migrations/
  20260430100709_cnmpreate_newgr_erp_schema_v2.sql   # Skema utama
  20260430130115_create_newgr_erp_schema_v2.sql   # Update v2
  20260430131733_fix_security_linter_warnings.sql # Hardening RLS
  20260430133441_create_uploads_storage_bucket.sql # Bucket upload gambar
  20260515120858_cleanup_duplicate_permission_modules.sql # Cleanup data duplikat
  20260601012448_add_product_status_and_user_profile_fields.sql # update tabel produk dan user_profile
  20260609120640_add_batal_status_to_orders_and_distributions # update batal status
  20260609123741_add_batal_to_invoices # Update batal invoices
```

Tabel utama: `user_profiles`, `roles`, `permissions`, `customers`, `producers`, `products`, `orders`, `order_items`, `invoices`, `payments`, `distributions`, `stock_movements`, `capital_entries`, `operational_costs`, `audit_logs`, `regions`.

Semua tabel sudah memiliki **Row Level Security (RLS)** aktif sehingga data hanya bisa diakses user yang login dan punya hak.

### 2.3 Upload Gambar (Storage)

- Bucket: `uploads` (public read, authenticated write).
- Folder: `products/` untuk gambar produk.
- Maksimal 5 MB per file, format JPG/PNG/WEBP/GIF.

### 2.4 Login Pertama Kali

Jika belum punya akun, buat user baru lewat halaman **Register** di aplikasi, atau tambah manual lewat Supabase Dashboard > Authentication > Users > **Add user**.

---

## 3. Perintah NPM

| Perintah            | Fungsi                                                            |
| ------------------- | ----------------------------------------------------------------- |
| `npm install`       | Install semua dependency (jalankan sekali setelah clone).         |
| `npm run dev`       | Jalankan dev server di `http://localhost:5173` dengan hot reload. |
| `npm run build`     | Build production ke folder `dist/`.                               |
| `npm run preview`   | Preview hasil build production di lokal.                          |
| `npm run lint`      | Cek error linting (ESLint).                                       |
| `npm run typecheck` | Cek error TypeScript tanpa build.                                 |

### Alur kerja standar

```bash
# 1. Install dependency (sekali saja)
npm install

# 2. Mode development
npm run dev

# 3. Sebelum deploy, pastikan build sukses
npm run build
npm run preview  # verifikasi di localhost:4173
```

---

## 4. Deploy ke Production

Hasil `npm run build` ada di folder `dist/`. Folder ini bisa di-deploy ke static hosting apa pun:

- **Vercel** — `vercel --prod`
- **Netlify** — drag & drop folder `dist/` atau `netlify deploy --prod --dir=dist`
- **Cloudflare Pages** — connect repo, build command `npm run build`, output `dist`.

Jangan lupa set environment variable `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di dashboard hosting.

---

## 5. Struktur Folder

```
.
├── public/              # Asset statis (logo, manifest PWA, service worker)
├── src/
│   ├── components/      # Komponen reusable (Layout, ImageUpload, PrintHeader, SyncStatus)
│   ├── contexts/        # React context (AuthContext)
│   ├── lib/             # Helper: supabase client, format, audit, offline-sync, types
│   ├── pages/           # Halaman: Dashboard, Orders, Products, Stock, dll.
│   │   └── reports/     # Halaman laporan (PL, Sales, Inventory, dll.)
│   ├── App.tsx          # Router utama
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles + Tailwind + print styles
├── supabase/migrations/ # Skema database (read-only, dikelola oleh tool Supabase)
├── .env                 # Kredensial Supabase (JANGAN di-commit)
├── .env.example         # Template .env
├── package.json
└── vite.config.ts
```

---

## 6. Fitur Utama

- **Auth**: login/register email-password via Supabase Auth.
- **Offline mode**: IndexedDB queue menyimpan perubahan saat offline, auto-sync ke Supabase saat online.
- **PWA**: service worker terdaftar (`public/sw.js`), aplikasi bisa di-install di Android/iOS/desktop.
- **Upload gambar**: langsung dari device (camera/gallery) ke Supabase Storage.
- **Export PDF**: setiap laporan dan nota pesanan bisa di-export via tombol Cetak; header berisi logo dan nama brand.
- **RLS**: setiap tabel dilindungi Row Level Security.

---

## 7. Troubleshooting

| Masalah                                   | Solusi                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Invalid supabase URL` saat `npm run dev` | Cek `.env` sudah diisi dan tidak ada spasi. Restart dev server.                                                          |
| Gagal login "Invalid credentials"         | Buat user baru lewat Register atau lewat Dashboard Supabase.                                                             |
| Gambar tidak muncul setelah upload        | Cek di Supabase Dashboard > Storage > `uploads` apakah file tersimpan.                                                   |
| PDF print ada header/footer browser       | Di dialog print browser, matikan opsi "Headers and footers".                                                             |
| `npm install` error di Windows            | Jalankan terminal VS Code sebagai Administrator, hapus `node_modules` dan `package-lock.json`, lalu `npm install` ulang. |

---

## 8. Keamanan

- **JANGAN** commit file `.env` ke Git.
- **JANGAN** share `service_role` key (hanya `anon` key yang boleh di frontend).
- Semua query dari frontend otomatis tunduk pada RLS — user hanya melihat data yang berhak.
- Perubahan data sensitif tercatat di tabel `audit_logs`.

---

## Lisensi

Proprietary — NEW_GR.
