import { redirect } from "next/navigation";

import {
  VALIDATION_VUES,
  validationPath,
  type ValidationVue,
} from "@/components/admin/validations/pieces";
import { getAdminI18n } from "@/lib/i18n/admin";

/**
 * L'ancienne adresse a onglets.
 *
 * `/admin/validations?vue=professionnels` etait une seule page qui chargeait
 * l'une de quatre files ; ce sont maintenant quatre routes, et le rail porte
 * le groupe depliable qui les relie — meme traitement que la moderation.
 *
 * ⚠️ Elle ne peut pas etre supprimee : les liens de la file d'attente
 * (`lib/queries/admin-queue.ts`), le menu du compte et tout ce qu'un
 * administrateur a pu mettre en favori portent encore `?vue=`.
 */
export default async function ValidationsIndexPage({
  searchParams,
}: PageProps<"/[locale]/admin/validations">) {
  const i18n = await getAdminI18n();
  const resolved = await searchParams;

  const requested = typeof resolved.vue === "string" ? resolved.vue : undefined;
  const vue: ValidationVue =
    requested && (VALIDATION_VUES as readonly string[]).includes(requested)
      ? (requested as ValidationVue)
      : "joueurs";

  const rest = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (key === "vue") continue;
    if (typeof value === "string" && value) rest.set(key, value);
  }
  const query = rest.toString();

  redirect(i18n.path(`${validationPath(vue)}${query ? `?${query}` : ""}`));
}
