/**
 * Les adresses des deux fiches de store, lues par `StoreButtons` (quel badge
 * est un vrai lien) et par `QrStoreRedirect` (ou part le telephone qui a
 * scanne le QR de l'entete). Une adresse `null` laisse son badge en bouton
 * desactive qui dit son etat, et n'envoie ce systeme-la nulle part.
 *
 * Etat en octobre 2026 : **Google Play est publie, l'App Store ne l'est pas.**
 * Un iPhone voit donc un badge Apple desactive et le scan du QR le laisse sur
 * la page — le seul etat honnete tant qu'il n'y a nulle part ou l'envoyer.
 *
 * ⚠️ **L'ADRESSE DE GOOGLE PLAY EST ECRITE ICI, PAS SEULEMENT DANS
 * L'ENVIRONNEMENT.** Elle ne l'a d'abord ete que dans `.env`, qui est ignore
 * par git : le deploiement suivant a rebati la page sans elle et remis les
 * deux badges en boutons desactives, EN LIGNE, sans que rien echoue — une
 * variable absente est exactement l'etat « pas encore publie ». Cette adresse
 * est publique et definitive ; la faire dependre d'un reglage de tableau de
 * bord, c'est accepter qu'un deploiement la perde en silence. La variable
 * reste lue en priorite, pour pointer une fiche de test sans toucher au code.
 *
 * `NEXT_PUBLIC_*` est inline au build par Next.js dans tout module qui finit
 * dans le bundle client, celui-ci compris : la poser sans redeployer ne
 * change rien a l'ecran.
 */
/**
 * ⚠️ L'adresse se batit sur l'**identifiant d'application**
 * (`com.ifriqiyastar.app` = `android.package` dans `~/ifriqiyastar/app.json`),
 * jamais sur le nom affiche de l'app. C'est la cle sous laquelle Google
 * adresse la fiche : elle ne change pas quand l'app est renommee, et changer
 * de paquet ferait une autre fiche, sans installations.
 */
const PLAY_STORE_PUBLIE = "https://play.google.com/store/apps/details?id=com.ifriqiyastar.app";

/** Pas de fiche iOS a ce jour : aucun defaut, donc le badge reste desactive. */
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || null;
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || PLAY_STORE_PUBLIE;

/**
 * La fiche a ouvrir pour un systeme donne, `null` s'il n'y en a pas. Partagee
 * par le bouton « Telecharger l'app » de l'entete (dans ses deux emplacements)
 * et par `QrStoreRedirect`, pour qu'ils repondent la meme chose : des tests
 * separes sur les memes deux constantes auraient pu diverger. `StoreButtons`
 * ne s'en sert pas — il montre les DEUX badges sur un ordinateur, et juge donc
 * chaque fiche separement.
 */
export function ficheDuSysteme(os: "inconnu" | "ios" | "android"): string | null {
  if (os === "ios") return APP_STORE_URL;
  if (os === "android") return PLAY_STORE_URL;
  // Systeme inconnu (ordinateur, robot d'indexation) : aucune fiche ne
  // s'impose, c'est au visiteur de choisir parmi les badges.
  return null;
}

/**
 * Ce que le QR code de l'entete doit encoder.
 *
 * Tant qu'**une seule** fiche est publiee, il encode cette fiche DIRECTEMENT :
 * tout telephone capable d'installer l'app est alors du meme systeme, et
 * passer par la page pour la faire rediriger en JavaScript ajoutait une
 * page-relais, une dependance au script et — c'est ce qui a ete signale — un
 * scan qui a l'air de ne « mener qu'au site ».
 *
 * Des que les deux fiches existent, l'indirection redevient necessaire : le
 * QR est imprime une fois pour les deux systemes et seul le telephone qui
 * scanne sait lequel il est. Il encode alors la page, que `QrStoreRedirect`
 * renvoie vers la bonne fiche — d'ou le `?qr=1`, qui distingue ce flux d'un
 * visiteur arrive sur la meme section en faisant defiler la page.
 *
 * Bascule donc toute seule le jour de la publication sur l'App Store, sans
 * rien a decider ici.
 */
export function cibleDuQrCode(urlDeLaPage: string): string {
  if (APP_STORE_URL && PLAY_STORE_URL) return urlDeLaPage;
  return APP_STORE_URL ?? PLAY_STORE_URL ?? urlDeLaPage;
}

/**
 * Marqueur pose par le QR code sur l'URL qu'il encode (`?qr=1`), lu par
 * `QrStoreRedirect`. Sans lui, un visiteur qui arrive sur `#telecharger` en
 * faisant defiler la page normalement se ferait rediriger de force des que
 * les URLs ci-dessus existent — ce marqueur reserve la redirection
 * automatique au seul flux "j'ai scanne le QR pour installer l'app".
 */
export const QR_REDIRECT_PARAM = "qr";
