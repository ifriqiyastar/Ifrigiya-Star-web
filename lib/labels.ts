/**
 * Libelles et tonalites des enums Postgres du projet.
 *
 * Les **cles** sont les membres litteraux des enums de `00_ALL_IN_ONE.sql`
 * (app mobile) et ne doivent jamais etre traduites : ce sont elles qui sont
 * stockees en base. Seules les valeurs affichees le sont — le back-office est
 * en francais, comme la V1 de l'app.
 */

export type Tone = "brand" | "success" | "warning" | "danger" | "neutral" | "info";

export type UserRole = "player" | "professional" | "admin";
export type PlayerProfileStatus =
  | "incomplet"
  | "en_attente_validation"
  | "valide"
  | "refuse"
  | "suspendu";
export type ProfessionalVerificationStatus = PlayerProfileStatus;
export type IdentityVerificationStatus = "non_soumis" | "en_attente" | "valide" | "refuse";
export type DocumentStatus = "en_attente" | "valide" | "refuse";
export type ProfessionalType = "recruteur" | "club" | "academie" | "agent";
export type PlayerLevel = "amateur" | "semi_professionnel" | "professionnel";
export type FootPreference = "gauche" | "droit" | "ambidextre";
export type ScoutDayStatus = "brouillon" | "publie" | "annule" | "cloture";
export type RegistrationStatus =
  | "inscrit"
  | "confirme"
  | "refuse"
  | "annule"
  | "present"
  | "absent";
export type ReportStatus = "en_attente" | "traite" | "rejete";
export type ModerationAction = "aucune" | "masque" | "supprime" | "utilisateur_suspendu";
export type ReportableType =
  | "profil_joueur"
  | "profil_professionnel"
  | "video"
  | "publication"
  | "commentaire"
  | "message"
  | "utilisateur"
  | "scout_day";
export type PaymentStatus =
  | "en_attente"
  | "reussi"
  | "echoue"
  | "rembourse"
  | "active_manuellement";
export type PaymentType = "abonnement" | "scout_day";
export type PaymentMethod =
  | "carte"
  | "mobile_money"
  | "virement"
  | "especes_hors_ligne"
  | "autre";
export type SubscriptionStatus = "active" | "expiree" | "annulee" | "en_attente_paiement";
export type SubscriptionPlanCode =
  | "joueur_gratuit"
  | "joueur_premium"
  | "pro_gratuit"
  | "pro_premium_mensuel"
  | "pro_premium_annuel";

type Entry = { label: string; tone: Tone };
type Dict<K extends string> = Record<K, Entry>;

export const ROLE: Dict<UserRole> = {
  player: { label: "Joueur", tone: "brand" },
  professional: { label: "Professionnel", tone: "info" },
  admin: { label: "Administrateur", tone: "warning" },
};

export const ACCOUNT_STATUS: Dict<PlayerProfileStatus> = {
  incomplet: { label: "Incomplet", tone: "neutral" },
  en_attente_validation: { label: "En attente de validation", tone: "warning" },
  valide: { label: "Valide", tone: "success" },
  refuse: { label: "Refuse", tone: "danger" },
  suspendu: { label: "Suspendu", tone: "danger" },
};

export const IDENTITY_STATUS: Dict<IdentityVerificationStatus> = {
  non_soumis: { label: "Non soumis", tone: "neutral" },
  en_attente: { label: "En attente", tone: "warning" },
  valide: { label: "Valide", tone: "success" },
  refuse: { label: "Refuse", tone: "danger" },
};

export const DOCUMENT_STATUS: Dict<DocumentStatus> = {
  en_attente: { label: "En attente", tone: "warning" },
  valide: { label: "Valide", tone: "success" },
  refuse: { label: "Refuse", tone: "danger" },
};

export const PROFESSIONAL_TYPE: Dict<ProfessionalType> = {
  recruteur: { label: "Recruteur", tone: "neutral" },
  club: { label: "Club", tone: "neutral" },
  academie: { label: "Academie", tone: "neutral" },
  agent: { label: "Agent", tone: "neutral" },
};

export const PLAYER_LEVEL: Dict<PlayerLevel> = {
  amateur: { label: "Amateur", tone: "neutral" },
  semi_professionnel: { label: "Semi-professionnel", tone: "neutral" },
  professionnel: { label: "Professionnel", tone: "brand" },
};

export const FOOT_PREFERENCE: Dict<FootPreference> = {
  gauche: { label: "Gauche", tone: "neutral" },
  droit: { label: "Droit", tone: "neutral" },
  ambidextre: { label: "Ambidextre", tone: "neutral" },
};

export const SCOUT_DAY_STATUS: Dict<ScoutDayStatus> = {
  brouillon: { label: "Brouillon", tone: "neutral" },
  publie: { label: "Publie", tone: "success" },
  annule: { label: "Annule", tone: "danger" },
  cloture: { label: "Cloture", tone: "info" },
};

export const REGISTRATION_STATUS: Dict<RegistrationStatus> = {
  inscrit: { label: "Inscrit", tone: "warning" },
  confirme: { label: "Confirme", tone: "success" },
  refuse: { label: "Refuse", tone: "danger" },
  annule: { label: "Annule", tone: "neutral" },
  present: { label: "Present", tone: "brand" },
  absent: { label: "Absent", tone: "danger" },
};

export const REPORT_STATUS: Dict<ReportStatus> = {
  en_attente: { label: "En attente", tone: "warning" },
  traite: { label: "Traite", tone: "success" },
  rejete: { label: "Rejete", tone: "neutral" },
};

export const MODERATION_ACTION: Dict<ModerationAction> = {
  aucune: { label: "Aucune action", tone: "neutral" },
  masque: { label: "Contenu masque", tone: "warning" },
  supprime: { label: "Contenu supprime", tone: "danger" },
  utilisateur_suspendu: { label: "Utilisateur suspendu", tone: "danger" },
};

export const REPORTABLE_TYPE: Dict<ReportableType> = {
  profil_joueur: { label: "Profil joueur", tone: "neutral" },
  profil_professionnel: { label: "Profil professionnel", tone: "neutral" },
  video: { label: "Video", tone: "neutral" },
  publication: { label: "Publication", tone: "neutral" },
  commentaire: { label: "Commentaire", tone: "neutral" },
  message: { label: "Message", tone: "neutral" },
  utilisateur: { label: "Utilisateur", tone: "neutral" },
  scout_day: { label: "Scout Day", tone: "neutral" },
};

export const PAYMENT_STATUS: Dict<PaymentStatus> = {
  en_attente: { label: "En attente", tone: "warning" },
  reussi: { label: "Reussi", tone: "success" },
  echoue: { label: "Echoue", tone: "danger" },
  rembourse: { label: "Rembourse", tone: "info" },
  active_manuellement: { label: "Active manuellement", tone: "brand" },
};

export const PAYMENT_TYPE: Dict<PaymentType> = {
  abonnement: { label: "Abonnement", tone: "info" },
  scout_day: { label: "Scout Day", tone: "brand" },
};

export const PAYMENT_METHOD: Dict<PaymentMethod> = {
  carte: { label: "Carte", tone: "neutral" },
  mobile_money: { label: "Mobile money", tone: "neutral" },
  virement: { label: "Virement", tone: "neutral" },
  especes_hors_ligne: { label: "Especes (hors ligne)", tone: "warning" },
  autre: { label: "Autre", tone: "neutral" },
};

export const SUBSCRIPTION_STATUS: Dict<SubscriptionStatus> = {
  active: { label: "Active", tone: "success" },
  expiree: { label: "Expiree", tone: "neutral" },
  annulee: { label: "Annulee", tone: "danger" },
  en_attente_paiement: { label: "En attente de paiement", tone: "warning" },
};

export const PLAN_CODE: Dict<SubscriptionPlanCode> = {
  joueur_gratuit: { label: "Joueur — Gratuit", tone: "neutral" },
  joueur_premium: { label: "Joueur — Premium", tone: "brand" },
  pro_gratuit: { label: "Pro — Gratuit", tone: "neutral" },
  pro_premium_mensuel: { label: "Pro — Premium mensuel", tone: "brand" },
  pro_premium_annuel: { label: "Pro — Premium annuel", tone: "brand" },
};

/** Lecture tolerante : une valeur inconnue (enum etendu en base) reste lisible. */
export function entry<K extends string>(dict: Dict<K>, key: string | null | undefined): Entry {
  if (!key) return { label: "—", tone: "neutral" };
  return (dict as Record<string, Entry>)[key] ?? { label: key.replace(/_/g, " "), tone: "neutral" };
}

export const label = <K extends string>(dict: Dict<K>, key: string | null | undefined) =>
  entry(dict, key).label;

/** Options `{value,label}` pour les filtres, dans l'ordre de declaration. */
export const options = <K extends string>(dict: Dict<K>) =>
  (Object.keys(dict) as K[]).map((value) => ({ value, label: dict[value].label }));
