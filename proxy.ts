import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/*
  Penjaga rute staf + penyegar sesi.

  Di Next 16 berkas ini bernama `proxy.ts`, bukan `middleware.ts`, dan
  fungsinya diekspor sebagai `proxy`.

  PENTING: ini BUKAN lapisan otorisasi yang sebenarnya — dokumentasi Next
  sendiri menegaskan proxy tidak dimaksudkan untuk itu. Penegakan yang nyata
  ada di RLS dan trigger peran di database (0001 & 0005). Yang di sini hanya
  pengalihan optimistis supaya orang tidak melihat halaman kosong: kalau
  cookie sesinya dilepas, RLS tetap menolak datanya.
*/

const STAFF_PATHS = ["/dapur", "/waiter", "/admin", "/laporan"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list) {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Menyegarkan token yang hampir kedaluwarsa. Harus dipanggil di setiap
  // request staf, kalau tidak sesi akan mati di tengah shift.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsStaff = STAFF_PATHS.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  // Mengalihkan dengan response BARU akan membuang cookie hasil penyegaran
  // token yang baru saja diset di `response`. Kalau itu terjadi, token lama
  // sudah tidak sah (sudah dirotasi) sementara yang baru tidak pernah sampai ke
  // browser — sesinya mati tanpa sebab yang jelas. Jadi cookie-nya harus
  // dipindahkan ke response redirect.
  const redirectTo = (pathname: string, withNext?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    if (withNext) url.searchParams.set("next", withNext);
    const res = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) res.cookies.set(c);
    return res;
  };

  if (needsStaff && !user) return redirectTo("/masuk", path);

  // Sudah login tapi membuka halaman login → antar ke tempatnya bekerja.
  // Halaman staf akan mengalihkan lagi sesuai peran.
  if (path === "/masuk" && user) return redirectTo("/dapur");

  return response;
}

export const config = {
  // Tanpa matcher, proxy jalan di SEMUA request termasuk _next/static dan
  // gambar — yang bisa memblokir CSS/JS tanpa disadari.
  matcher: ["/masuk", "/dapur/:path*", "/waiter/:path*", "/admin/:path*", "/laporan/:path*"],
};
