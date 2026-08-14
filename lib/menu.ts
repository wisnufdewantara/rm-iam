import { createClient } from "@/lib/supabase/server";
import type { Category, CategoryWithItems, MenuItem } from "@/lib/types";

// Baca kategori + item menu untuk dial.
//
// Kategori kosong TETAP dipulangkan: 'Paket Hemat' & 'Tambahan' di seed sengaja
// belum punya item, dan lingkarannya harus tetap muncul di dial. Itu yang
// membuktikan cincinnya data-driven, bukan hardcoded.

export async function getMenu(): Promise<CategoryWithItems[]> {
  const supabase = await createClient();

  const [cats, items] = await Promise.all([
    supabase
      .from("categories")
      .select("id, slug, name, icon_name, color, position, note_presets")
      .eq("is_active", true)
      .order("position", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, category_id, name, description, price, image_url, icon_name, position")
      .eq("is_available", true)
      .order("position", { ascending: true }),
  ]);

  if (cats.error) throw new Error(`Gagal membaca kategori: ${cats.error.message}`);
  if (items.error) throw new Error(`Gagal membaca menu: ${items.error.message}`);

  const byCategory = new Map<string, MenuItem[]>();
  for (const item of (items.data ?? []) as MenuItem[]) {
    const list = byCategory.get(item.category_id);
    if (list) list.push(item);
    else byCategory.set(item.category_id, [item]);
  }

  return ((cats.data ?? []) as Category[]).map((c) => ({
    ...c,
    items: byCategory.get(c.id) ?? [],
  }));
}
