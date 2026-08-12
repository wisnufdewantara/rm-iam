import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/dial.css";

// Inter di-host sendiri lewat next/font: tidak ada permintaan ke
// fonts.googleapis saat runtime, jadi lebih cepat dan tanpa render-blocking
// pihak ketiga.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "RM-IAM — Pesan Mandiri",
  description:
    "Pemesanan mandiri rumah makan. Pilih menu dari dial, bayar, lalu pantau pesanan Anda.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        {/*
          Material Symbols TIDAK tersedia di next/font (nol entri "Material" di
          daftar fontnya), jadi tetap lewat <link>. React 19 meng-hoist link
          ber-precedence ini ke <head>.

          display=block disengaja dan melanggar saran lint: untuk ICON font,
          "swap"/"optional" membuat nama ligatur ("ramen_dining") sempat terlihat
          sebagai teks mentah — atau dengan "optional" ikonnya bisa tidak pernah
          muncul sama sekali. Di UI yang isinya lingkaran ikon, itu jauh lebih
          buruk daripada jeda singkat tanpa ikon.
        */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          precedence="default"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
        />
        {children}
      </body>
    </html>
  );
}
