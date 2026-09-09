import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sans cette ligne, Turbopack remonte jusqu'a ~/package-lock.json (hors du
  // depot git) pour deviner la racine du projet et emet un avertissement a
  // chaque build.
  turbopack: { root: import.meta.dirname },

  // Le serveur de dev n'accepte par defaut que l'origine avec laquelle il a
  // ete lance (`localhost`) et bloque les ressources HMR demandees depuis une
  // autre. Ouvrir l'application sur `127.0.0.1:3000` — la meme machine, ecrite
  // autrement — suffisait donc a casser le rechargement a chaud. Reglage de
  // developpement uniquement : il n'a aucun effet sur le build de production.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
