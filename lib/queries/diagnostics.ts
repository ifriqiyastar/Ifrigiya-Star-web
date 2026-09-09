import type { AdminPermission } from "@/lib/auth";
import { hasServiceRole } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export type Diagnostic = {
  id: string;
  /** Ce qui ne fonctionne pas, dit du point de vue de l'administrateur. */
  title: string;
  /** La consequence concrete, en une phrase. */
  detail: string;
  /** Le nom technique a corriger. Cet ecran est l'exception a la regle
   *  « pas d'identifiant dans la copie » : il existe pour etre corrige. */
  hint?: string;
  tone: "warning" | "danger";
  /**
   * Droit qui rend ce defaut pertinent. Inutile de signaler la plomberie des
   * paiements a un moderateur : il ne peut ni la corriger ni la contourner.
   * Absent = concerne tout le monde.
   */
  permission?: AdminPermission;
};

/**
 * Etat de la configuration du back-office.
 *
 * POURQUOI. Deux defauts d'installation degradent l'application **en
 * silence** : sans les tables de roles, `requirePermission()` laisse tout
 * passer par choix (c'est ce qui permet de tourner sur un projet non migre) ;
 * sans cle de service, la suppression definitive d'un compte echoue au moment
 * du geste. Ni l'un ni l'autre ne se voyait nulle part.
 *
 * ⚠️ **Un reglage optionnel non configure n'est pas un defaut.** Le secret du
 * webhook de paiement (`PAYMENT_WEBHOOK_SECRET`) a ete signale ici un temps :
 * c'est une erreur. Aucun prestataire n'est branche, la route refuse donc tout
 * — ce qui est le comportement sur — et les encaissements s'activent a la main.
 * Alerter en permanence sur une integration pas encore choisie use l'attention
 * et finit par masquer les vrais defauts. N'ajouter ici que ce qui casse un
 * geste que l'ecran propose.
 *
 * Le rail n'affiche ce bloc **que s'il y a quelque chose a signaler** : la
 * liste vide est le cas normal, et elle ne dessine rien.
 */
export async function fetchDiagnostics(
  permissions: AdminPermission[],
): Promise<Diagnostic[]> {
  const issues: Diagnostic[] = [];
  const supabase = await createClient();

  // Referentiel des permissions : absent ou vide, tout administrateur obtient
  // tous les droits. C'est voulu, mais il faut le savoir.
  const { count, error } = await supabase
    .from("admin_permissions")
    .select("id", { count: "exact", head: true });

  if (error) {
    issues.push({
      id: "rbac-missing",
      title: "Roles et permissions non installes",
      detail:
        "Chaque administrateur dispose de tous les droits, y compris les gestes reserves au super administrateur.",
      hint: "202608240001_admin_platform.sql",
      tone: "danger",
    });
  } else if (!count) {
    issues.push({
      id: "rbac-empty",
      title: "Aucune permission enregistree",
      detail:
        "Le referentiel des droits est vide : les ecrans s'ouvrent en entier pour tous les administrateurs.",
      hint: "202608240001_admin_platform.sql",
      tone: "warning",
    });
  }

  if (!hasServiceRole()) {
    issues.push({
      id: "service-key",
      title: "Suppression de compte indisponible",
      detail:
        "Supprimer definitivement un compte demande une cle serveur qui n'est pas configuree. Le geste echouera au moment de l'appliquer.",
      hint: "SUPABASE_SERVICE_ROLE_KEY",
      tone: "warning",
      permission: "users.write",
    });
  }

  const granted = new Set(permissions);
  return issues.filter((issue) => !issue.permission || granted.has(issue.permission));
}
