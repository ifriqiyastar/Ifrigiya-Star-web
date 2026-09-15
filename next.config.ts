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

  experimental: {
    // Sert `app/global-not-found.tsx` pour toute adresse qui ne correspond a
    // aucune route. Sans ce drapeau le fichier est ignore, et la racine de ce
    // depot etant un segment dynamique (`app/[locale]/layout.tsx`), Next n'a
    // aucune mise en page ou composer une 404 globale : il rendait un
    // document d'erreur nu, au corps vide cote serveur. Voir l'en-tete de
    // `app/global-not-found.tsx`.
    globalNotFound: true,
  },
};

export default nextConfig;
