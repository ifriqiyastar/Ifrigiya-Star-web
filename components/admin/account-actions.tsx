import { getAdminI18n } from "@/lib/i18n/admin";
import { BanIcon, CheckIcon, EyeIcon, EyeOffIcon, Trash2Icon, Undo2Icon, XIcon } from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { suspendUser } from "@/lib/actions/moderation";
import {
  deleteAccount,
  liftSuspension,
  setAccountActive,
  setPlayerStatus,
  setPlayerVisibility,
  setProfessionalStatus,
} from "@/lib/actions/users";
import { hasServiceRole } from "@/lib/supabase/service";

/**
 * Barre d'actions d'un compte : les gestes du §12.1 (validation, suspension,
 * reactivation, suppression) plus la visibilite du profil joueur.
 *
 * Les actions proposees dependent du statut courant : on n'offre pas de
 * valider un compte deja valide, ni de reactiver un compte actif.
 */
/**
 * ⚠️ Ce composant est un **Server Component** : il n'a pas de `"use client"`,
 * et il passe des actions a `ReasonDialog` / `ActionButton`, qui sont clients.
 * Toute action doit donc etre une Server Action **liee** (`action.bind(null,
 * …)`), jamais une fleche : une fermeture ecrite ici ne traverse pas la
 * frontiere, et React refuse le rendu avec « Functions cannot be passed
 * directly to Client Components ».
 */
export async function AccountActions({
  profileId,
  role,
  isActive,
  businessStatus,
  isVisible,
  self,
}: {
  profileId: string;
  role: string;
  isActive: boolean;
  businessStatus: string | null;
  isVisible: boolean | null;
  /** L'administrateur consulte sa propre fiche. */
  self: boolean;
}) {
  const i18n = await getAdminI18n();

  const isPlayer = role === "player";
  const isProfessional = role === "professional";
  const setStatus = isPlayer ? setPlayerStatus : setProfessionalStatus;
  const canSetStatus = isPlayer || isProfessional;
  const isSuspended = businessStatus === "suspendu";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canSetStatus && businessStatus !== "valide" ? (
        <ActionButton
          action={setStatus.bind(null, profileId, "valide", undefined)}
          variant="default"
          size="sm"
        >
          <CheckIcon />
          {i18n.t("Valider le compte")}</ActionButton>
      ) : null}

      {canSetStatus && businessStatus !== "refuse" ? (
        <ReasonDialog
          action={setStatus.bind(null, profileId, "refuse")}
          trigger={
            <Button variant="outline" size="sm">
              <XIcon />
              {i18n.t("Refuser")}</Button>
          }
          title={i18n.t("Refuser ce compte")}
          description={i18n.t("Le motif est enregistre sur le compte et explique la decision a l'utilisateur.")}
          submitLabel={i18n.t("Refuser")}
        />
      ) : null}

      {isPlayer && isVisible !== null ? (
        <ActionButton
          action={setPlayerVisibility.bind(null, profileId, !isVisible)}
          size="sm"
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
          {isVisible ? i18n.t("Retirer de la recherche") : i18n.t("Rendre visible")}
        </ActionButton>
      ) : null}

      {/* Trois etats, trois gestes, et un seul affiche a la fois.

          « Suspendu » se lit sur le **profil metier**, pas sur `is_active` :
          c'est `status = 'suspendu'` que l'application mobile refuse a la
          connexion. Un compte peut donc etre suspendu tout en restant actif,
          si le statut a ete pose sans passer par la RPC — d'ou la condition
          sur `businessStatus` et non sur `isActive` seul. */}
      {isSuspended ? (
        <ActionButton
          action={liftSuspension.bind(null, profileId)}
          variant="default"
          size="sm"
          confirm={{
            title: i18n.t("Lever la suspension"),
            description:
              i18n.t("Le compte redevient actif et son profil metier repasse a « valide » : l'utilisateur retrouve l'acces a l'application immediatement, et recoit une notification lui annoncant que son profil est valide. Les deux etapes sont enchainees — reactiver seul laisserait le compte bloque en « en attente de validation »."),
            actionLabel: i18n.t("Lever la suspension"),
          }}
        >
          <Undo2Icon />
          {i18n.t("Lever la suspension")}</ActionButton>
      ) : isActive && self ? (
        /* Son propre compte, actif : aucun geste d'etat. `disabled` sur
           l'element passe en `render` d'un `DialogTrigger` Base UI diverge
           entre le rendu serveur et le rendu client et casse l'hydratation,
           donc on n'offre pas le geste plutot que de le griser — et on dit
           pourquoi, ce qu'un bouton grise ne faisait pas. */
        <StatusPill tone="neutral">{i18n.t("Votre compte : suspension impossible")}</StatusPill>
      ) : isActive ? (
        <ReasonDialog
          action={suspendUser.bind(null, profileId)}
          trigger={
            <Button variant="destructive" size="sm">
              <BanIcon />
              {i18n.t("Suspendre")}</Button>
          }
          title={i18n.t("Suspendre cet utilisateur")}
          description={i18n.t("Le compte est desactive et son profil metier passe au statut « suspendu » — ce que verifie l'application mobile a la connexion.")}
          placeholder={i18n.t("Comportement abusif, contenu inapproprie…")}
          submitLabel={i18n.t("Suspendre le compte")}
        />
      ) : (
        /* Compte desactive **sans** suspension du profil metier : demande de
           suppression, desactivation de confort… On le reactive sans
           revalider son dossier au passage. */
        <ActionButton
          action={setAccountActive.bind(null, profileId, true)}
          variant="outline"
          size="sm"
          confirm={{
            title: i18n.t("Reactiver ce compte"),
            description:
              i18n.t("Le compte redevient actif. Si son profil metier avait ete suspendu, il repasse en « en attente de validation » — un statut que l'application bloque aussi, et le dossier retourne dans « Files de validation »."),
            actionLabel: i18n.t("Reactiver"),
          }}
        >
          <Undo2Icon />
          {i18n.t("Reactiver")}</ActionButton>
      )}

      {/* Un administrateur ne peut pas supprimer son propre compte : il se
          couperait l'acces au back-office, sans personne pour le retablir. */}
      {self ? null : (
        <ActionButton
          action={deleteAccount.bind(null, profileId)}
          variant="destructive"
          size="sm"
          confirm={{
            title: i18n.t("Supprimer ce compte"),
            description: hasServiceRole()
              ? i18n.t("La suppression est definitive : le compte d'authentification et toutes ses donnees liees (profil, videos, inscriptions) partent en cascade.")
              : i18n.t("SUPABASE_SERVICE_ROLE_KEY n'est pas configuree : le compte sera desactive et marque « suppression demandee » plutot que supprime definitivement."),
            actionLabel: hasServiceRole() ? i18n.t("Supprimer definitivement") : i18n.t("Desactiver et marquer"),
          }}
        >
          <Trash2Icon />
          {i18n.t("Supprimer")}</ActionButton>
      )}
    </div>
  );
}
