import "server-only";

import { headers } from "next/headers";

/**
 * Detection cote serveur d'un telephone, a partir du user-agent de la
 * requete — le pendant serveur de `useDeviceOs()` (`lib/use-device-os.ts`),
 * qui lit le meme indice mais cote client. Volontairement pas cote client ici
 * : la pagination du blog doit decider sa taille de page *avant* le premier
 * rendu (elle change le nombre de lignes que la requete Supabase ramene), pas
 * apres coup comme le badge de store qui bascule sans reflux de donnees.
 *
 * Meme limite que `useDeviceOs()`, assumee pour la meme raison : une fenetre
 * de bureau retrecie reste comptee comme "ordinateur", puisque rien dans la
 * requete ne dit la largeur reelle de la fenetre — seulement l'appareil qui
 * l'a envoyee. La page reste `force-dynamic` (`app/[locale]/blog/page.tsx`),
 * donc lire `headers()` ici ne coute pas de rendu statique qui existerait
 * sinon.
 */
export async function isMobileRequest(): Promise<boolean> {
  const userAgent = (await headers()).get("user-agent") ?? "";
  // Contrairement a `detecterOs()`, un iPad n'est pas compte ici : depuis
  // iPadOS 13 il se declare "Macintosh" dans le user-agent, et seul
  // `navigator.maxTouchPoints` (cote client uniquement) le distingue d'un
  // vrai Mac. Un iPad recoit donc la pagination "ordinateur" — raisonnable,
  // il a la largeur d'ecran pour l'afficher.
  return /android|iphone|ipod/i.test(userAgent);
}
