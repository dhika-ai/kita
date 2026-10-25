# Project KITA: Happiness in your household

Aplikasi web manajemen rumah tangga (Next.js). Brief produk: [Brief.md](Brief.md).

## Menjalankan di komputer

Butuh Node.js 20 atau lebih baru.

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Perintah lain

| Perintah            | Fungsi                              |
| ------------------- | ----------------------------------- |
| `npm run lint`      | Cek kode dengan ESLint              |
| `npm run typecheck` | Cek tipe TypeScript                 |
| `npm run format`    | Rapikan format kode dengan Prettier |
| `npm run build`     | Build versi produksi                |

## Database (Supabase)

- Skema database ditulis sebagai file migrasi SQL di `supabase/migrations/`.
- Setiap push ke `main` yang mengubah folder itu menjalankan workflow **Database migrations**, yang menerapkan migrasi ke proyek Supabase.
- Workflow butuh tiga secret di GitHub (Settings > Secrets and variables > Actions):

| Secret                  | Diambil dari                                                                |
| ----------------------- | --------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | supabase.com > Account > Access Tokens                                      |
| `SUPABASE_PROJECT_REF`  | ID proyek, bagian dari URL dashboard `supabase.com/dashboard/project/<ref>` |
| `SUPABASE_DB_PASSWORD`  | Password database yang dibuat saat proyek dibuat                            |
