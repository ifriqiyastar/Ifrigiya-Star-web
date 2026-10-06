"use server";

import { revalidatePath } from "next/cache";

import { getRequestAdminI18n } from "@/lib/i18n/admin";
import { logAdminAction, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { makeErrors, fail, ok, type ActionResult } from "@/lib/actions/result";

/**
 * Le profil de l'administrateur connecte — nom et telephone, rien d'autre.
 *
 * Ce sont, avec la langue, les seules colonnes de `profiles` qu'un compte peut
 * ecrire lui-meme : la migration mobile 0025 a retire le droit `update` sur la
 * table et ne l'a rendu que colonne par colonne. L'adresse e-mail et le mot de
 * passe ne passent pas par ici mais par Supabase Auth, depuis le navigateur
 * (`components/admin/profile/*`), parce que c'est Auth qui les detient.
 *
 * Toujours `requireAdmin()` et la session de l'admin (`createClient`), jamais
 * `service_role` : l'ecriture porte sur `auth.uid()`, et le RLS de `profiles`
 * a le dernier mot sur « sa propre ligne ».
 */
export async function updateOwnProfile(formData: FormData): Promise<ActionResult> {
  const i18n = await getRequestAdminI18n();
  const admin = await requireAdmin();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName) return fail(i18n.t("Le nom complet est obligatoire."));
  if (fullName.length > 120) return fail(i18n.t("Le nom complet est trop long (120 caracteres au plus)."));
  // Format libre (indicatifs, espaces, tirets) mais borne : le champ finit
  // affiche dans les fiches, pas compose.
  if (phone && !/^[+\d][\d\s().-]{4,31}$/.test(phone)) {
    return fail(i18n.t("Numero de telephone invalide."));
  }

  const supabase = await createClient();
  // `.select("id")` : une ligne filtree par le RLS ne fait pas echouer
  // PostgREST, la mise a jour touche zero ligne et repond « succes ».
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null })
    .eq("id", admin.userId)
    .select("id");
  if (error) return fail(makeErrors(i18n.locale).describeError(error));
  if (!data?.length) {
    return fail(i18n.t("Le profil n'a pas ete mis a jour : la base de donnees a refuse l'operation."));
  }

  await logAdminAction("update_own_profile", "profile", admin.userId);
  // Le nom s'affiche dans le rail et l'en-tete, rendus par le layout.
  revalidatePath("/[locale]/admin", "layout");
  return ok(i18n.t("Profil mis a jour."));
}
