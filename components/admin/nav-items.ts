import {
  CalendarDaysIcon,
  BellIcon,
  ClipboardCheckIcon,
  FlagIcon,
  LayoutDashboardIcon,
  NewspaperIcon,
  ShieldCheckIcon,
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
    badge: "signalements" as const,
    permission: "moderation.manage" as AdminPermission,
    section: "operations",
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

export type NavKey = (typeof NAV_ITEMS)[number]["key"];

/** Le libelle d'une section, resolu dans la langue du back-office. */
export const navLabel = (dict: AdminDictionary, key: NavKey) => dict.nav.items[key];

export type NavBadges = { validations: number; signalements: number; scoutDays: number };
