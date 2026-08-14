// Bentuk data yang dipakai bersama server & klien.
// Sengaja mirip kolom Postgres supaya tidak ada lapisan pemetaan yang perlu
// dijaga sinkron.

export type Settings = {
  brand_name: string;
  accent: string;
  theme: "light" | "dark";
  hint_text: string;
  cancel_notice: string;
  dial_radius_rem: number;
  kiosk_idle_secs: number;
  order_ttl_hours: number;
  identity_mode: "marker" | "marker_free" | "table_qr" | "queue";
  table_number_label: string;
  ask_customer_name: boolean;
  duplicate_window_secs: number;
  same_table_warn_threshold: number;
  guest_order_rate_limit_secs: number;
  guest_paid_orders_per_hour: number;
  /** Catatan cepat bawaan, dipakai kalau kategori tidak punya sendiri. */
  note_presets: string[];
  /** Maksimum lingkaran per halaman cincin; sisanya dipaginasi. */
  dial_max_ring: number;
};

export type MenuItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number; // rupiah, integer
  image_url: string | null;
  icon_name: string | null;
  position: number;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  icon_name: string;
  color: string | null;
  position: number;
  /** Catatan cepat khusus kategori ini; null = pakai settings.note_presets. */
  note_presets: string[] | null;
};

/**
 * Label pendek untuk lingkaran item.
 *
 * Lingkaran cuma selebar ~4.5rem, sementara menu nyata punya nama seperti
 * "Nasi Goreng Pete Ikan Asin". Karena lingkaran tengah SUDAH menampilkan nama
 * kategorinya, awalan yang mengulang kategori dibuang: di kategori
 * "Nasi Goreng", item "Nasi Goreng Pete Ikan Asin" tampil sebagai
 * "Pete Ikan Asin". Nama utuh tetap ada di tooltip dan di popover, jadi tidak
 * ada informasi yang hilang.
 */
export function shortItemLabel(itemName: string, categoryName: string): string {
  const name = itemName.trim();
  const prefix = categoryName.trim();
  if (
    name.length > prefix.length + 1 &&
    name.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase() &&
    name[prefix.length] === " "
  ) {
    return name.slice(prefix.length + 1);
  }
  return name;
}

/** Kategori beserta itemnya — bentuk yang dipakai dial. */
export type CategoryWithItems = Category & { items: MenuItem[] };

/** Rupiah integer → "Rp 15.000" */
export function rupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}
