import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

// Identitas pengunjung = satu UUID di cookie httpOnly. Tanpa akun, tanpa
// data pribadi selain nama panggilan yang ikut terhapus dalam 12 jam.
//
// httpOnly disengaja: token ini yang membedakan "tampilan penuh" dan
// "tampilan publik" di halaman tunggu, jadi JavaScript halaman tidak perlu
// (dan tidak boleh) menyentuhnya.

const COOKIE = "rmiam_guest";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

export async function readGuestToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/** Baca token, buat kalau belum ada. Hanya boleh dipanggil dari tempat yang
 *  boleh menulis cookie (Server Action / Route Handler). */
export async function ensureGuestToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) return existing;

  const token = randomUUID();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return token;
}
