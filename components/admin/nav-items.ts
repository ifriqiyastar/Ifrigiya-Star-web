import {
  CalendarDaysIcon,
  BellIcon,
  ClipboardCheckIcon,
  FlagIcon,
  LayoutDashboardIcon,
  LanguagesIcon,
  ShieldCheckIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { AdminPermission } from "@/lib/auth";

/**
 * Les sections du back-office, dans l'ordre du cahier des charges §12.
 * `badge` designe le compteur passe par le layout (files d'attente).
 *
 * `permission: null` signifie « visible par tout administrateur ». Une seule
 * entree l'utilise, Parametres : la langue d'affichage est une preference
 * personnelle, pas un droit metier, et la cacher derriere une permission RBAC
 * priverait un moderateur du seul reglage qui le concerne.
 */
export const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Tableau de bord",
    icon: LayoutDashboardIcon,
    badge: null,
    permission: "dashboard.read" as AdminPermission,
    section: "Pilotage" as const,
  },
  {
    href: "/admin/validations",
    label: "Validations",
    icon: ShieldCheckIcon,
    badge: "validations" as const,
    permission: "verifications.review" as AdminPermission,
    section: "Operations" as const,
  },
  {
    href: "/admin/utilisateurs",
    label: "Utilisateurs",
    icon: UsersIcon,
    badge: null,
    permission: "users.read" as AdminPermission,
    section: "Operations" as const,
  },
  {
    href: "/admin/moderation",
    label: "Moderation",
    icon: FlagIcon,
    badge: "signalements" as const,
    permission: "moderation.manage" as AdminPermission,
    section: "Operations" as const,
  },
  {
    href: "/admin/scout-days",
    label: "Scout Days",
    icon: CalendarDaysIcon,
    badge: "scoutDays" as const,
    permission: "events.manage" as AdminPermission,
    section: "Operations" as const,
  },
  {
    href: "/admin/evaluations",
    label: "Evaluations",
    icon: ClipboardCheckIcon,
    badge: null,
    permission: "evaluations.manage" as AdminPermission,
    section: "Operations" as const,
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    icon: BellIcon,
    badge: null,
    permission: "notifications.manage" as AdminPermission,
    section: "Communication" as const,
  },
  {
    href: "/admin/finances",
    label: "Abonnements & paiements",
    icon: WalletIcon,
    badge: null,
    permission: "finance.manage" as AdminPermission,
    section: "Pilotage" as const,
  },
  {
    href: "/admin/parametres",
    label: "Parametres",
    icon: LanguagesIcon,
    badge: null,
    permission: null,
    section: "Pilotage" as const,
  },
] as const;

export type NavBadges = { validations: number; signalements: number; scoutDays: number };
