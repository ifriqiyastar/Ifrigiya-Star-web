"use client";

import * as React from "react";
import { IdCardIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * L'apercu d'un compte, a cote de son nom — la coquille, rien d'autre.
 *
 * POURQUOI, ET POURQUOI PAS A LA PLACE DU LIEN. Dans une file qu'on parcourt
 * — des encaissements a saisir, des contenus a moderer — la question posee
 * n'est pas « ouvre-moi ce compte » mais « qui est-ce, et le compte est-il
 * sain ? ». Y repondre coutait de quitter l'ecran et d'y revenir, en perdant
 * sa place. L'apercu y repond sur place.
 *
 * ⚠️ IL S'AJOUTE AU LIEN, IL NE LE REMPLACE PAS. `/admin/utilisateurs/{id}`
 * n'est pas un fait, c'est une destination : onglets, suspension,
 * reactivation, suppression, justificatifs, historique. Detourner le clic du
 * nom vers une modale aurait coute le clic du milieu, l'ouverture dans un
 * onglet et le bouton Precedent — trois gestes qu'un administrateur qui
 * traite une file utilise reellement — et aurait fait dire au nom deux choses
 * differentes selon l'ecran, le lien etant pose a dix-neuf endroits. Le nom
 * reste donc un lien ; l'apercu est un **second declencheur, frere du lien**,
 * jamais imbrique dedans (un bouton dans un lien n'est ni du HTML valide ni
 * cliquable comme on l'attend).
 *
 * ⚠️ RIEN N'EST REQUETE, NI ICI NI PAR L'APPELANT. Le contenu arrive en
 * `children`, **deja rendu par le serveur** (c'est un slot, pas une fonction),
 * et il est bati a partir des seuls champs que `fetchProfilesByIds()` charge
 * deja pour afficher le nom et la vignette. L'apercu ne coute donc **aucun
 * aller-retour supplementaire** — c'est la condition a laquelle il est
 * acceptable sur chaque ligne de chaque liste. Tout ce qui depasse ces champs
 * (statut du profil metier, justificatifs, historique des paiements) reste sur
 * la fiche : une vague par ligne de chaque liste, pour une modale ouverte une
 * fois sur cinquante, se paierait sur tous les ecrans.
 *
 * Les libelles arrivent en props : ce composant n'a pas de dictionnaire a lui,
 * l'appelant est un composant serveur qui a deja le sien.
 */
export function ProfilePreviewDialog({
  label,
  title,
  description,
  className,
  children,
}: {
  /** Nom accessible du declencheur — il n'affiche qu'une icone. */
  label: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Stylise directement, pas un `Button` compose via `render` : deux
          composants qui posent chacun leur `data-slot` ne se fusionnent pas de
          la meme facon au rendu serveur et au rendu client, ce qui casse
          l'hydratation de la page entiere (trap deja paye sur `DetailDialog`
          et `ScoutDayDialog`). */}
      {/* ⚠️ BORDURE VISIBLE, PAS `ghost` (retour client : « on doit comprendre
          que c'est un bouton »). Sans bordure ni fond, une icone sourde posee
          a cote d'un nom se lit comme une decoration — rien n'annoncait qu'on
          pouvait cliquer. La variante `outline` est celle de tous les autres
          declencheurs de modale du back-office (« Dossier », « Apercu »), donc
          le geste se reconnait d'un ecran a l'autre.

          Pas de libelle a cote de l'icone pour autant : il s'ajouterait a
          chaque ligne de chaque liste, et la colonne du compte porte deja un
          nom, un e-mail et une vignette. Le nom accessible passe par
          `aria-label`, et `title` le rend en infobulle. */}
      <DialogTrigger
        aria-label={label}
        title={label}
        className={cn(buttonVariants({ variant: "outline", size: "icon-xs" }), "shrink-0", className)}
      >
        <IdCardIcon />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-4 py-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
