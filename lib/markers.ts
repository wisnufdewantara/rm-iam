import { createClient } from "@/lib/supabase/server";

// Daftar nomor penanda meja yang aktif, untuk validasi di layar masuk.
//
// Hanya nomornya yang dikirim ke klien — tidak ada gunanya membocorkan id
// atau label internal ke halaman publik.
export async function getActiveMarkerNumbers(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("table_markers")
    .select("number")
    .eq("is_active", true);

  if (error) throw new Error(`Gagal membaca penanda meja: ${error.message}`);
  return (data ?? []).map((r) => r.number as string);
}
