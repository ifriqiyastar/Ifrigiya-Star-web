import {
  BadgeCheckIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  BellIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  FlagIcon,
  GavelIcon,
  IdCardIcon,
  ImagesIcon,
  LayoutDashboardIcon,
  MailIcon,
  MessageSquareIcon,
  NewspaperIcon,
  SendIcon,
  ShieldCheckIcon,
  SquarePenIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { AdminPermission } from "@/lib/auth";
import type { AdminDictionary } from "@/lib/i18n/admin-shared";

/**
 * Les sections du back-office, dans l'ordre du cahier des charges §12.
 *
 * L'intitule n'est plus ecrit ici mais designe par `key` : le rail est un
 * composant client, il lit le dictionnaire du back-office
 * (`useAdminI18n()`), et le type ci-dessous force chaque `key` a exister
 * dans `nav.items` — ajouter une section sans son libelle casse le build.
 * `badge` designe le compteur passe par le layout (files d'attente).
 *
 * Chaque entree porte la permission qui la revele : le rail ne montre que les
 * sections que la session peut ouvrir.
 */
export const NAV_ITEMS = [
  {
    href: "/admin",
    icon: LayoutDashboardIcon,
    key: "dashboard",
    badge: null,
    permission: "dashboard.read" as AdminPermission,
    section: "pilotage",
  },
  {
    href: "/admin/validations",
    key: "validations",
    icon: ShieldCheckIcon,
    badge: "validations" as const,
    permission: "verifications.review" as AdminPermission,
    section: "operations",
    /**
     * Quatre files, quatre routes, donc quatre entrees — meme traitement que
     * la moderation. Le compteur reste sur le parent : `fetchAdminQueue()`
     * compte les quatre files ensemble sous `validations`, et les repartir
     * demanderait un compteur par file dans `NavBadges`.
     */
    children: [
      { href: "/admin/validations/joueurs", key: "validationsPlayers", badge: "joueurs" as const, icon: BadgeCheckIcon },
      { href: "/admin/validations/professionnels", key: "validationsPros", badge: "professionnels" as const, icon: BriefcaseIcon },
      { href: "/admin/validations/justificatifs", key: "validationsDocuments", badge: "justificatifs" as const, icon: FileTextIcon },
      { href: "/admin/validations/identite", key: "validationsIdentity", badge: "identite" as const, icon: IdCardIcon },
    ],
  },
  {
    href: "/admin/utilisateurs",
    key: "users",
    icon: UsersIcon,
    badge: null,
    permission: "users.read" as AdminPermission,
    section: "operations",
  },
  {
    href: "/admin/moderation",
    key: "moderation",
    icon: FlagIcon,
    badge: "moderation" as const,
    permission: "moderation.manage" as AdminPermission,
    section: "operations",
    /**
     * LES QUATRE ECRANS DE MODERATION SONT QUATRE ROUTES, DONC QUATRE ENTREES.
     *
     * Ils vivaient derriere `?vue=` dans une page unique : le rail montrait une
     * seule ligne, « Moderation », et les trois autres ecrans n'existaient que
     * pour qui savait qu'il fallait cliquer un onglet. Le groupe se deplie et
     * se replie — replie, il reste une ligne, et son compteur continue de dire
     * ce qui attend.
     *
     * ⚠️ **Trois des quatre portent un compteur, et chacun est celui de son
     * propre ecran.** Il n'y en avait qu'un, sur « Signalements », et il
     * additionnait les quatre files : une publication en attente de
     * validation s'ajoutait au chiffre de « Signalements », ou elle ne
     * s'instruit pas. La regle est celle du rail entier — une pastille
     * compte ce qui attend **sur la ligne qu'elle designe**. « Medias
     * joueurs » n'en a pas parce que `fetchAdminQueue()` ne compte aucune
     * file pour lui ; en inventer une voudrait dire ajouter ses tables a
     * `QUEUE_TABLES` **et** a la publication temps reel, sans quoi le chiffre
     * serait en retard sans que rien ne le dise.
     */
    /**
     * ⚠️ L'enfant « Signalements » porte `GavelIcon`, pas `FlagIcon` : le
     * drapeau est deja celui du parent, et deux icones identiques l'une
     * au-dessus de l'autre se lisent comme un defaut d'affichage. C'est aussi
     * l'icone que l'ecran lui-meme emploie, donc le rail et la page
     * s'accordent.
     */
    children: [
      { href: "/admin/moderation/signalements", key: "moderationReports", badge: "signalements" as const, icon: GavelIcon },
      { href: "/admin/moderation/publications", key: "moderationPosts", badge: "publications" as const, icon: SquarePenIcon },
      { href: "/admin/moderation/commentaires", key: "moderationComments", badge: "commentaires" as const, icon: MessageSquareIcon },
      { href: "/admin/moderation/medias", key: "moderationMedia", badge: null, icon: ImagesIcon },
    ],
  },
  {
    href: "/admin/scout-days",
    key: "scoutDays",
    icon: CalendarDaysIcon,
    badge: "scoutDays" as const,
    permission: "events.manage" as AdminPermission,
    section: "operations",
  },
  {
    href: "/admin/evaluations",
    key: "evaluations",
    icon: ClipboardCheckIcon,
    badge: null,
    permission: "evaluations.manage" as AdminPermission,
    section: "operations",
  },
  {
    href: "/admin/notifications",
    key: "notifications",
    icon: BellIcon,
    badge: null,
    permission: "notifications.manage" as AdminPermission,
    section: "communication",
    /**
     * L'habillage des courriels est une page a part, et il lui faut une
     * entree : c'est exactement le defaut qu'on a corrige sur la moderation
     * et les validations — un ecran qui n'existe que pour qui sait qu'il
     * existe. Pas de compteur ici, aucune des deux pages n'est une file.
     */
    children: [
      { href: "/admin/notifications", key: "notificationsSend", badge: null, icon: SendIcon },
      { href: "/admin/notifications/modele", key: "notificationsTemplate", badge: null, icon: MailIcon },
    ],
  },
  {
    href: "/admin/blog",
    key: "blog",
    icon: NewspaperIcon,
    badge: null,
    permission: "blog.manage" as AdminPermission,
    section: "communication",
  },
  {
    href: "/admin/finances",
    key: "finances",
    icon: WalletIcon,
    badge: null,
    permission: "finance.manage" as AdminPermission,
    section: "pilotage",
  },
] as const;

type NavItem = (typeof NAV_ITEMS)[number];
export type NavKey = NavItem["key"];

/** Les entrees d'un groupe depliable. */
type NavParent = Extract<NavItem, { children: readonly unknown[] }>;
export type NavChildKey = NavParent["children"][number]["key"];

/**
 * Le libelle d'une section, resolu dans la langue du back-office.
 *
 * Le type force chaque `key` — parent comme enfant — a exister dans
 * `nav.items` : ajouter une entree sans son libelle casse le build.
 */
export const navLabel = (dict: AdminDictionary, key: NavKey | NavChildKey) =>
  dict.nav.items[key];

/**
 * La premiere section que ces permissions ouvrent, dans l'ordre ci-dessus —
 * utilisee pour rediriger un compte sans `dashboard.read` (un editeur, par
 * exemple) vers sa vraie page d'accueil plutot que vers `/admin`, qui lui
 * refuserait l'acces.
 */
export function firstAccessiblePath(permissions: AdminPermission[]): string {
  return NAV_ITEMS.find((item) => permissions.includes(item.permission))?.href ?? "/admin/acces-refuse";
}

/** Les compteurs que le layout passe au rail. */
export type NavBadgeKey =
  | "validations"
  | "joueurs"
  | "professionnels"
  | "justificatifs"
  | "identite"
  | "moderation"
  | "signalements"
  | "publications"
  | "commentaires"
  | "scoutDays";

export type NavBadges = Record<NavBadgeKey, number>;

/**
 * Les files dont le rouge est reserve : un element non traite y reste visible
 * du public. Toute la moderation en releve, groupe et sous-entrees — le ton se
 * deduisait de la seule cle `signalements`, ce qui aurait rendu en lime les
 * deux compteurs ajoutes a cote d'elle.
 */
export const DANGER_BADGES: readonly NavBadgeKey[] = [
  "moderation",
  "signalements",
  "publications",
  "commentaires",
];
