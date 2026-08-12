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
};

/** Kategori beserta itemnya — bentuk yang dipakai dial. */
export type CategoryWithItems = Category & { items: MenuItem[] };

/** Rupiah integer → "Rp 15.000" */
export function rupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}
