import Dial from "@/components/dial/Dial";
import { getMenu } from "@/lib/menu";
import { getSettings } from "@/lib/settings";
import { supabaseConfig } from "@/lib/supabase/server";
import type { CategoryWithItems } from "@/lib/types";

// Menu harus selalu segar: superuser mengubahnya lewat dashboard tanpa deploy
// (PRD uji 37). Karena itu jangan di-prerender.
export const dynamic = "force-dynamic";

export default async function Home() {
  if (!supabaseConfig().ready) {
    return (
      <Setup title="Supabase belum dikonfigurasi">
        <p>
          Salin <code>.env.example</code> menjadi <code>.env.local</code>, lalu isi
          dua variabel ini dari Supabase → Settings → API Keys:
        </p>
        <pre>
          {`NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
        </pre>
        <p>
          Secret key <strong>tidak</strong> diperlukan — lihat PRD §7.1.
        </p>
      </Setup>
    );
  }

  let categories: CategoryWithItems[];
  let settings;
  try {
    [settings, categories] = await Promise.all([getSettings(), getMenu()]);
  } catch (e) {
    // Kasus paling umum saat pertama kali jalan: skema belum dibuat.
    // Tampilkan instruksi, jangan halaman error.
    return (
      <Setup title="Skema database belum dibuat">
        <p>
          Supabase sudah terhubung, tapi tabelnya belum ada. Buka Supabase → SQL
          Editor, lalu jalankan dua file ini berurutan:
        </p>
        <pre>{`supabase/migrations/0001_init.sql
supabase/seed.sql`}</pre>
        <p style={{ fontSize: ".85em" }}>
          Pesan asli: <code>{e instanceof Error ? e.message : String(e)}</code>
        </p>
      </Setup>
    );
  }

  return (
    <div className="app" data-theme={settings.theme}>
      <header className="topbar">
        <span className="brand">{settings.brand_name}</span>
        <span className="table-chip">
          <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
            table_restaurant
          </span>
          {settings.table_number_label}: —
        </span>
      </header>

      {categories.length === 0 ? (
        <p className="cart-empty" style={{ margin: "3rem 1.25rem" }}>
          Belum ada kategori menu. Jalankan <code>supabase/seed.sql</code> atau
          tambahkan kategori dari dashboard superuser.
        </p>
      ) : (
        <Dial categories={categories} settings={settings} tableNumber={null} />
      )}
    </div>
  );
}

function Setup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setup">
      <h1>{title}</h1>
      {children}
    </div>
  );
}
