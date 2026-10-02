import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * LE LOGO, EN UN SEUL ENDROIT.
 *
 * `public/brand/ifriqiya-star.svg` est deja lu par la barre du site public, le
 * pied de page et l'ecran de connexion ; le back-office l'affiche desormais
 * dans l'en-tete du rail, a cote du role dans les deux blocs « compte » et
 * dans l'apercu d'ecran verrouille des notifications. Cinq `<Image>` copies
 * seraient cinq endroits a corriger le jour ou le fichier change de nom.
 *
 * ⚠️ **Pas de `rounded-*` par defaut, et ce n'est pas un oubli** : le fichier
 * porte son propre fond noir deja arrondi. Un arrondi ajoute par-dessus rogne
 * ses angles au lieu de l'encadrer.
 *
 * `alt=""` : partout ou il apparait, le nom ou le role est ecrit juste a cote.
 * Le nommer ici le ferait annoncer deux fois.
 */
export function BrandMark({
  size = 16,
  className,
  priority = false,
}: {
  /** Taille intrinseque demandee a `next/image`. La classe fixe l'affichage. */
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/ifriqiya-star.svg"
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0", className)}
    />
  );
}
