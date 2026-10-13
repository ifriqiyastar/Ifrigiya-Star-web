"use client";

import * as React from "react";

/**
 * Amene l'element qui le contient dans la partie visible de son conteneur
 * defilant, une fois, au montage.
 *
 * Pose dans l'onglet actif de `SegmentedNav`. Sous `sm`, la barre d'onglets
 * defile horizontalement et n'en montre que deux sur quatre : elle se rend
 * toujours depuis le debut, donc arriver sur « Abonnements & paiements »
 * affichait une barre ou l'onglet actif etait hors champ — rien n'indiquait
 * plus ou l'on se trouvait.
 *
 * ⚠️ `block: "nearest"` autant que `inline: "nearest"` : sans le premier, le
 * navigateur fait aussi defiler la **page** verticalement pour centrer la
 * barre, et l'ecran sautait a chaque changement d'onglet. Avec « nearest »,
 * un element deja visible ne declenche aucun defilement du tout.
 *
 * Un `<span>` vide plutot qu'un `ref` sur le lien lui-meme : `SegmentedNav`
 * est un composant serveur et ne peut pas porter de `ref`, et ses `segments`
 * transportent des composants d'icone, qui ne traversent pas la frontiere
 * serveur/client — en faire un composant client changerait son API.
 */
export function ScrollIntoView() {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    ref.current?.parentElement?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  return <span ref={ref} aria-hidden className="sr-only" />;
}
