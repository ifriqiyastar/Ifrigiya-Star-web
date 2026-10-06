"use client"

import { BrandMark } from "@/components/admin/brand-mark";
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import {
  BellIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  FileTextIcon,
  FlagIcon,
  IdCardIcon,
  InboxIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  NewspaperIcon,
  SearchIcon,
  ShieldAlertIcon,
  UserRoundCheckIcon,
  UserXIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAdminQueue } from "@/components/admin/queue-live"
import { useQueueSeen } from "@/components/admin/queue-seen"
import { LanguageMenu } from "@/components/admin/language-menu"
import type { AdminPermission } from "@/lib/auth"
import { useAdminI18n } from "@/lib/i18n/admin-client"
import { localePath, stripLocale } from "@/lib/i18n/config"
import { cn } from "@/lib/utils"

/**
 * Une icone par file de `fetchAdminQueue()` (`AdminTask.key`), pour qu'une
 * ligne se reconnaisse avant d'etre lue. `critical` teinte en rouge les deux
 * files ou attendre a un cout : un retrait a valider porte sur un contenu deja
 * mis en quarantaine, une demande de suppression de compte engage le RGPD.
 * Une file ajoutee sans entree ici prend l'icone generique, sans casser.
 */
const TASK_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; critical?: boolean }> = {
  players: { icon: UserRoundCheckIcon },
  professionals: { icon: BriefcaseIcon },
  documents: { icon: FileTextIcon },
  identity: { icon: IdCardIcon },
  reports: { icon: FlagIcon },
  removals: { icon: ShieldAlertIcon, critical: true },
  posts: { icon: NewspaperIcon },
  comments: { icon: MessageSquareIcon },
  scoutDays: { icon: CalendarDaysIcon },
  deletions: { icon: UserXIcon, critical: true },
}
const DEFAULT_TASK_STYLE = { icon: InboxIcon, critical: false }

/**
 * La cloche liste **ce qui attend une decision de l'administration**, pas les
 * notifications des utilisateurs.
 *
 * Elle affichait auparavant les vingt dernieres lignes de
 * `public.notifications` : la boite de reception des membres, « X vous a envoye
 * un message » compris, avec le nom du destinataire en clair. Le RLS l'autorise
 * (`notifications_select_own` porte `or public.is_admin()`), mais c'est la meme
 * regle que pour les conversations privees — le droit technique ne fait pas
 * l'usage. Les lignes viennent maintenant de `fetchAdminQueue()`, qui compte
 * les files de validation, de moderation et d'evenements.
 *
 * Une tache disparait de la **liste** quand elle est traitee, pas quand on la
 * regarde. La **pastille**, elle, s'eteint a l'ouverture de la cloche et ne se
 * rallume que pour les dossiers arrives depuis (`useQueueSeen()`) : sans cela
 * elle restait allumee en permanence et ne signalait plus rien.
 *
 * Les lignes ne sont plus figees au rendu de la page : elles viennent de
 * `useAdminQueue()`, que `AdminQueueProvider` reactualise en arriere-plan. Un
 * dossier depose depuis l'application mobile apparait donc ici sans que
 * l'administrateur ait a recharger l'ecran.
 *
 * Le declencheur est stylise directement plutot que compose avec `Button` via
 * `render` : deux composants qui posent chacun leur `data-slot` ne fusionnent
 * pas pareil au rendu serveur et au rendu client, ce qui casse l'hydratation.
 */
export function SiteHeader({
  user,
  permissions,
  showBell,
}: {
  user: { name: string; email: string; roleLabel: string }
  /** Meme garde que le rail : le raccourci « Voir les campagnes » en bas de
   * la cloche menait a `/admin/notifications` quel que soit le droit du
   * compte connecte. */
  permissions: AdminPermission[]
  /** Faux quand aucune permission du compte n'ouvre de file (`hasQueueAccess()`,
   * `lib/queries/admin-queue.ts`) : la cloche n'aurait jamais rien a montrer,
   * donc elle disparait plutot que d'afficher en permanence « rien en attente ». */
  showBell: boolean
}) {
  const { tasks } = useAdminQueue()
  const { locale, dict } = useAdminI18n()
  const pathname = usePathname()
  // Le chemin **sans son prefixe de langue** : sur /en/admin le test
  // `pathname === "/admin"` etait faux, et le titre du bandeau mobile
  // retombait sur le dernier segment de l'URL — « admin » — au lieu du
  // tableau de bord.
  const route = stripLocale(pathname)
  const href = (path: string) => localePath(locale, path)
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const searchRef = React.useRef<HTMLInputElement>(null)

  // Le raccourci annonce par le badge existe reellement : afficher « ⌘K » sans
  // le brancher serait une promesse en toc.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // La pastille compte les **dossiers en attente**, pas les files. Elle
  // comptait les files (`tasks.length`) : deux signalements tiennent sur une
  // seule ligne (« 2 signalements a instruire »), donc le chiffre restait a 1
  // pendant que la file grossissait — une pastille qui ne bouge pas se lit
  // comme une pastille en panne. C'est aussi ce que comptent deja les
  // pastilles du rail, qui additionnent les dossiers de leur section : les
  // deux disaient donc deux choses differentes.
  // Seuls les dossiers arrives depuis la derniere ouverture de la cloche sont
  // comptes : la liste deroulee, elle, montre toujours tout ce qui attend.
  const { unseen: pending, markSeen } = useQueueSeen(tasks, user.email)
  const total = tasks.reduce((sum, task) => sum + task.count, 0)
  // La recherche ⌘K menait toujours a `/admin/utilisateurs?q=...`, un ecran
  // qu'un editeur (`blog.manage` seul, pas `users.read`) ne peut pas ouvrir.
  // Plutot que de la repointer vers le Blog, elle disparait pour ce compte :
  // la recherche d'articles vit maintenant dans la barre de filtre de
  // `/admin/blog` elle-meme (`FilterBar instant`), qui est deja la ou on
  // regarde les resultats — un deuxieme champ de recherche dans l'en-tete
  // n'aurait fait que dupliquer le meme geste.
  const search = permissions.includes("users.read")
    ? { path: "/admin/utilisateurs", label: dict.header.searchLabel, placeholder: dict.header.searchPlaceholder }
    : null

  function runSearch(value: string) {
    if (!search) return
    const trimmed = value.trim()
    router.push(trimmed ? `${href(search.path)}?q=${encodeURIComponent(trimmed)}` : href(search.path))
  }

  // Recherche automatique et instantanee : on navigue des que la frappe
  // s'arrete, y compris pour un champ vide — sinon vider le champ laissait
  // la liste filtree affichee sans rien pour la recharger. Le debounce (150
  // ms, sous le seuil ou un delai se voit) evite seulement de naviguer a
  // chaque caractere tape trop vite pour compter. `previousQueryRef` empeche
  // ce meme effet de relancer une recherche vide au premier rendu, ou l'etat
  // initial ("") ne represente pas un champ qu'on vient de vider.
  const previousQueryRef = React.useRef("")
  React.useEffect(() => {
    const changed = query !== previousQueryRef.current
    previousQueryRef.current = query
    if (!changed) return
    const timeout = setTimeout(() => runSearch(query), 150)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const title =
    route === "/admin"
      ? dict.header.dashboard
      : route.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ??
        dict.header.fallbackTitle
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border bg-secondary transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-2 px-3 sm:px-5 lg:px-6">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto md:hidden"
        />
        <h1 className="text-sm font-semibold capitalize sm:text-base lg:hidden">{title}</h1>
        {search ? (
          <form className="relative ml-1 hidden w-full max-w-sm lg:block" onSubmit={(event) => { event.preventDefault(); runSearch(query); }}>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border bg-secondary px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">⌘K</kbd>
            <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} aria-label={search.label} placeholder={search.placeholder} className="h-8 w-full rounded-md border border-border bg-card pr-14 pl-9 text-[0.6875rem] text-foreground outline-none placeholder:text-muted-foreground focus:border-brand/50" />
          </form>
        ) : null}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Meme place que sur le site public : le selecteur de langue
              precede immediatement la cloche, dans la grappe de droite. */}
          <LanguageMenu />
          {showBell ? (
          <DropdownMenu onOpenChange={markSeen}>
            <DropdownMenuTrigger
              aria-label={dict.header.bellLabel}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "relative cursor-pointer rounded-full border border-border bg-card",
              )}
            >
              <BellIcon className="size-4" />
              {pending > 0 ? (
                <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-foreground tabular-nums">
                  {pending > 99 ? "99+" : pending}
                </span>
              ) : null}
            </DropdownMenuTrigger>

            {/* `--popover` a `#000000` : rendu dans un portail hors de
                `.admin-dashboard-shell`, le menu prenait le gris general
                (`#1B1B1D`) — meme correction que le menu de langue. */}
            <DropdownMenuContent
              align="end"
              className="w-(--available-width) max-w-[min(24rem,calc(100vw-1.5rem))] p-0 [--popover:#000000]"
            >
              <div className="flex items-start gap-3 border-b border-border px-4 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-brand ring-1 ring-brand/25">
                  <BellIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm font-bold">{dict.header.queueTitle}</p>
                  <p className="text-[0.6875rem] leading-snug text-muted-foreground">{dict.header.queueHint}</p>
                </div>
                {/* Le total de la file entiere, pas seulement des nouveaux :
                    la pastille de la cloche s'eteint une fois vue, ce chiffre
                    dit ce qui reste a traiter. */}
                {total > 0 ? (
                  <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-bold text-brand-foreground tabular-nums">
                    {total > 99 ? "99+" : total}
                  </span>
                ) : null}
              </div>

              {tasks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand/12 text-brand">
                    <CheckCircle2Icon className="size-5" />
                  </span>
                  <p className="text-xs text-muted-foreground">{dict.header.queueEmpty}</p>
                </div>
              ) : (
                <ul className="max-h-96 space-y-1 overflow-y-auto p-1.5">
                  {tasks.map((task) => {
                    const { icon: TaskIcon, critical } = TASK_STYLE[task.key] ?? DEFAULT_TASK_STYLE;
                    return (
                      <li key={task.key}>
                        <Link
                          href={href(task.href)}
                          className="group/task flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-secondary/70 focus-visible:bg-secondary/70 focus-visible:outline-none"
                        >
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-lg",
                              critical ? "bg-destructive/12 text-destructive" : "bg-secondary text-muted-foreground group-hover/task:text-brand",
                            )}
                          >
                            <TaskIcon className="size-4" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-xs font-semibold">{task.label}</span>
                            <span className="micro-label truncate text-muted-foreground">{task.section}</span>
                          </span>
                          <span
                            className={cn(
                              "flex min-w-6 shrink-0 justify-center rounded-full px-1.5 py-0.5 text-[0.6875rem] font-bold tabular-nums",
                              critical ? "bg-destructive/15 text-destructive" : "bg-brand/15 text-brand",
                            )}
                          >
                            {task.count > 99 ? "99+" : task.count}
                          </span>
                          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover/task:translate-x-0.5 group-hover/task:text-foreground" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              {permissions.includes("notifications.manage") ? (
                <div className="border-t border-border p-1.5">
                  <Link
                    href={href("/admin/notifications")}
                    className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                  >
                    <MegaphoneIcon className="size-3.5" />
                    {dict.header.campaigns}
                  </Link>
                </div>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          ) : null}
          <div className="hidden items-center gap-2.5 sm:flex">
            {/* Meme repli que le bloc compte du rail : aucune photo n'est jamais
                passee, et les initiales d'une adresse e-mail se resument a une
                lettre. */}
            <Avatar size="sm" className="rounded-lg">
              <AvatarFallback className="rounded-lg bg-transparent">
                <BrandMark size={24} className="size-full" />
              </AvatarFallback>
            </Avatar>
            <div className="hidden leading-tight md:block">
              <p className="max-w-36 truncate text-xs font-semibold lg:text-sm">{user.name}</p>
              <p className="micro-label text-brand">{user.roleLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
