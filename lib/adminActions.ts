"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/staff";

/*
  Aksi superuser: kelola kategori, menu, penanda meja, dan konfigurasi.

  Dipakai lewat <form action={...}> tanpa JavaScript tambahan — jadi halaman
  admin tetap berfungsi walau JS gagal dimuat, dan kodenya jauh lebih sedikit
  daripada mengelola state form di klien.

  Otorisasi: dijaga RLS (`superuser writes ...` di 0001). Penjagaan di sini
  hanya supaya pesan errornya jelas, bukan sebagai lapisan keamanan utama.
*/

async function requireSuperuser(back: string) {
  const staff = await getStaff();
  if (!staff || staff.role !== "superuser") {
    redirect(`${back}?err=${encodeURIComponent("Hanya superuser yang boleh mengubah ini.")}`);
  }
  return staff;
}

function fail(back: string, msg: string): never {
  redirect(`${back}?err=${encodeURIComponent(msg)}`);
}
function done(back: string, msg: string): never {
  revalidatePath(back);
  revalidatePath("/");
  redirect(`${back}?ok=${encodeURIComponent(msg)}`);
}

/** "Pedas, Tanpa es" → ["Pedas","Tanpa es"]; kosong → null (pakai default). */
function parsePresets(raw: string | null): string[] | null {
  const list = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : null;
}

// ============================ KATEGORI ============================

const MENU = "/admin/menu";

const CategoryInput = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(40),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung")
    .max(40),
  icon_name: z.string().trim().min(1).max(40),
  position: z.coerce.number().int().min(1).max(99),
});

export async function createCategoryAction(formData: FormData) {
  await requireSuperuser(MENU);
  const parsed = CategoryInput.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    icon_name: formData.get("icon_name"),
    position: formData.get("position"),
  });
  if (!parsed.success) fail(MENU, parsed.error.issues[0]!.message);

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    ...parsed.data,
    note_presets: parsePresets(formData.get("note_presets") as string | null),
  });
  if (error) fail(MENU, error.message);
  done(MENU, `Kategori "${parsed.data.name}" ditambahkan.`);
}

export async function updateCategoryAction(formData: FormData) {
  await requireSuperuser(MENU);
  const id = String(formData.get("id") ?? "");
  const parsed = CategoryInput.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    icon_name: formData.get("icon_name"),
    position: formData.get("position"),
  });
  if (!parsed.success) fail(MENU, parsed.error.issues[0]!.message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      ...parsed.data,
      is_active: formData.get("is_active") === "on",
      note_presets: parsePresets(formData.get("note_presets") as string | null),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) fail(MENU, error.message);
  done(MENU, `Kategori "${parsed.data.name}" disimpan.`);
}

export async function deleteCategoryAction(formData: FormData) {
  await requireSuperuser(MENU);
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    // FK menu_items.category_id memakai on delete restrict — memang disengaja:
    // menghapus kategori berisi menu akan menghapus menu secara tak sengaja.
    fail(
      MENU,
      "Kategori masih punya menu. Pindahkan atau hapus menunya dulu, atau nonaktifkan kategorinya saja."
    );
  }
  done(MENU, "Kategori dihapus.");
}

// ============================== MENU ==============================

const ItemInput = z.object({
  category_id: z.uuid("Kategori belum dipilih"),
  name: z.string().trim().min(1, "Nama menu wajib diisi").max(60),
  description: z.string().trim().max(200).nullable(),
  price: z.coerce.number().int().min(0, "Harga tidak boleh negatif").max(100_000_000),
  icon_name: z.string().trim().max(40).nullable(),
  image_url: z.string().trim().max(500).nullable(),
  position: z.coerce.number().int().min(0).max(999),
});

function itemFrom(formData: FormData) {
  const str = (k: string) => {
    const v = formData.get(k);
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? null : s;
  };
  return ItemInput.safeParse({
    category_id: formData.get("category_id"),
    name: formData.get("name"),
    description: str("description"),
    price: formData.get("price"),
    icon_name: str("icon_name"),
    image_url: str("image_url"),
    position: formData.get("position") || 0,
  });
}

export async function createItemAction(formData: FormData) {
  await requireSuperuser(MENU);
  const parsed = itemFrom(formData);
  if (!parsed.success) fail(MENU, parsed.error.issues[0]!.message);

  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").insert(parsed.data);
  if (error) fail(MENU, error.message);
  done(MENU, `Menu "${parsed.data.name}" ditambahkan.`);
}

export async function updateItemAction(formData: FormData) {
  await requireSuperuser(MENU);
  const id = String(formData.get("id") ?? "");
  const parsed = itemFrom(formData);
  if (!parsed.success) fail(MENU, parsed.error.issues[0]!.message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({
      ...parsed.data,
      is_available: formData.get("is_available") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) fail(MENU, error.message);
  done(MENU, `Menu "${parsed.data.name}" disimpan.`);
}

export async function deleteItemAction(formData: FormData) {
  await requireSuperuser(MENU);
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  // order_items.menu_item_id memakai on delete set null, dan arsip menyimpan
  // snapshot nama & harga — jadi menghapus menu tidak merusak riwayat penjualan.
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) fail(MENU, error.message);
  done(MENU, "Menu dihapus. Riwayat penjualannya tetap utuh.");
}

// ========================== PENANDA MEJA ==========================

const MARKER = "/admin/penanda";

const MarkerInput = z.object({
  number: z.string().trim().min(1, "Nomor penanda wajib diisi").max(16),
  label: z.string().trim().max(40).nullable(),
  kind: z.enum(["dine_in", "takeaway"]),
});

export async function createMarkerAction(formData: FormData) {
  await requireSuperuser(MARKER);
  const label = String(formData.get("label") ?? "").trim();
  const parsed = MarkerInput.safeParse({
    number: formData.get("number"),
    label: label === "" ? null : label,
    kind: formData.get("kind") ?? "dine_in",
  });
  if (!parsed.success) fail(MARKER, parsed.error.issues[0]!.message);

  const supabase = await createClient();
  const { error } = await supabase.from("table_markers").insert(parsed.data);
  if (error) {
    fail(MARKER, error.code === "23505" ? "Nomor penanda itu sudah ada." : error.message);
  }
  done(MARKER, `Penanda ${parsed.data.number} ditambahkan.`);
}

export async function toggleMarkerAction(formData: FormData) {
  await requireSuperuser(MARKER);
  const id = String(formData.get("id") ?? "");
  const next = formData.get("to") === "on";
  const supabase = await createClient();
  const { error } = await supabase
    .from("table_markers")
    .update({ is_active: next })
    .eq("id", id);
  if (error) fail(MARKER, error.message);
  // Menonaktifkan penanda hanya menolak pesanan BARU; pesanan yang sedang
  // berjalan dengan nomor itu tetap jalan.
  done(MARKER, next ? "Penanda diaktifkan." : "Penanda dinonaktifkan.");
}

export async function deleteMarkerAction(formData: FormData) {
  await requireSuperuser(MARKER);
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("table_markers").delete().eq("id", id);
  if (error) fail(MARKER, error.message);
  done(MARKER, "Penanda dihapus.");
}

// =========================== KONFIGURASI ==========================

const DIAL = "/admin/dial";

const SettingsInput = z.object({
  brand_name: z.string().trim().min(1, "Nama brand wajib diisi").max(60),
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Warna aksen harus format #rrggbb"),
  theme: z.enum(["light", "dark"]),
  hint_text: z.string().trim().min(1).max(120),
  cancel_notice: z.string().trim().min(1).max(300),
  table_number_label: z.string().trim().min(1).max(40),
  identity_mode: z.enum(["marker", "marker_free", "table_qr", "queue"]),
  dial_max_ring: z.coerce.number().int().min(6).max(12),
  order_ttl_hours: z.coerce.number().int().min(1).max(168),
  kiosk_idle_secs: z.coerce.number().int().min(15).max(600),
  duplicate_window_secs: z.coerce.number().int().min(0).max(600),
  same_table_warn_threshold: z.coerce.number().int().min(1).max(50),
  guest_order_rate_limit_secs: z.coerce.number().int().min(0).max(600),
  guest_paid_orders_per_hour: z.coerce.number().int().min(1).max(200),
});

export async function updateSettingsAction(formData: FormData) {
  await requireSuperuser(DIAL);

  const parsed = SettingsInput.safeParse(
    Object.fromEntries(
      [
        "brand_name", "accent", "theme", "hint_text", "cancel_notice",
        "table_number_label", "identity_mode", "dial_max_ring",
        "order_ttl_hours", "kiosk_idle_secs", "duplicate_window_secs",
        "same_table_warn_threshold", "guest_order_rate_limit_secs",
        "guest_paid_orders_per_hour",
      ].map((k) => [k, formData.get(k)])
    )
  );
  if (!parsed.success) fail(DIAL, parsed.error.issues[0]!.message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      ...parsed.data,
      ask_customer_name: formData.get("ask_customer_name") === "on",
      note_presets:
        parsePresets(formData.get("note_presets") as string | null) ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) fail(DIAL, error.message);
  done(DIAL, "Konfigurasi disimpan. Halaman tamu langsung ikut berubah.");
}
