import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// Dua hal yang berubah di Next 16 dan mudah salah:
//   1. `next lint` DIHAPUS — pakai ESLint CLI (`npm run lint` = `eslint .`).
//   2. eslint-config-next sudah flat-config native; JANGAN dibungkus
//      FlatCompat (`compat.extends(...)`) — itu melempar
//      "Converting circular structure to JSON".
const config = [
  ...coreWebVitals,
  ...typescript,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
