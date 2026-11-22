import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KUponum — Dijital Kupon Yönetimi",
    short_name: "KUponum",
    description:
      "Fiziksel kuponunuzu fotoğraflayın, onaylayın, yetkili partner operasyonuyla takip edin.",
    start_url: "/kuponum",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0f0d",
    theme_color: "#0a0f0d",
    lang: "tr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
