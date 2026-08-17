import { redirect } from "next/navigation";
import AdminNotice from "@/components/staff/AdminNotice";
import StaffBar from "@/components/staff/StaffBar";
import {
  createCategoryAction,
  createItemAction,
  deleteCategoryAction,
  deleteItemAction,
  updateCategoryAction,
  updateItemAction,
} from "@/lib/adminActions";
import { getStaff, homeForRole } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { rupiah } from "@/lib/types";

export const dynamic = "force-dynamic";

type Cat = {
  id: string;
  slug: string;
  name: string;
  icon_name: string;
  position: number;
  is_active: boolean;
  note_presets: string[] | null;
};
type Item = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  icon_name: string | null;
  image_url: string | null;
  position: number;
  is_available: boolean;
};

export default async function AdminMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const staff = await getStaff();
  if (!staff) redirect("/masuk?next=/admin/menu");
  if (staff.role !== "superuser") redirect(homeForRole(staff.role));

  const { ok, err } = await searchParams;
  const supabase = await createClient();

  // Superuser melihat SEMUA, termasuk yang nonaktif — halaman tamu yang
  // menyaring is_active/is_available, bukan halaman ini.
  const [{ data: cats }, { data: items }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, slug, name, icon_name, position, is_active, note_presets")
      .order("position"),
    supabase
      .from("menu_items")
      .select(
        "id, category_id, name, description, price, icon_name, image_url, position, is_available"
      )
      .order("position"),
  ]);

  const categories = (cats ?? []) as Cat[];
  const menuItems = (items ?? []) as Item[];

  return (
    <div className="staff">
      <StaffBar staff={staff} title="Kelola Menu" />
      <div className="adm">
        <AdminNotice ok={ok} err={err} />

        <p className="adm-hint">
          Semua yang ada di halaman ini tersimpan sebagai data, bukan kode —
          mengubahnya tidak butuh deploy. Refresh halaman tamu setelah menyimpan.
        </p>

        {/* ---------------- KATEGORI ---------------- */}
        <section className="adm-sec">
          <h2>Kategori ({categories.length})</h2>
          <p className="adm-sub">
            Urutan di cincin dial mengikuti kolom Posisi. Nama ikon memakai{" "}
            <a href="https://fonts.google.com/icons" target="_blank" rel="noreferrer">
              Material Symbols
            </a>
            . Catatan cepat dipisah koma; kosongkan untuk memakai bawaan.
          </p>

          {categories.map((c) => (
            <form action={updateCategoryAction} className="adm-row" key={c.id}>
              <input type="hidden" name="id" value={c.id} />
              <label className="adm-f adm-pos">
                <span>Pos</span>
                <input name="position" type="number" defaultValue={c.position} min={1} />
              </label>
              <label className="adm-f">
                <span>Nama</span>
                <input name="name" defaultValue={c.name} required />
              </label>
              <label className="adm-f">
                <span>Slug</span>
                <input name="slug" defaultValue={c.slug} required />
              </label>
              <label className="adm-f">
                <span>Ikon</span>
                <input name="icon_name" defaultValue={c.icon_name} required />
              </label>
              <label className="adm-f adm-grow">
                <span>Catatan cepat</span>
                <input
                  name="note_presets"
                  defaultValue={(c.note_presets ?? []).join(", ")}
                  placeholder="Pedas, Tidak pedas"
                />
              </label>
              <label className="adm-chk">
                <input type="checkbox" name="is_active" defaultChecked={c.is_active} />
                Aktif
              </label>
              <button type="submit" className="adm-save">
                Simpan
              </button>
              <button
                type="submit"
                formAction={deleteCategoryAction}
                className="cart-del"
                aria-label={`Hapus kategori ${c.name}`}
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </form>
          ))}

          <form action={createCategoryAction} className="adm-row adm-new">
            <label className="adm-f adm-pos">
              <span>Pos</span>
              <input name="position" type="number" defaultValue={categories.length + 1} min={1} />
            </label>
            <label className="adm-f">
              <span>Nama</span>
              <input name="name" placeholder="Paket Hemat" required />
            </label>
            <label className="adm-f">
              <span>Slug</span>
              <input name="slug" placeholder="paket-hemat" required />
            </label>
            <label className="adm-f">
              <span>Ikon</span>
              <input name="icon_name" defaultValue="restaurant" required />
            </label>
            <label className="adm-f adm-grow">
              <span>Catatan cepat</span>
              <input name="note_presets" placeholder="Pedas, Tidak pedas" />
            </label>
            <button type="submit" className="btn-primary adm-add">
              Tambah kategori
            </button>
          </form>
        </section>

        {/* ---------------- MENU ---------------- */}
        <section className="adm-sec">
          <h2>Menu ({menuItems.length})</h2>
          <p className="adm-sub">
            Harga dalam rupiah tanpa titik. Kosongkan URL gambar untuk memakai
            ikon; gambar akan menyatu sebagai kepala dialog di halaman tamu.
          </p>

          {categories.map((c) => {
            const list = menuItems.filter((i) => i.category_id === c.id);
            return (
              <div className="adm-cat" key={c.id}>
                <h3>
                  <span className="material-symbols-outlined">{c.icon_name}</span>
                  {c.name}
                  <span className="kds-count">{list.length}</span>
                </h3>

                {list.map((it) => (
                  <form action={updateItemAction} className="adm-row" key={it.id}>
                    <input type="hidden" name="id" value={it.id} />
                    <label className="adm-f adm-pos">
                      <span>Pos</span>
                      <input name="position" type="number" defaultValue={it.position} min={0} />
                    </label>
                    <label className="adm-f adm-grow">
                      <span>Nama</span>
                      <input name="name" defaultValue={it.name} required />
                    </label>
                    <label className="adm-f adm-price">
                      <span>Harga</span>
                      <input name="price" type="number" defaultValue={it.price} min={0} required />
                    </label>
                    <label className="adm-f">
                      <span>Kategori</span>
                      <select name="category_id" defaultValue={it.category_id}>
                        {categories.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="adm-f">
                      <span>Ikon</span>
                      <input name="icon_name" defaultValue={it.icon_name ?? ""} />
                    </label>
                    <label className="adm-f adm-grow">
                      <span>Deskripsi</span>
                      <input name="description" defaultValue={it.description ?? ""} />
                    </label>
                    <label className="adm-f adm-grow">
                      <span>URL gambar</span>
                      <input name="image_url" defaultValue={it.image_url ?? ""} placeholder="(opsional)" />
                    </label>
                    <label className="adm-chk">
                      <input
                        type="checkbox"
                        name="is_available"
                        defaultChecked={it.is_available}
                      />
                      Tersedia
                    </label>
                    <span className="adm-view">{rupiah(it.price)}</span>
                    <button type="submit" className="adm-save">
                      Simpan
                    </button>
                    <button
                      type="submit"
                      formAction={deleteItemAction}
                      className="cart-del"
                      aria-label={`Hapus ${it.name}`}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </form>
                ))}

                <form action={createItemAction} className="adm-row adm-new">
                  <input type="hidden" name="category_id" value={c.id} />
                  <label className="adm-f adm-pos">
                    <span>Pos</span>
                    <input name="position" type="number" defaultValue={list.length + 1} min={0} />
                  </label>
                  <label className="adm-f adm-grow">
                    <span>Nama</span>
                    <input name="name" placeholder={`Menu baru di ${c.name}`} required />
                  </label>
                  <label className="adm-f adm-price">
                    <span>Harga</span>
                    <input name="price" type="number" placeholder="15000" min={0} required />
                  </label>
                  <label className="adm-f">
                    <span>Ikon</span>
                    <input name="icon_name" placeholder="restaurant" />
                  </label>
                  <label className="adm-f adm-grow">
                    <span>Deskripsi</span>
                    <input name="description" placeholder="(opsional)" />
                  </label>
                  <button type="submit" className="btn-primary adm-add">
                    Tambah menu
                  </button>
                </form>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
