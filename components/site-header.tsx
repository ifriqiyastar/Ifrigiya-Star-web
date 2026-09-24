"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { BellIcon, CheckCircle2Icon, ChevronRightIcon, SearchIcon } from "lucide-react"
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
import { LanguageMenu } from "@/components/admin/language-menu"
import type { AdminPermission } from "@/lib/auth"
import { initials } from "@/lib/format"
import { useAdminI18n } from "@/lib/i18n/admin-client"
import { localePath, stripLocale } from "@/lib/i18n/config"
import { cn } from "@/lib/utils"

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
 * Il n'y a donc plus de « marquer comme lu » : une tache disparait de la liste
 * quand elle est traitee, pas quand on la regarde.
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
  const pending = tasks.reduce((total, task) => total + task.count, 0)
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
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={dict.header.bellLabel}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "relative rounded-full border border-border bg-card",
              )}
            >
              <BellIcon className="size-4" />
              {pending > 0 ? (
                <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-foreground tabular-nums">
                  {pending > 99 ? "99+" : pending}
                </span>
              ) : null}
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-(--available-width) max-w-96 p-0">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">{dict.header.queueTitle}</p>
                <p className="text-[10px] text-muted-foreground">{dict.header.queueHint}</p>
              </div>

              {tasks.length === 0 ? (
                <p className="flex items-center justify-center gap-2 px-4 py-6 text-center text-xs text-muted-foreground">
                  <CheckCircle2Icon className="size-4 text-brand" />
                  {dict.header.queueEmpty}
                </p>
              ) : (
                <ul className="max-h-96 divide-y divide-border overflow-y-auto">
                  {tasks.map((task) => (
                    <li key={task.key}>
                      <Link
                        href={href(task.href)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/60"
                      >
                        <span className="flex min-w-8 shrink-0 justify-center rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold text-brand tabular-nums">
                          {task.count > 99 ? "99+" : task.count}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-xs font-medium">{task.label}</span>
                          <span className="text-[10px] text-muted-foreground">{task.section}</span>
                        </span>
                        <ChevronRightIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {permissions.includes("notifications.manage") ? (
                <div className="border-t border-border p-2">
                  <Link
                    href={href("/admin/notifications")}
                    className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "w-full")}
                  >
                    {dict.header.campaigns}
                  </Link>
                </div>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          ) : null}
          <div className="hidden items-center gap-2.5 sm:flex">
            <Avatar size="sm" className="rounded-lg"><AvatarFallback className="rounded-lg bg-primary font-semibold text-primary-foreground">{initials(user.name || user.email)}</AvatarFallback></Avatar>
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
