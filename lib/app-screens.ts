/**
 * Dimensions natives des captures de l'application, dans `public/app/`.
 *
 * Elles ne sont pas toutes identiques (426x863 ou 420x864 selon l'appareil
 * qui a servi a la capture) : donner a `next/image` la vraie taille evite
 * a la fois la deformation et le saut de mise en page.
 *
 * ⚠️ PLAFOND DE NETTETE. Ces captures font 426 px de large **a la source** :
 * elles ont ete prises sur un emulateur en fenetre reduite, pas a la
 * resolution de l'appareil. Au-dela d'environ 215 px CSS, un ecran haute
 * densite reclame plus de pixels qu'il n'en existe et le navigateur
 * interpole — la maquette parait floue, et aucun reglage cote web n'y peut
 * rien. La page les affiche plus grand parce que la mise en page l'exige ;
 * la vraie correction est de **recapturer** :
 *
 *   adb exec-out screencap -p > ecran.png     (Android, ~1080x2400)
 *
 * ou la capture native de l'appareil. Deposez les fichiers dans `public/app/`
 * sous les memes noms et mettez a jour les dimensions ci-dessous : rien
 * d'autre ne bouge.
 */
export const APP_SCREENS = {
  "connexion": { src: "/app/connexion.png", width: 426, height: 863 },
  "eligibilite": { src: "/app/eligibilite.png", width: 420, height: 864 },
  "inscription": { src: "/app/inscription.png", width: 426, height: 863 },
  "fil-actualite": { src: "/app/fil-actualite.png", width: 426, height: 863 },
  "messages": { src: "/app/messages.png", width: 426, height: 863 },
  "photos": { src: "/app/photos.png", width: 426, height: 863 },
  "profil-joueur": { src: "/app/profil-joueur.png", width: 426, height: 863 },
  "recherche-joueurs": { src: "/app/recherche-joueurs.png", width: 426, height: 863 },
  "scout-day-detail": { src: "/app/scout-day-detail.png", width: 420, height: 864 },
  "videos": { src: "/app/videos.png", width: 426, height: 863 },
} as const;

export type AppScreen = (typeof APP_SCREENS)[keyof typeof APP_SCREENS];
