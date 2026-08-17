import { createAnonClient } from "@/lib/supabase/server";
import type { Settings } from "@/lib/types";

// SATU-SATUNYA tempat yang membaca tabel `settings`.
//
// Disiplin ini disengaja (PRD §13): jangan sebar `where id = 1` ke banyak file.
// Kalau suatu saat settings jadi satu baris per outlet, cuma fungsi ini yang
// berubah. Murah sekarang, menyelamatkan nanti.

/** Nilai bawaan kalau DB belum siap — supaya UI tidak pernah kosong. */
export const DEFAULT_SETTINGS: Settings = {
  brand_name: "RM-IAM",
  accent: "#f97316",
  theme: "light",
  hint_text: "Ketuk kategori untuk melihat menu",
  cancel_notice:
    "Pesanan yang sudah dibayar tidak bisa dibatalkan sendiri. Silakan panggil waiter kami.",
  dial_radius_rem: 12,
  kiosk_idle_secs: 60,
  order_ttl_hours: 12,
  identity_mode: "marker",
  table_number_label: "Nomor Meja",
  ask_customer_name: true,
  duplicate_window_secs: 60,
  same_table_warn_threshold: 3,
  guest_order_rate_limit_secs: 15,
  guest_paid_orders_per_hour: 10,
  note_presets: ["Pedas", "Tidak pedas", "Sedikit garam", "Tanpa sambal"],
  dial_max_ring: 12, // 12 slot, mengikuti angka pada jam

};

export async function getSettings(): Promise<Settings> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...data } as Settings;
}
