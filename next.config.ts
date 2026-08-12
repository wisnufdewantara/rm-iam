import type { NextConfig } from "next";

// Turbopack sudah default di Next 16 — tidak perlu flag apa pun.
// cacheComponents SENGAJA tidak diaktifkan: menu & pesanan harus selalu segar,
// dan superuser mengubah menu tanpa deploy (PRD uji 37).
const nextConfig: NextConfig = {};

export default nextConfig;
