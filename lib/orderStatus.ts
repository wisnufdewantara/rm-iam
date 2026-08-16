import { createClient } from "@/lib/supabase/server";
import { readGuestToken } from "@/lib/guest";

export type OrderStatusValue =
  | "pending_payment"
  | "paid"
  | "queued"
  | "done"
  | "cancelled";

export type OrderStatus = {
  found: boolean;
  expired?: boolean;
  order_number: string;
  table_number: string;
  status: OrderStatusValue;
  customer_short: string;
  item_count: number;
  total: number;
  queue_position: number;
  cancel_reason: string | null;
  created_at: string;
  paid_at: string | null;
  queued_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  mine: boolean;
  items: { name: string; price: number; qty: number; note: string | null; status: string }[];
};

/** Baca status pesanan lewat RPC security definer (tanpa secret key). */
export async function fetchOrderStatus(
  orderNumber: string
): Promise<OrderStatus | { found: false; expired?: boolean }> {
  const token = await readGuestToken();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_order_status", {
    p_order_number: orderNumber,
    p_guest_token: token,
  });

  if (error) throw new Error(error.message);
  return data as OrderStatus;
}

export async function fetchMyOrders() {
  const token = await readGuestToken();
  if (!token) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_orders", {
    p_guest_token: token,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    order_number: string;
    table_number: string;
    status: OrderStatusValue;
    total: number;
    created_at: string;
  }[];
}

export const STATUS_LABEL: Record<OrderStatusValue, string> = {
  pending_payment: "Menunggu pembayaran",
  paid: "Sudah dibayar",
  queued: "Sedang disiapkan",
  done: "Pesanan siap",
  cancelled: "Dibatalkan",
};
