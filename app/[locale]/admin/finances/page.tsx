import { redirect } from "next/navigation";

import {
  FINANCE_VUES,
  financePath,
  type FinanceVue,
} from "@/components/admin/finances/pieces";
import { getAdminI18n } from "@/lib/i18n/admin";

/**
 * L'ancienne adresse a onglets.
 *
 * `/admin/finances?vue=abonnements` etait une seule page qui chargeait l'une
 * de trois vues ; ce sont maintenant trois routes, et le rail porte le groupe
 * depliable qui les relie — meme traitement que la moderation et les
 * validations, qui etaient les deux dernieres sections a onglets avant
 * celle-ci.
 *
 * ⚠️ Elle ne peut pas etre supprimee : le tableau de bord pointait encore
 * `?vue=offres` et `?vue=abonnements`, et tout ce qu'un administrateur a pu
 * mettre en favori porte la meme forme. Une redirection coute un aller-retour ;
 * une 404 coute un ecran qu'on ne retrouve pas.
 */
export default async function FinancesIndexPage({
  searchParams,
}: PageProps<"/[locale]/admin/finances">) {
  const i18n = await getAdminI18n();
  const resolved = await searchParams;

  const requested = typeof resolved.vue === "string" ? resolved.vue : undefined;
  const vue: FinanceVue =
    requested && (FINANCE_VUES as readonly string[]).includes(requested)
      ? (requested as FinanceVue)
      : "paiements";

  // `vue` disparait de l'adresse — c'est le chemin, desormais. Le reste suit,
  // sans quoi un lien filtre perdrait son filtre en route.
  const rest = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (key === "vue") continue;
    if (typeof value === "string" && value) rest.set(key, value);
  }
  const query = rest.toString();

  redirect(i18n.path(`${financePath(vue)}${query ? `?${query}` : ""}`));
}
