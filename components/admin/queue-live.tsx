"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";


import { useRouter } from "next/navigation";
import * as React from "react";

import type { NavBadges } from "@/components/admin/nav-items";
import { createClient } from "@/lib/supabase/client";
import type { AdminTask } from "@/lib/queries/admin-queue";

/**
 * Exactement les tables comptees par `fetchAdminQueue()`. Ajouter une file
 * la-bas sans l'ajouter ici — et dans la migration `202609090001` — lui rend
 * la latence du sondage.
 *
 * ⚠️ `posts` et `post_comments` y manquaient depuis que 0089 a ajoute leurs
 * deux files : elles n'avaient donc que le sondage, alors que leurs voisines
 * de moderation remontaient tout de suite. Elles n'ont pas besoin de
 * `202609090001` pour autant — la **migration mobile 0090 les publie deja**
 * dans `supabase_realtime`, pour le fil d'actualite.
 *
 * ⚠️ 0090 les publie **sans `replica identity full`**, et c'est delibere de sa
 * part : un UPDATE peut donc etre ecarte a la reevaluation du RLS, et le
 * passage a « en_attente » n'arrivera qu'au sondage suivant. L'INSERT, lui,
 * passe — c'est-a-dire le cas qui compte, une publication qui vient d'etre
 * deposee. Forcer `full` sur les deux tables les plus ecrites du produit
 * couterait du WAL en continu pour gagner dix secondes sur un compteur ; c'est
 * l'arbitrage que 0026 puis `202609090001` posent explicitement pour
 * `public.messages`, et il vaut ici.
 */
const QUEUE_TABLES = [
  "player_profiles",
  "professional_profiles",
  "professional_documents",
  "identity_verifications",
  "reports",
  "posts",
  "post_comments",
  "scout_days",
  "profiles",
  // ⚠️ Les deux files de finances (oct. 2026) : « inscription a encaisser » et
  // « paiement a confirmer ». L'evenement vient de l'application mobile — un
  // joueur s'inscrit, aucune action du back-office n'est jouee, donc rien ne
  // revalide l'ecran. `202610190001_queue_payments_to_collect.sql` les publie
  // dans `supabase_realtime` ; sans elle l'abonnement reussit et ne livre
  // rien, et la file garde la latence du sondage.
  "scout_day_registrations",
  "payments",
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
  idleIntervalMs = 60_000,
  children,
}: {
  initial: QueueSnapshot;
  /** Le rythme du filet tant que le temps reel n'est pas etabli. */
  intervalMs?: number;
  /** Celui qu'il prend une fois le canal abonne. */
  idleIntervalMs?: number;
  children: React.ReactNode;
}) {
  const i18n = useAdminTranslations();

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
        const response = await fetch(i18n.path("/admin/file-attente"), {
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

    /**
     * Le minuteur du sondage, **reglable**. Il bat a `intervalMs` tant que le
     * temps reel n'est pas etabli, et s'espace a `idleIntervalMs` des que le
     * canal est abonne : les sept tables comptees par la file sont alors
     * publiees (migration 202609090001), donc chaque ecriture reveille la
     * cloche par `onChange` et le sondage n'a plus qu'un role de filet.
     *
     * Ce que cela evite : six allers-retours authentifies par minute et par
     * onglet ouvert, pour des chiffres deja pousses. Ce que cela ne change
     * pas : sans temps reel — variables d'environnement absentes, canal en
     * erreur, abonnement ferme —, le sondage reprend son rythme de dix
     * secondes, et il reste le seul chemin.
     */
    let timer = setInterval(poll, intervalMs);
    const beat = (ms: number) => {
      clearInterval(timer);
      timer = setInterval(poll, ms);
    };

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
        // L'etat de l'abonnement regle le sondage. `SUBSCRIBED` est le seul
        // etat ou le temps reel livre reellement : tant qu'il n'est pas
        // atteint — et des qu'il est perdu — le filet reprend son rythme.
        channel.subscribe((status) => {
          if (cancelled) return;
          beat(status === "SUBSCRIBED" ? idleIntervalMs : intervalMs);
        });
      });
      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      // Pas de temps reel : le sondage reste le seul chemin, et il fonctionne.
    }

    return () => {
      cancelled = true;
      // `timer` a pu etre remplace par `beat()` : on ferme le courant.
      clearInterval(timer);
      if (coalesce) clearTimeout(coalesce);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("focus", poll);
      unsubscribe?.();
    };
  }, [intervalMs, idleIntervalMs, router]);

  return <QueueContext.Provider value={snapshot}>{children}</QueueContext.Provider>;
}
