import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Klien Supabase untuk Server Component / Server Action / Route Handler.
//
// Memakai PUBLISHABLE key, bukan secret key — lihat PRD §7.1. Artinya RLS
// yang ditulis di migrasi benar-benar berlaku di sini, bukan cuma hiasan.
// Sesi staf dibawa lewat cookie, jadi `current_staff_role()` di DB bekerja.

const SETUP_HINT =
  "Supabase belum dikonfigurasi. Salin .env.example ke .env.local lalu isi " +
  "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.";

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return { url, key, ready: Boolean(url && key) };
}

/*
  Klien TANPA sesi — untuk semua jalur pengunjung (menu, settings, penanda, dan
  RPC pesanan).

  Ini bukan optimasi, ini perbaikan bug. Sebelumnya halaman tamu memakai klien
  bersesi, dan itu punya dua akibat buruk:

  1. Sesi staf bisa MATI karena halaman tamu. Klien bersesi akan mencoba
     menyegarkan access token yang mendekati kedaluwarsa. Server Component
     tidak boleh menulis cookie, jadi token hasil refresh tidak pernah
     tersimpan — sementara refresh token lamanya sudah dipakai dan tidak sah
     lagi. Request berikutnya membawa token mati → sesi hilang. Penyegaran
     token HARUS terjadi di proxy.ts, yang memang boleh menulis cookie.

  2. Halaman tamu ikut memakai hak staf kalau kebetulan ada staf yang login di
     browser yang sama. Halaman publik seharusnya berperilaku sama untuk semua
     orang.

  Jadi jalur tamu sengaja tidak menyentuh cookie sama sekali.
*/
export function createAnonClient() {
  const { url, key, ready } = supabaseConfig();
  if (!ready) throw new Error(SETUP_HINT);

  return createServerClient(url!, key!, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Klien BERSESI — hanya untuk halaman & aksi staf, dan untuk login. */
export async function createClient() {
  const { url, key, ready } = supabaseConfig();
  if (!ready) throw new Error(SETUP_HINT);

  const store = await cookies();

  return createServerClient(url!, key!, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        // Server Component tidak boleh menulis cookie. Diabaikan dengan sengaja;
        // penyegaran sesi dikerjakan di proxy.ts (Fase 3).
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, options);
          }
        } catch {
          /* dipanggil dari Server Component — aman diabaikan */
        }
      },
    },
  });
}
