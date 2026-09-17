"use client";

import * as React from "react";

import { useDeviceOs } from "@/lib/use-device-os";
import { APP_STORE_URL, PLAY_STORE_URL, QR_REDIRECT_PARAM } from "@/lib/store-urls";

/**
 * Redirection automatique vers le store, pour le visiteur qui vient de
 * scanner le QR code de l'entete — pas pour celui qui atteint cette section
 * en faisant defiler la page. Les deux flux affichent la meme URL
 * (`#telecharger`), donc c'est le parametre `?qr=1` pose par
 * `components/site/site-nav.tsx` qui les distingue.
 *
 * Ne rend rien : c'est un effet, pas un visuel. Place dans `AppelFinal` (le
 * bloc qui porte `id="telecharger"`), a cote de son propre `<StoreButtons>`.
 *
 * Tant que `NEXT_PUBLIC_APP_STORE_URL` / `NEXT_PUBLIC_PLAY_STORE_URL`
 * (`lib/store-urls.ts`) sont vides, cet effet ne redirige jamais — il n'y a
 * nulle part ou envoyer le visiteur avant que l'app soit publiee.
 */
export function QrStoreRedirect() {
  const os = useDeviceOs();

  React.useEffect(() => {
    const viaQr = new URLSearchParams(window.location.search).get(QR_REDIRECT_PARAM) === "1";
    if (!viaQr) return;

    const url = os === "ios" ? APP_STORE_URL : os === "android" ? PLAY_STORE_URL : null;
    if (!url) return;

    // `replace` plutot que `href` : la page de la marque ne doit pas rester
    // dans l'historique entre l'accueil et le store, ou "precedent" y
    // ramenerait le visiteur juste apres l'avoir quittee.
    window.location.replace(url);
  }, [os]);

  return null;
}
