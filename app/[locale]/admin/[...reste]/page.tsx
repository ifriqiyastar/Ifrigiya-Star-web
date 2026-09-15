import { notFound } from "next/navigation";

/**
 * Le pendant de `app/[locale]/[...reste]/page.tsx` pour le back-office.
 *
 * Il existe pour une seule raison : sans lui, une adresse d'administration
 * erronee serait rattrapee par l'attrape-tout du site public et rendrait la
 * page 404 **marketing** — entete du site vitrine, pied de page, bouton
 * « Telecharger l'app » — a un administrateur egare dans son tableau de bord.
 * Etant plus specifique, ce segment gagne, et `notFound()` remonte a
 * `app/[locale]/admin/not-found.tsx`, rendue dans le chassis d'administration.
 *
 * Il passe par `app/[locale]/admin/layout.tsx`, donc par `requireAdmin()` :
 * un visiteur non administrateur est redirige vers `/connexion` au lieu de
 * decouvrir qu'un back-office existe a cette adresse.
 */
export default function AdminCatchAll() {
  notFound();
}
