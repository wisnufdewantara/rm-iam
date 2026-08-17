import { NextResponse } from "next/server";
import { createAnonClient, supabaseConfig } from "@/lib/supabase/server";

/*
  Jalur kedua untuk menjaga Supabase tidak di-pause.

  Kenapa ada dua jalur: yang utama GitHub Action harian
  (.github/workflows/keep-supabase-awake.yml), tapi Actions bisa mati total di
  luar kendali proyek — akun terkunci karena tagihan, kuota, atau Actions
  dimatikan di level organisasi. Kalau satu-satunya penjaga porto ikut mati,
  demonya mati diam-diam. Jadi Vercel Cron dipakai sebagai cadangan yang
  berdiri sendiri.

  Vercel Hobby mengizinkan 1 cron per hari — persis cukup untuk ini.

  Vercel mengirim header `Authorization: Bearer $CRON_SECRET` bila env var
  CRON_SECRET diisi. Kalau diisi, endpoint ini menolak permintaan tanpa header
  itu supaya tidak bisa dipanggil sembarang orang. Kalau tidak diisi, endpoint
  tetap jalan — tapi memang tidak ada yang rahasia di sini: dia hanya membaca
  satu baris `settings` yang policy RLS-nya sudah publik.
*/

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  if (!supabaseConfig().ready) {
    return NextResponse.json(
      { ok: false, error: "Supabase belum dikonfigurasi" },
      { status: 500 }
    );
  }

  try {
    const supabase = createAnonClient();
    // Query paling murah yang tetap dihitung sebagai aktivitas database.
    const { error } = await supabase.from("settings").select("id").limit(1);
    if (error) throw new Error(error.message);

    return NextResponse.json(
      { ok: true, at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
