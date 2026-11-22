import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM paketleri bundle edilmez, node_modules'dan runtime'da yüklenir.
  serverExternalPackages: ["sharp", "tesseract.js"],
};

export default nextConfig;
