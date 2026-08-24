import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sans cette ligne, Turbopack remonte jusqu'a ~/package-lock.json (hors du
  // depot git) pour deviner la racine du projet et emet un avertissement a
  // chaque build.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
