import { BanIcon, CheckIcon, EyeIcon, EyeOffIcon, Trash2Icon, Undo2Icon, XIcon } from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { Button } from "@/components/ui/button";
import { suspendUser } from "@/lib/actions/moderation";
import {
  deleteAccount,
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
export function AccountActions({
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
  const isPlayer = role === "player";
  const isProfessional = role === "professional";
  const setStatus = isPlayer ? setPlayerStatus : setProfessionalStatus;
  const canSetStatus = isPlayer || isProfessional;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canSetStatus && businessStatus !== "valide" ? (
        <ActionButton
          action={setStatus.bind(null, profileId, "valide", undefined)}
          variant="default"
          size="sm"
        >
          <CheckIcon />
          Valider le compte
        </ActionButton>
      ) : null}

      {canSetStatus && businessStatus !== "refuse" ? (
        <ReasonDialog
          action={(reason) => setStatus(profileId, "refuse", reason)}
          trigger={
            <Button variant="outline" size="sm">
              <XIcon />
              Refuser
            </Button>
          }
          title="Refuser ce compte"
          description="Le motif est enregistre dans status_reason et explique la decision a l'utilisateur."
          submitLabel="Refuser"
        />
      ) : null}

      {isPlayer && isVisible !== null ? (
        <ActionButton
          action={setPlayerVisibility.bind(null, profileId, !isVisible)}
          size="sm"
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
          {isVisible ? "Retirer de la recherche" : "Rendre visible"}
        </ActionButton>
      ) : null}

      {isActive ? (
        <ReasonDialog
          action={(reason) => suspendUser(profileId, reason)}
          trigger={
            <Button variant="destructive" size="sm" disabled={self}>
              <BanIcon />
              Suspendre
            </Button>
          }
          title="Suspendre cet utilisateur"
          description="Le compte est desactive et son profil metier passe au statut « suspendu » — ce que verifie l'application mobile a la connexion."
          placeholder="Comportement abusif, contenu inapproprie…"
          submitLabel="Suspendre le compte"
        />
      ) : (
        <ActionButton
          action={setAccountActive.bind(null, profileId, true)}
          variant="outline"
          size="sm"
        >
          <Undo2Icon />
          Reactiver
        </ActionButton>
      )}

      {/* Un administrateur ne peut pas supprimer son propre compte : il se
          couperait l'acces au back-office, sans personne pour le retablir. */}
      {self ? null : (
        <ActionButton
          action={deleteAccount.bind(null, profileId)}
          variant="destructive"
          size="sm"
          confirm={{
            title: "Supprimer ce compte",
            description: hasServiceRole()
              ? "La suppression est definitive : le compte d'authentification et toutes ses donnees liees (profil, videos, inscriptions) partent en cascade."
              : "SUPABASE_SERVICE_ROLE_KEY n'est pas configuree : le compte sera desactive et marque « suppression demandee » plutot que supprime definitivement.",
            actionLabel: hasServiceRole() ? "Supprimer definitivement" : "Desactiver et marquer",
          }}
        >
          <Trash2Icon />
          Supprimer
        </ActionButton>
      )}
    </div>
  );
}
