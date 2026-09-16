"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

/**
 * Les deux boutons de store, et la regle qui decide lequel montrer.
 *
 * Sur un telephone, une seule des deux fiches est installable : proposer les
 * deux oblige le visiteur a choisir a la place de son systeme. On n'affiche
 * donc que l'App Store sur iOS et que Google Play sur Android. Partout
 * ailleurs — ordinateur, robot d'indexation, navigateur qui ne dit rien de
 * lui — les deux restent visibles : c'est le seul etat honnete quand la
 * plateforme est inconnue, et c'est aussi ce que voit un moteur de recherche.
 *
 * La detection est **volontairement cliente**. La lire depuis l'en-tete
 * `user-agent` cote serveur serait sans scintillement, mais `headers()` rend
 * la page dynamique : la page d'accueil est pre-rendue pour les trois langues
 * (cf. `generateStaticParams` dans `app/[locale]/layout.tsx`) et elle ne le
 * resterait pas. Le rendu serveur montre donc les deux boutons, et le montage
 * en retire un — ce qui se voit d'autant moins que le bloc hote arrive
 * lui-meme en fondu (`Reveal`), et que sans JavaScript les deux doivent de
 * toute facon rester la.
 */
type Os = "inconnu" | "ios" | "android";

function detecterOs(): Os {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipod|ipad/i.test(ua)) return "ios";
  // Depuis iPadOS 13 un iPad se declare « Macintosh » et rien dans la chaine
  // ne le distingue d'un Mac : seul le nombre de points de contact le fait.
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  return "inconnu";
}

/** L'UA ne bouge pas : il n'y a rien a observer, donc rien a desabonner. */
const sAbonner = () => () => {};
const snapshotServeur = (): Os => "inconnu";

export type StoreButtonsProps = {
  appleStore: string;
  applePrefix: string;
  googleStore: string;
  googlePrefix: string;
  /** Infobulle « pas encore publie » — traduite, comme le reste du bouton. */
  soon: string;
  /**
   * `sombre` sur un fond clair (le pave lime de l'appel final), `clair` sur la
   * video du hero, ou un bouton noir sur fond noir ne se verrait pas.
   */
  tone?: "sombre" | "clair";
  className?: string;
};

export function StoreButtons({
  appleStore,
  applePrefix,
  googleStore,
  googlePrefix,
  soon,
  tone = "sombre",
  className,
}: StoreButtonsProps) {
  // `useSyncExternalStore` plutot qu'un `useState` pose dans un effet : le
  // systeme d'exploitation est une donnee exterieure a React, elle ne change
  // jamais pendant la visite (d'ou l'abonnement vide), et c'est l'API qui
  // laisse le rendu serveur repondre autre chose que le client sans que
  // l'hydratation le signale comme une divergence.
  const os = useSyncExternalStore(sAbonner, detecterOs, snapshotServeur);

  return (
    <div className={cn("flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap", className)}>
      {os !== "android" ? (
        <StoreButton store={appleStore} prefix={applePrefix} soon={soon} tone={tone} icon={<AppleMark />} />
      ) : null}
      {os !== "ios" ? (
        <StoreButton store={googleStore} prefix={googlePrefix} soon={soon} tone={tone} icon={<PlayMark />} />
      ) : null}
    </div>
  );
}

/**
 * Marque Apple. Un seul trace, en `currentColor` : le bouton est noir, le
 * logo blanc, et il suivra la couleur du texte si le bouton change.
 */
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden focusable="false">
      <path d="M17.564 12.928c-.026-2.66 2.17-3.938 2.27-4.002-1.236-1.81-3.16-2.058-3.844-2.086-1.637-.166-3.196.964-4.026.964-.83 0-2.11-.94-3.472-.914-1.786.026-3.432 1.038-4.35 2.638-1.854 3.216-.474 7.976 1.33 10.584.88 1.276 1.93 2.71 3.308 2.658 1.328-.054 1.83-.86 3.436-.86 1.606 0 2.058.86 3.462.832 1.43-.026 2.334-1.3 3.208-2.582 1.012-1.48 1.428-2.914 1.454-2.988-.032-.014-2.79-1.07-2.816-4.244zM15.03 4.62c.732-.888 1.226-2.124 1.09-3.354-1.054.042-2.332.702-3.088 1.588-.678.786-1.272 2.044-1.112 3.25 1.176.09 2.378-.598 3.11-1.484z" />
    </svg>
  );
}

/**
 * Marque Google Play : quatre facettes, quatre couleurs. Elle garde ses
 * couleurs propres — c'est ainsi qu'elle est reconnaissable, et la charte
 * d'Ifriqiya Star ne s'applique pas a la marque d'un tiers.
 */
function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden focusable="false">
      <path fill="#00D2FF" d="M3.06 1.34A1.5 1.5 0 0 0 2.62 2.4v19.2c0 .4.16.78.44 1.06l.07.06L13.8 12.1v-.2L3.13 1.28l-.07.06z" />
      <path fill="#FFC900" d="M17.36 15.7 13.8 12.1v-.2l3.56-3.6.08.05 4.22 2.4c1.2.68 1.2 1.8 0 2.5l-4.22 2.4-.08.05z" />
      <path fill="#FF3B44" d="m17.44 15.65-3.64-3.65L3.06 22.66c.4.42 1.05.47 1.78.06l12.6-7.07z" />
      <path fill="#00E676" d="M17.44 8.35 4.84 1.28C4.11.87 3.46.92 3.06 1.34L13.8 12l3.64-3.65z" />
    </svg>
  );
}

/**
 * Un bouton de store. Il ne pointe nulle part tant que les fiches ne sont pas
 * publiees : un lien mort vaut mieux qu'un lien qui promet un telechargement
 * inexistant, donc c'est un bouton desactive et il le dit.
 *
 * ⚠️ Les marques Apple et Google Play sont ici **redessinees**. Avant la mise
 * en ligne, Apple et Google exigent l'un et l'autre leurs **fichiers de badge
 * officiels** (« Telecharger dans l'App Store », « Disponible sur Google
 * Play »), telechargeables depuis leurs pages de ressources marketing, avec
 * leurs regles de taille et de zone de protection. C'est un remplacement de
 * fichier, pas une refonte.
 */
function StoreButton({
  store,
  prefix,
  icon,
  soon,
  tone,
}: {
  store: string;
  prefix: string;
  icon: React.ReactNode;
  soon: string;
  tone: "sombre" | "clair";
}) {
  return (
    <span
      aria-disabled
      title={soon}
      className={cn(
        "inline-flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl px-5 py-3.5 text-(--site-fg) sm:w-auto sm:justify-start",
        tone === "sombre"
          ? "bg-(--site-ink)"
          : "border border-white/30 bg-black/35 backdrop-blur-sm",
      )}
    >
      {icon}
      <span className="text-left leading-tight">
        {/* Deux corrections de lisibilite successives sur ces deux lignes.
            D'abord la couleur : `opacity-90` sur le bouton et `opacity-70`
            ici se multipliaient en 63 % de blanc, sur des capitales de 10 px.
            Puis la coupure : elle tombait **apres l'apostrophe**
            (« Telecharger sur l' » / « App Store »), et une ligne qui se
            termine par une apostrophe orpheline ne se lit pas. Le determinant
            reste desormais colle a ce qu'il determine. */}
        <span className="block text-xs whitespace-nowrap text-(--site-muted)">{prefix}</span>
        <span className="font-heading block text-base leading-tight font-extrabold whitespace-nowrap text-white">
          {store}
        </span>
      </span>
    </span>
  );
}
