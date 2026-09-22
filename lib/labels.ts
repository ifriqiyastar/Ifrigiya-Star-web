import { FOOTBALL_POSITIONS } from "@/lib/football";
import { DEFAULT_ADMIN_LOCALE, type AdminLocale } from "@/lib/i18n/config";

/**
 * Libelles et tonalites des enums Postgres du projet.
 *
 * Les **cles** sont les membres litteraux des enums de `00_ALL_IN_ONE.sql`
 * (app mobile) et ne doivent jamais etre traduites : ce sont elles qui sont
 * stockees en base. Seules les valeurs affichees le sont, et elles le sont
 * maintenant dans les deux langues du back-office.
 *
 * ⚠️ **Les traductions vivent ici et pas dans `messages/admin/*.json`.** Un
 * libelle d'enum n'est pas une phrase d'ecran : il est indissociable de sa
 * tonalite (`StatusPill`) et de sa cle Postgres, et separer les trois dans
 * deux fichiers rendait impossible de verifier d'un coup d'oeil qu'un membre
 * d'enum n'a pas ete oublie. Ici, le type `Spec<K>` l'impose : ajouter un
 * membre a `PlayerProfileStatus` sans lui donner ses deux libelles casse
 * `npm run build`.
 *
 * L'appelant ne passe pas la langue a chaque appel — il lie les helpers une
 * fois par module avec `makeLabels(locale)` :
 *
 *   const { label, entry, options } = makeLabels(locale);
 *   label(ROLE, row.role);
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
export type ScoutDayStatus =
  | "brouillon"
  | "en_attente_validation"
  | "publie"
  | "annule"
  | "cloture";
export type RegistrationStatus =
  | "inscrit"
  | "confirme"
  | "refuse"
  | "annule"
  | "present"
  | "absent";
export type ReportStatus = "en_attente" | "a_valider" | "traite" | "rejete";
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
export type BlogPostStatus = "brouillon" | "publie" | "programme";

export type Entry = { label: string; tone: Tone };
type SpecEntry = { fr: string; en: string; tone: Tone };
export type Spec<K extends string = string> = Record<K, SpecEntry>;

export const ROLE: Spec<UserRole> = {
  player: { fr: "Joueur", en: "Player", tone: "brand" },
  professional: { fr: "Professionnel", en: "Professional", tone: "info" },
  admin: { fr: "Administrateur", en: "Administrator", tone: "warning" },
};

export const ACCOUNT_STATUS: Spec<PlayerProfileStatus> = {
  incomplet: { fr: "Incomplet", en: "Incomplete", tone: "neutral" },
  en_attente_validation: {
    fr: "En attente de validation",
    en: "Awaiting approval",
    tone: "warning",
  },
  valide: { fr: "Valide", en: "Approved", tone: "success" },
  refuse: { fr: "Refuse", en: "Rejected", tone: "danger" },
  suspendu: { fr: "Suspendu", en: "Suspended", tone: "danger" },
};

export const IDENTITY_STATUS: Spec<IdentityVerificationStatus> = {
  non_soumis: { fr: "Non soumis", en: "Not submitted", tone: "neutral" },
  en_attente: { fr: "En attente", en: "Pending", tone: "warning" },
  valide: { fr: "Valide", en: "Approved", tone: "success" },
  refuse: { fr: "Refuse", en: "Rejected", tone: "danger" },
};

export const DOCUMENT_STATUS: Spec<DocumentStatus> = {
  en_attente: { fr: "En attente", en: "Pending", tone: "warning" },
  valide: { fr: "Valide", en: "Approved", tone: "success" },
  refuse: { fr: "Refuse", en: "Rejected", tone: "danger" },
};

export const PROFESSIONAL_TYPE: Spec<ProfessionalType> = {
  recruteur: { fr: "Recruteur", en: "Recruiter", tone: "neutral" },
  club: { fr: "Club", en: "Club", tone: "neutral" },
  academie: { fr: "Academie", en: "Academy", tone: "neutral" },
  agent: { fr: "Agent", en: "Agent", tone: "neutral" },
};

export const PLAYER_LEVEL: Spec<PlayerLevel> = {
  amateur: { fr: "Amateur", en: "Amateur", tone: "neutral" },
  semi_professionnel: { fr: "Semi-professionnel", en: "Semi-professional", tone: "neutral" },
  professionnel: { fr: "Professionnel", en: "Professional", tone: "brand" },
};

export const FOOT_PREFERENCE: Spec<FootPreference> = {
  gauche: { fr: "Gauche", en: "Left", tone: "neutral" },
  droit: { fr: "Droit", en: "Right", tone: "neutral" },
  ambidextre: { fr: "Ambidextre", en: "Both feet", tone: "neutral" },
};

export const BLOG_STATUS: Spec<BlogPostStatus> = {
  brouillon: { fr: "Brouillon", en: "Draft", tone: "neutral" },
  programme: { fr: "Programme", en: "Scheduled", tone: "info" },
  publie: { fr: "Publie", en: "Published", tone: "success" },
};

export const SCOUT_DAY_STATUS: Spec<ScoutDayStatus> = {
  brouillon: { fr: "Brouillon", en: "Draft", tone: "neutral" },
  en_attente_validation: {
    fr: "En attente de validation",
    en: "Awaiting approval",
    tone: "warning",
  },
  publie: { fr: "Publie", en: "Published", tone: "success" },
  annule: { fr: "Annule", en: "Cancelled", tone: "danger" },
  cloture: { fr: "Cloture", en: "Closed", tone: "info" },
};

export const REGISTRATION_STATUS: Spec<RegistrationStatus> = {
  inscrit: { fr: "Inscrit", en: "Registered", tone: "warning" },
  confirme: { fr: "Confirme", en: "Confirmed", tone: "success" },
  refuse: { fr: "Refuse", en: "Rejected", tone: "danger" },
  annule: { fr: "Annule", en: "Cancelled", tone: "neutral" },
  present: { fr: "Present", en: "Attended", tone: "brand" },
  absent: { fr: "Absent", en: "No-show", tone: "danger" },
};

export const REPORT_STATUS: Spec<ReportStatus> = {
  en_attente: { fr: "En attente", en: "Pending", tone: "warning" },
  a_valider: { fr: "Retrait a valider", en: "Removal to approve", tone: "brand" },
  traite: { fr: "Traite", en: "Handled", tone: "success" },
  rejete: { fr: "Rejete", en: "Dismissed", tone: "neutral" },
};

export const MODERATION_ACTION: Spec<ModerationAction> = {
  aucune: { fr: "Aucune action", en: "No action", tone: "neutral" },
  masque: { fr: "Contenu masque", en: "Content hidden", tone: "warning" },
  supprime: { fr: "Contenu supprime", en: "Content removed", tone: "danger" },
  utilisateur_suspendu: { fr: "Utilisateur suspendu", en: "Account suspended", tone: "danger" },
};

export const REPORTABLE_TYPE: Spec<ReportableType> = {
  profil_joueur: { fr: "Profil joueur", en: "Player profile", tone: "neutral" },
  profil_professionnel: {
    fr: "Profil professionnel",
    en: "Professional profile",
    tone: "neutral",
  },
  video: { fr: "Video", en: "Video", tone: "neutral" },
  publication: { fr: "Publication", en: "Post", tone: "neutral" },
  commentaire: { fr: "Commentaire", en: "Comment", tone: "neutral" },
  message: { fr: "Message", en: "Message", tone: "neutral" },
  utilisateur: { fr: "Utilisateur", en: "Account", tone: "neutral" },
  scout_day: { fr: "Scout Day", en: "Scout Day", tone: "neutral" },
};

export const PAYMENT_STATUS: Spec<PaymentStatus> = {
  en_attente: { fr: "En attente", en: "Pending", tone: "warning" },
  reussi: { fr: "Reussi", en: "Succeeded", tone: "success" },
  echoue: { fr: "Echoue", en: "Failed", tone: "danger" },
  rembourse: { fr: "Rembourse", en: "Refunded", tone: "info" },
  active_manuellement: { fr: "Active manuellement", en: "Activated manually", tone: "brand" },
};

export const PAYMENT_TYPE: Spec<PaymentType> = {
  abonnement: { fr: "Abonnement", en: "Subscription", tone: "info" },
  scout_day: { fr: "Scout Day", en: "Scout Day", tone: "brand" },
};

export const PAYMENT_METHOD: Spec<PaymentMethod> = {
  carte: { fr: "Carte", en: "Card", tone: "neutral" },
  mobile_money: { fr: "Mobile money", en: "Mobile money", tone: "neutral" },
  virement: { fr: "Virement", en: "Bank transfer", tone: "neutral" },
  especes_hors_ligne: { fr: "Especes (hors ligne)", en: "Cash (offline)", tone: "warning" },
  autre: { fr: "Autre", en: "Other", tone: "neutral" },
};

export const SUBSCRIPTION_STATUS: Spec<SubscriptionStatus> = {
  active: { fr: "Active", en: "Active", tone: "success" },
  expiree: { fr: "Expiree", en: "Expired", tone: "neutral" },
  annulee: { fr: "Annulee", en: "Cancelled", tone: "danger" },
  en_attente_paiement: { fr: "En attente de paiement", en: "Awaiting payment", tone: "warning" },
};

export const PLAN_CODE: Spec<SubscriptionPlanCode> = {
  joueur_gratuit: { fr: "Joueur — Gratuit", en: "Player — Free", tone: "neutral" },
  joueur_premium: { fr: "Joueur — Premium", en: "Player — Premium", tone: "brand" },
  pro_gratuit: { fr: "Pro — Gratuit", en: "Pro — Free", tone: "neutral" },
  pro_premium_mensuel: { fr: "Pro — Premium mensuel", en: "Pro — Premium monthly", tone: "brand" },
  pro_premium_annuel: { fr: "Pro — Premium annuel", en: "Pro — Premium yearly", tone: "brand" },
};

/**
 * Traduction **d'affichage seulement** des postes de football.
 *
 * Les cles sont les chaines stockees dans `player_profiles.main_position` et
 * dans `scout_days.eligibility_criteria.positions` : le controle d'eligibilite
 * (§8.2) les compare par egalite de chaine, et l'app mobile les ecrit telles
 * quelles. Ce qui part en base, y compris depuis un ecran anglais, reste donc
 * toujours la chaine francaise de `FOOTBALL_POSITIONS` — seul le texte a
 * l'ecran change.
 */
const POSITION_EN: Record<(typeof FOOTBALL_POSITIONS)[number], string> = {
  "Gardien de but": "Goalkeeper",
  "Défenseur central": "Centre-back",
  "Latéral droit": "Right-back",
  "Latéral gauche": "Left-back",
  "Milieu défensif": "Defensive midfielder",
  "Milieu central": "Central midfielder",
  "Milieu offensif": "Attacking midfielder",
  "Ailier droit": "Right winger",
  "Ailier gauche": "Left winger",
  "Attaquant de soutien": "Second striker",
  "Avant-centre": "Centre-forward",
};

export function positionLabel(
  value: string | null | undefined,
  locale: AdminLocale = DEFAULT_ADMIN_LOCALE,
): string {
  if (!value) return "—";
  if (locale === "fr") return value;
  const normalized = value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const position = Object.keys(POSITION_EN).find(
    (key) => key.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase() === normalized,
  );
  return position ? POSITION_EN[position as keyof typeof POSITION_EN] : value;
}

/** Les helpers de libelles, deja lies a une langue. */
export type Labels = {
  locale: AdminLocale;
  entry: <K extends string>(spec: Spec<K>, key: string | null | undefined) => Entry;
  label: <K extends string>(spec: Spec<K>, key: string | null | undefined) => string;
  options: <K extends string>(spec: Spec<K>) => Array<{ value: K; label: string }>;
  position: (value: string | null | undefined) => string;
};

/**
 * Lie les helpers a une langue, une fois par module.
 *
 * C'est ce qui evite de passer `locale` a chacun des cent-huit appels du
 * back-office : la page recupere sa langue une fois, destructure `label` /
 * `entry` / `options`, et les appels gardent exactement la forme qu'ils
 * avaient quand le produit etait monolingue.
 */
export function makeLabels(locale: AdminLocale = DEFAULT_ADMIN_LOCALE): Labels {
  /** Lecture tolerante : une valeur inconnue (enum etendu en base) reste lisible. */
  function entry<K extends string>(spec: Spec<K>, key: string | null | undefined): Entry {
    if (!key) return { label: "—", tone: "neutral" };
    const found = (spec as Spec)[key];
    if (!found) return { label: key.replace(/_/g, " "), tone: "neutral" };
    return { label: found[locale], tone: found.tone };
  }

  return {
    locale,
    entry,
    label: (spec, key) => entry(spec, key).label,
    /** Options `{value,label}` pour les filtres, dans l'ordre de declaration. */
    options: <K extends string>(spec: Spec<K>) =>
      (Object.keys(spec) as K[]).map((value) => ({ value, label: spec[value][locale] })),
    position: (value) => positionLabel(value, locale),
  };
}

/**
 * Helpers en francais, pour les rares appelants qui n'ont pas de langue sous
 * la main — un export CSV declenche hors requete, un test. Tout ce qui rend
 * un ecran doit passer par `makeLabels()`.
 */
const defaults = makeLabels(DEFAULT_ADMIN_LOCALE);
export const entry = defaults.entry;
export const label = defaults.label;
export const options = defaults.options;
