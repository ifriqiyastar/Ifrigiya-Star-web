"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import type { NavBadges } from "@/components/admin/nav-items";
import { createClient } from "@/lib/supabase/client";
import type { AdminTask } from "@/lib/queries/admin-queue";

/**
 * Exactement les tables comptees par `fetchAdminQueue()`. Ajouter une file
 * la-bas sans l'ajouter ici — et dans la migration `202609090001` — lui rend
 * la latence du sondage.
 */
const QUEUE_TABLES = [
  "player_profiles",
  "professional_profiles",
  "professional_documents",
  "identity_verifications",
  "reports",
  "scout_days",
  "profiles",
] as const;

export type QueueSnapshot = { tasks: AdminTask[]; badges: NavBadges };

/**
 * Etat vivant des files d'attente de l'administration.
 *
 * La cloche du bandeau et les pastilles du rail sont rendues par le layout,
 * donc figees au moment ou la page a ete servie : un dossier depose depuis
 * l'application mobile n'apparaissait qu'au rechargement suivant. Le layout
 * continue de faire la lecture initiale — l'ecran est juste des le premier
 * rendu, sans clignotement — et ce fournisseur la reactualise ensuite tout
 * seul depuis `/admin/file-attente`.
 *
 * Deux mecanismes, et le second ne remplace pas le premier :
 *
 *  * **Le temps reel** (`postgres_changes` sur les sept tables comptees) est ce
 *    qui rend l'affichage immediat : Postgres pousse l'evenement, on recompte
 *    dans la foulee. De l'ecriture mobile a la pastille, il reste un aller-
 *    retour reseau, donc quelques centaines de millisecondes — pas dix
 *    secondes. La charge utile de l'evenement est **ignoree** : elle ne sert
 *    qu'a declencher le recomptage, jamais a afficher une ligne. Le RLS decide
 *    de ce qui est pousse, et `fetchAdminQueue()` refiltre par permission.
 *
 *  * **Le sondage** reste, a dix secondes, et c'est deliberé. Un abonnement
 *    `postgres_changes` sur une table absente de la publication
 *    `supabase_realtime` **reussit** et ne livre jamais rien : il n'y a aucune
 *    erreur a observer. Tant que la migration `202609090001` n'est pas
 *    appliquee, le temps reel est donc muet sans le dire — supprimer le
 *    sondage en s'y fiant rendrait la cloche plus lente, pas plus rapide. Le
 *    sondage est le plancher ; le temps reel est ce qui passe devant.
 *
 * Deux garde-fous, repris de `AutoRefresh` :
 *
 *  * onglet masque = aucune requete, et le retour au premier plan rafraichit
 *    immediatement, moment ou l'affichage est justement le plus perime ;
 *  * **rien ne bouge pendant qu'une decision se prend** : si la cloche est
 *    ouverte ou qu'un dialogue est affiche, la liste ne doit pas se reorganiser
 *    sous le curseur — on reporte au tick suivant.
 *
 * Ce n'est pas un remplacement de `revalidatePath` : apres une action serveur,
 * le layout est rejoue et `initial` change, ce que l'effet de resynchronisation
 * ci-dessous prend en compte. Les deux chemins convergent donc vers le meme
 * chiffre.
 */
const QueueContext = React.createContext<QueueSnapshot | null>(null);

export function useAdminQueue(): QueueSnapshot {
  const snapshot = React.useContext(QueueContext);
  if (!snapshot) {
    throw new Error("useAdminQueue doit etre utilise dans un AdminQueueProvider.");
  }
  return snapshot;
}

export function AdminQueueProvider({
  initial,
  intervalMs = 10_000,
  children,
}: {
  initial: QueueSnapshot;
  intervalMs?: number;
  children: React.ReactNode;
}) {
  // `live` ne porte que le resultat des interrogations ; l'instantane du
  // serveur reste la valeur par defaut. Quand le layout est rejoue
  // (revalidatePath apres une action), sa lecture est plus fraiche que la
  // notre : on jette la notre et il reprend la main. L'ajustement se fait
  // pendant le rendu, pas dans un effet — c'est le motif React pour
  // reinitialiser un etat sur changement de prop, et il evite un rendu en
  // cascade. La comparaison porte sur le contenu : une nouvelle reference
  // d'objet identique ne doit pas ecraser une interrogation plus recente.
  const [live, setLive] = React.useState<QueueSnapshot | null>(null);
  const serialized = JSON.stringify(initial);
  const [seen, setSeen] = React.useState(serialized);
  if (seen !== serialized) {
    setSeen(serialized);
    setLive(null);
  }
  const snapshot = live ?? initial;

  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;

    /** Une decision est en cours : la liste ne doit pas bouger. */
    const busy = () =>
      document.querySelector('[data-slot="dropdown-menu-content"], [role="dialog"]') !== null;

    const poll = async () => {
      if (document.visibilityState !== "visible" || busy()) return;
      try {
        const response = await fetch("/admin/file-attente", {
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        // Session expiree : la garde renvoie vers /connexion, donc du HTML.
        // On garde le dernier etat connu plutot que d'ecraser la liste avec
        // une page de connexion mal interpretee.
        if (!response.ok) return;
        if (!response.headers.get("content-type")?.includes("application/json")) return;
        const data = (await response.json()) as QueueSnapshot;
        if (!cancelled && Array.isArray(data.tasks)) setLive(data);
      } catch {
        // Hors ligne ou requete interrompue : rien a signaler, on retentera.
      }
    };

    // Une lecture des le montage : apres une navigation client, l'arbre rendu
    // peut venir du cache du routeur et donc dater de plusieurs minutes.
    void poll();
    const timer = setInterval(poll, intervalMs);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("focus", poll);

    // Une rafale d'ecritures (un lot valide cote mobile) ne doit pas declencher
    // une rafale de recomptages : on regroupe ce qui arrive dans le meme
    // battement, et on ne rejoue la page qu'une fois toutes les deux secondes.
    let coalesce: ReturnType<typeof setTimeout> | undefined;
    let lastRefresh = 0;
    const onChange = () => {
      if (coalesce) clearTimeout(coalesce);
      coalesce = setTimeout(() => {
        void poll();
        // Le layout monte `AutoRefresh` pour l'ecran affiche, mais a trente
        // secondes : sur evenement, la liste sous la pastille doit suivre tout
        // de suite, sinon les deux se contredisent a l'ecran.
        const now = performance.now();
        if (!busy() && now - lastRefresh > 2_000) {
          lastRefresh = now;
          router.refresh();
        }
      }, 150);
    };

    // Le client navigateur lit la session dans les cookies ; sans variables
    // d'environnement il leve, et le sondage suffit alors.
    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = createClient();
      const channel = supabase.channel("admin-queue");
      for (const table of QUEUE_TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
      }
      // Realtime reevalue le RLS de chaque table **avec le jeton de l'abonne**
      // avant de lui transmettre quoi que ce soit. Or la session est lue dans
      // les cookies, donc de maniere asynchrone : rejoindre le canal tout de
      // suite le fait rejoindre en anonyme, et aucune ligne que seul
      // `public.is_admin()` autorise ne passe alors — un abonnement en
      // apparence sain qui ne livre rien, exactement le defaut que le sondage
      // est la pour couvrir. On attend donc le jeton avant de rejoindre.
      void supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        if (data.session) supabase.realtime.setAuth(data.session.access_token);
        channel.subscribe();
      });
      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      // Pas de temps reel : le sondage reste le seul chemin, et il fonctionne.
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (coalesce) clearTimeout(coalesce);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("focus", poll);
      unsubscribe?.();
    };
  }, [intervalMs, router]);

  return <QueueContext.Provider value={snapshot}>{children}</QueueContext.Provider>;
}
