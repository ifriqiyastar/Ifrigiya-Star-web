/**
 * Les fiches de store ne sont pas encore publiees (voir le commentaire de
 * tete de `components/site/store-buttons.tsx`) : tant que ces deux variables
 * sont vides, les badges restent des boutons desactives et le QR code du
 * telechargement (`components/site/site-nav.tsx`) ne redirige personne.
 *
 * Le jour ou l'app est publiee, renseigner `NEXT_PUBLIC_APP_STORE_URL` et
 * `NEXT_PUBLIC_PLAY_STORE_URL` suffit a activer les deux a la fois — aucun
 * autre fichier a toucher. `NEXT_PUBLIC_*` est inline au build par Next.js
 * dans tout module qui finit dans le bundle client, y compris celui-ci.
 */
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || null;
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || null;

/**
 * Marqueur pose par le QR code sur l'URL qu'il encode (`?qr=1`), lu par
 * `QrStoreRedirect`. Sans lui, un visiteur qui arrive sur `#telecharger` en
 * faisant defiler la page normalement se ferait rediriger de force des que
 * les URLs ci-dessus existent — ce marqueur reserve la redirection
 * automatique au seul flux "j'ai scanne le QR pour installer l'app".
 */
export const QR_REDIRECT_PARAM = "qr";
