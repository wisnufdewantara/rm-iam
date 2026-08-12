import OrderFlow from "@/components/order/OrderFlow";
import { getActiveMarkerNumbers } from "@/lib/markers";
import { getMenu } from "@/lib/menu";
import { getSettings } from "@/lib/settings";
import { supabaseConfig } from "@/lib/supabase/server";
import type { CategoryWithItems, Settings } from "@/lib/types";

// Menu harus selalu segar: superuser mengubahnya lewat dashboard tanpa deploy
// (PRD uji 37). Karena itu jangan di-prerender.
export const dynamic = "force-dynamic";

type Loaded =
  | { ok: true; settings: Settings; categories: CategoryWithItems[]; markers: string[] }
  | { ok: false; message: string };

// Pengambilan data dipisah dari JSX dengan sengaja: aturan
// react-hooks/error-boundaries benar — JSX yang dibangun di dalam try/catch
// TIDAK akan tertangkap catch-nya, karena React merendernya belakangan.
// Jadi try/catch hanya membungkus await-nya, lalu hasilnya dipulangkan sebagai data.
async function load(): Promise<Loaded> {
  try {
    const [settings, categories, markers] = await Promise.all([
      getSettings(),
      getMenu(),
      getActiveMarkerNumbers(),
    ]);
    return { ok: true, settings, categories, markers };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

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

  const result = await load();

  if (!result.ok) {
    // Kasus paling umum saat pertama kali jalan: skema belum dibuat.
    return (
      <Setup title="Skema database belum dibuat">
        <p>
          Supabase sudah terhubung, tapi tabelnya belum ada. Buka Supabase → SQL
          Editor, lalu jalankan dua file ini berurutan:
        </p>
        <pre>{`supabase/migrations/0001_init.sql
supabase/seed.sql`}</pre>
        <p style={{ fontSize: ".85em" }}>
          Pesan asli: <code>{result.message}</code>
        </p>
      </Setup>
    );
  }

  if (result.categories.length === 0) {
    return (
      <Setup title="Belum ada kategori menu">
        <p>
          Jalankan <code>supabase/seed.sql</code> di SQL Editor Supabase, atau
          tambahkan kategori dari dashboard superuser.
        </p>
      </Setup>
    );
  }

  return (
    <OrderFlow
      categories={result.categories}
      settings={result.settings}
      markers={result.markers}
    />
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
