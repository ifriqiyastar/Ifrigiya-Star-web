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
 * Marqueur pose par le QR code sur l'URL qu'il encode (`?qr=1`), lu par
 * `QrStoreRedirect`. Sans lui, un visiteur qui arrive sur `#telecharger` en
 * faisant defiler la page normalement se ferait rediriger de force des que
 * les URLs ci-dessus existent — ce marqueur reserve la redirection
 * automatique au seul flux "j'ai scanne le QR pour installer l'app".
 */
export const QR_REDIRECT_PARAM = "qr";
