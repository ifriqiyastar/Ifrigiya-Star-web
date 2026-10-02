import type { Locale } from "@/lib/i18n/config";

/**
 * Les captures de l'application mobile, dans `public/app/<langue>/<nom>.png`.
 *
 * ELLES SONT TRADUITES. L'application parle les trois langues du site, et une
 * capture francaise sous un texte arabe ne montre pas le produit que le
 * visiteur telechargera — sur `/ar` elle arrive en plus a contresens du
 * `dir="rtl"` de la page. Il y a donc un jeu complet par langue, aux memes
 * noms de fichier : la langue est un dossier, jamais un suffixe, pour qu'une
 * langue ajoutee soit un dossier a deposer et rien d'autre.
 *
 * Les huit noms decrivent l'ecran, pas la section qui l'affiche : la page
 * choisit ce qu'elle montre ou, et deux sections peuvent montrer le meme
 * ecran sans que le fichier ait a etre duplique.
 *
 * ⚠️ PLAFOND DE NETTETE. Ces captures font 413 px de large **a la source** :
 * elles ont ete prises sur un emulateur en fenetre reduite, pas a la
 * resolution de l'appareil. Au-dela d'environ 205 px CSS, un ecran haute
 * densite reclame plus de pixels qu'il n'en existe et le navigateur
 * interpole — la maquette parait floue, et aucun reglage cote web n'y peut
 * rien. La page les affiche plus grand parce que la mise en page l'exige ;
 * la vraie correction est de **recapturer** :
 *
 *   adb exec-out screencap -p > ecran.png     (Android, ~1080x2400)
 *
 * ou la capture native de l'appareil. Deposez les fichiers dans
 * `public/app/<langue>/` sous les memes noms et mettez a jour les deux
 * constantes ci-dessous : rien d'autre ne bouge.
 */
export const APP_SCREEN_NAMES = [
  "connexion",
  "inscription",
  "fil-actualite",
  "messages",
  "recherche-joueurs",
  "scout-days",
  "scout-day-detail",
  "videos",
] as const;

export type AppScreenName = (typeof APP_SCREEN_NAMES)[number];

export type AppScreen = { src: string; width: number; height: number };

/**
 * Les dimensions natives, communes aux vingt-quatre fichiers — la meme
 * session de capture, le meme appareil. Elles sont donnees a `next/image`
 * pour eviter a la fois la deformation et le saut de mise en page ; le jour
 * ou une langue serait recapturee ailleurs, c'est ici que la table
 * redeviendrait un enregistrement par ecran.
 */
export const APP_SCREEN_WIDTH = 413;
export const APP_SCREEN_HEIGHT = 849;

/** Le rapport de forme des captures, pour les cadres qui se dimensionnent. */
export const APP_SCREEN_ASPECT = `${APP_SCREEN_WIDTH}/${APP_SCREEN_HEIGHT}`;

/** Une capture, dans la langue demandee. */
export function appScreen(locale: Locale, name: AppScreenName): AppScreen {
  return {
    src: `/app/${locale}/${name}.png`,
    width: APP_SCREEN_WIDTH,
    height: APP_SCREEN_HEIGHT,
  };
}

/**
 * Le jeu complet d'une langue, pour les composants qui en designent
 * plusieurs — `APP_SCREENS.messages` plutot que `appScreen(locale, "messages")`
 * repete.
 */
export function appScreens(locale: Locale): Record<AppScreenName, AppScreen> {
  return Object.fromEntries(
    APP_SCREEN_NAMES.map((name) => [name, appScreen(locale, name)]),
  ) as Record<AppScreenName, AppScreen>;
}
