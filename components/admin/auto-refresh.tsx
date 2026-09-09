"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Rafraichit une page serveur a intervalle regulier. **Monte une seule fois
 * par le layout du back-office**, donc actif sur tous les ecrans.
 *
 * Les files du back-office se remplissent depuis l'application mobile : un
 * signalement arrive sans qu'aucune action n'ait eu lieu ici, donc sans
 * `revalidatePath`. Sans cela, un moderateur qui laisse l'ecran ouvert ne voit
 * jamais rien arriver.
 *
 * Complementaire de `AdminQueueProvider` et non redondant : celui-ci maintient
 * les compteurs (cloche et pastilles) a jour toutes les dix secondes pour le
 * cout d'une seule requete JSON, pendant que celui-la rejoue les requetes de
 * l'ecran affiche — plus cher, donc plus espace. Sans les deux, la pastille
 * annonce un signalement que la liste en dessous ne montre pas.
 *
 * `router.refresh()` **rejoue le Server Component** et remplace l'arbre sans
 * rechargement : l'etat client (dialogue ouvert, champ en cours de saisie) est
 * conserve, contrairement a un `location.reload()`.
 *
 * Trois garde-fous, et le troisieme est le plus important :
 *
 *  * rien ne se declenche quand l'onglet est masque — inutile de requeter en
 *    boucle un ecran que personne ne regarde ;
 *  * le retour au premier plan rafraichit tout de suite, moment ou la donnee
 *    affichee est justement la plus perimee ;
 *  * **rien ne se declenche pendant qu'on travaille** : un dialogue ouvert ou
 *    un champ en cours de saisie signifie qu'une decision est en train de se
 *    prendre. Remplacer l'arbre a cet instant fait vaciller la modale (dont le
 *    contenu est rendu par le serveur) et peut effacer une saisie. Le
 *    rafraichissement est simplement reporte au tick suivant.
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  React.useEffect(() => {
    /** Une decision est en cours : on ne touche a rien. */
    const busy = () => {
      // Un menu ouvert compte aussi : la cloche se reorganiserait sous le
      // curseur pendant que l'on vise une ligne.
      if (document.querySelector('[role="dialog"], [data-slot="dropdown-menu-content"]'))
        return true;
      const tag = document.activeElement?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const tick = () => {
      if (document.visibilityState !== "visible" || busy()) return;
      router.refresh();
    };

    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);

  return null;
}
