"use client";

import { createBrowserClient } from "@supabase/ssr";

// Klien browser — dipakai HANYA untuk Realtime di layar staf.
//
// Sesinya dibaca dari cookie yang sama dengan klien server, jadi RLS berlaku
// dengan peran staf yang sedang login. Tetap publishable key; tidak ada secret
// key di mana pun (PRD §7.1).

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
