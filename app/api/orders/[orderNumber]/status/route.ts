import { NextResponse } from "next/server";
import { fetchOrderStatus } from "@/lib/orderStatus";

// Endpoint polling untuk halaman tunggu.
//
// Kenapa polling, bukan Realtime (PRD §5): halaman tunggu diakses anonim.
// Membuat RLS aman untuk websocket anonim jauh lebih rumit daripada satu
// endpoint yang memanggil RPC security definer — dan polling kebal terhadap
// reconnect di jaringan HP yang naik-turun.

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  // Next 16: params adalah Promise.
  const { orderNumber } = await params;

  try {
    const status = await fetchOrderStatus(orderNumber);
    if (!status.found) {
      return NextResponse.json(status, {
        // 410 Gone, bukan 404: bedanya "pernah ada tapi kedaluwarsa" dengan
        // "tidak pernah ada" itu bermakna untuk pengunjung (PRD §4.4).
        status: "expired" in status && status.expired ? 410 : 404,
      });
    }
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ found: false, error: true }, { status: 500 });
  }
}
