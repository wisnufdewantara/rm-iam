import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Klien Supabase untuk Server Component / Server Action / Route Handler.
//
// Memakai PUBLISHABLE key, bukan secret key — lihat PRD §7.1. Artinya RLS
// yang ditulis di migrasi benar-benar berlaku di sini, bukan cuma hiasan.
// Sesi staf dibawa lewat cookie, jadi `current_staff_role()` di DB bekerja.

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return { url, key, ready: Boolean(url && key) };
}

export async function createClient() {
  const { url, key, ready } = supabaseConfig();
  if (!ready) {
    throw new Error(
      "Supabase belum dikonfigurasi. Salin .env.example ke .env.local lalu isi " +
        "NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

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
