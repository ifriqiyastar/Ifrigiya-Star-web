import type { AdminTranslations } from "@/lib/i18n/admin-shared";
import type { ModerationAction } from "@/lib/labels";

/**
 * Ce que « retirer » veut dire selon la cible d'un signalement (§12.2).
 *
 * Ce module existe parce qu'un fichier `"use server"` ne peut exporter que des
 * fonctions asynchrones : ces deux valeurs sont lues par les Server Actions
 * *et* par la page qui dessine le formulaire de proposition, elles ne peuvent
 * donc vivre dans `lib/actions/moderation.ts`.
 *
 * Le tableau des effets, lui, reste dans les actions — il touche plusieurs
 * tables et le stockage.
 */

/**
 * Cibles qu'une proposition de retrait sait masquer immediatement, parce
 * qu'elles ont un drapeau reversible : `posts.is_hidden`,
 * `post_comments.is_hidden`, `player_profiles.is_visible`. Les autres restent
 * en ligne jusqu'a la decision — une video n'a pas de drapeau de masquage, sa
 * suppression est reelle, et un compte ne se met pas en quarantaine sans le
 * suspendre.
 */
export const QUARANTINABLE: readonly string[] = ["publication", "commentaire", "profil_joueur"];

/**
 * Cibles qui **sont** un compte : il n'y a pas de contenu derriere
 * l'identifiant, c'est le profil lui-meme qui est vise. Depuis la migration
 * mobile 0047 c'est le cas le plus courant, la messagerie signalant
 * l'interlocuteur (`utilisateur`) et non un message isole.
 *
 * Trois modules en dependent et disaient la meme chose chacun de son cote :
 * la resolution de cible de l'ecran, `targetOwner()` dans les actions, et le
 * choix du libelle en liste.
 */
export const ACCOUNT_TARGETS: readonly string[] = [
  "profil_joueur",
  "profil_professionnel",
  "utilisateur",
];

/** Retraits proposables selon la cible, dans l'ordre d'affichage. */
export function removalOptions(targetType: string): ModerationAction[] {
  switch (targetType) {
    case "publication":
    case "commentaire":
      return ["masque", "supprime", "utilisateur_suspendu"];
    case "video":
      return ["supprime", "utilisateur_suspendu"];
    case "scout_day":
      // « Supprimer » un evenement, c'est l'annuler : ses inscriptions sont
      // une trace, et les inscrits doivent etre prevenus.
      return ["supprime", "utilisateur_suspendu"];
    default:
      // Profils, comptes et messages : la seule mesure que le schema autorise
      // est la suspension du compte. Un message ne se retire pas — il est
      // chiffre, l'auteur seul peut le supprimer (`messages_soft_delete_own`).
      return ["utilisateur_suspendu"];
  }
}
/**
 * Ce que le super administrateur s'apprete a faire, en toutes lettres.
 *
 * Un bouton « Valider » ne disait pas *quoi* : selon la proposition, le meme
 * clic masque un commentaire, efface definitivement une video avec son fichier
 * de stockage, ou desactive un compte. Le libelle porte donc l'action, et la
 * confirmation en nomme la consequence — irreversible ou non, c'est la seule
 * chose qui compte au moment de cliquer.
 */
export function removalConfirmation(
  action: string | null,
  targetType: string,
  i18n: AdminTranslations,
): { title: string; description: string; actionLabel: string } {
  if (action === "utilisateur_suspendu") {
    return {
      actionLabel: i18n.t("Suspendre le compte"),
      title: i18n.t("Suspendre le compte de l'auteur"),
      description:
        i18n.t("Le compte sera desactive et son profil metier passera au statut « suspendu » : l'application le deconnectera a la prochaine ouverture. La mesure est reversible depuis la fiche du compte."),
    };
  }

  if (action === "masque") {
    return {
      actionLabel: i18n.t("Masquer le contenu"),
      title: i18n.t("Masquer definitivement ce contenu"),
      description:
        i18n.t("Le contenu reste retire du fil et le signalement est clos. L'administration continue de le voir, et le masquage se leve depuis l'onglet correspondant."),
    };
  }

  // « supprime » : la consequence depend de la cible, et pour un media elle
  // est sans retour possible.
  if (targetType === "video") {
    return {
      actionLabel: i18n.t("Supprimer la video"),
      title: i18n.t("Supprimer definitivement cette video"),
      description:
        i18n.t("La ligne et le fichier de stockage seront supprimes ensemble. Contrairement a une publication, cette suppression est IRREVERSIBLE : rien ne permettra de la restaurer."),
    };
  }

  if (targetType === "scout_day") {
    return {
      actionLabel: i18n.t("Annuler l'evenement"),
      title: i18n.t("Annuler ce Scout Day"),
      description:
        i18n.t("L'evenement passera en « annule » et tous les joueurs inscrits recevront une notification. Cette notification ne peut pas etre reprise."),
    };
  }

  return {
    actionLabel: i18n.t("Supprimer le contenu"),
    title: i18n.t("Supprimer ce contenu"),
    description:
      i18n.t("Le contenu disparaitra du fil. Il reste visible de l'administration pour la trace du signalement, et la suppression se leve depuis l'onglet correspondant."),
  };
}

