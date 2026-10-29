/**
 * Les deux fiches de store, chacune derriere sa variable. Une variable vide
 * laisse son badge en bouton desactive (voir le commentaire de tete de
 * `components/site/store-buttons.tsx`) et interdit au QR code du
 * telechargement (`components/site/site-nav.tsx`) de rediriger le telephone
 * de ce systeme-la ; une variable renseignee active les deux a la fois, sans
 * autre fichier a toucher. `NEXT_PUBLIC_*` est inline au build par Next.js
 * dans tout module qui finit dans le bundle client, y compris celui-ci.
 *
 * Etat en octobre 2026 : **Google Play est publie**, l'App Store ne l'est pas
 * encore. Un iPhone voit donc un badge Apple desactive, et le scan du QR le
 * laisse sur la page — ce qui est le seul etat honnete tant qu'il n'y a nulle
 * part ou l'envoyer.
 *
 * ⚠️ L'URL de Google Play est batie sur l'**identifiant d'application**
 * (`com.ifriqiyastar.app` — `android.package` / `ios.bundleIdentifier` dans
 * `~/ifriqiyastar/app.json`), pas sur le nom affiche de l'app. C'est la cle
 * de la fiche chez Google : elle ne change jamais, et renommer l'app ne la
 * renomme pas.
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
