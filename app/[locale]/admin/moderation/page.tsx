import { redirect } from "next/navigation";

import { getAdminI18n } from "@/lib/i18n/admin";
import { MODERATION_VUES, vuePath, type Vue } from "@/components/admin/moderation/pieces";

/**
 * L'ancienne adresse a onglets.
 *
 * `/admin/moderation?vue=publications` etait une seule page qui chargeait
 * l'une de quatre vues ; ce sont maintenant quatre routes. Cette page ne
 * rend rien : elle traduit l'ancienne adresse vers la nouvelle, en gardant
 * les autres parametres.
 *
 * ⚠️ **Elle ne peut pas etre supprimee.** Les liens de la file d'attente
 * (`lib/queries/admin-queue.ts`), ceux du tableau de bord et tout ce qu'un
 * administrateur a pu mettre en favori portent encore `?vue=`. Une redirection
 * coute un aller-retour ; une 404 coute un dossier qu'on ne retrouve pas.
 */
export default async function ModerationIndexPage({
  searchParams,
}: PageProps<"/[locale]/admin/moderation">) {
  const i18n = await getAdminI18n();
  const resolved = await searchParams;

  const requested = typeof resolved.vue === "string" ? resolved.vue : undefined;
  const vue: Vue =
    requested && (MODERATION_VUES as readonly string[]).includes(requested)
      ? (requested as Vue)
      : "signalements";

  // `vue` disparait de l'adresse — c'est le chemin, desormais. Le reste suit,
  // sans quoi un lien « publications en attente de validation » perdrait son
  // filtre en route.
  const rest = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (key === "vue") continue;
    if (typeof value === "string" && value) rest.set(key, value);
  }
  const query = rest.toString();

  redirect(i18n.path(`${vuePath(vue)}${query ? `?${query}` : ""}`));
}
