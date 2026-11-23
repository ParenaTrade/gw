import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM paketleri bundle edilmez, node_modules'dan runtime'da yüklenir.
  serverExternalPackages: ["sharp", "tesseract.js"],
  // Tesseract dil verisi (ocr-data/) dinamik okunur; serverless paketine
  // (Vercel) dahil edilmesi için açıkça izlenir.
  outputFileTracingIncludes: {
    "/api/**/*": ["./ocr-data/**"],
  },
};

export default nextConfig;
