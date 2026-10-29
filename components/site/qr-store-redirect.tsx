"use client";

import * as React from "react";

import { useDeviceOs } from "@/lib/use-device-os";
import { ficheDuSysteme, QR_REDIRECT_PARAM } from "@/lib/store-urls";

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
 * ⚠️ **Dormant tant qu'une seule fiche est publiee.** Dans cet etat le QR
 * encode la fiche elle-meme (`cibleDuQrCode`, `lib/store-urls.ts`) et aucun
 * scan n'arrive plus ici avec `?qr=1` : un relais en JavaScript ne servait
 * qu'a faire passer le visiteur par le site. Cet effet reprend son role le
 * jour ou les deux fiches coexistent — un seul QR, deux systemes possibles,
 * et seul le telephone qui scanne sait lequel il est. Il reste aussi le
 * recours des QR deja imprimes ou partages sous l'ancienne forme.
 *
 * Sans fiche pour le systeme qui scanne, il ne redirige pas : il n'y a nulle
 * part ou envoyer ce visiteur-la.
 */
export function QrStoreRedirect() {
  const os = useDeviceOs();

  React.useEffect(() => {
    const viaQr = new URLSearchParams(window.location.search).get(QR_REDIRECT_PARAM) === "1";
    if (!viaQr) return;

    const url = ficheDuSysteme(os);
    if (!url) return;

    // `replace` plutot que `href` : la page de la marque ne doit pas rester
    // dans l'historique entre l'accueil et le store, ou "precedent" y
    // ramenerait le visiteur juste apres l'avoir quittee.
    window.location.replace(url);
  }, [os]);

  return null;
}
