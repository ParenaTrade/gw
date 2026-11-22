import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KUponum — Dijital Kupon Yönetimi",
    template: "%s · KUponum",
  },
  description:
    "Fiziksel İddaa kuponunuzu fotoğraflayın, kontrol edin, onaylayın. Yetkili partner operasyonu ve şeffaf kayıt ile uçtan uca kupon takibi.",
  applicationName: "KUponum",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KUponum",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0f0d",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className={`${spaceGrotesk.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
