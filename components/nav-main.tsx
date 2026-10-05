"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import { ChevronRightIcon } from "lucide-react"
import { LinkPendingIcon } from "@/components/admin/link-pending-icon"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { stripLocale } from "@/lib/i18n/config"
import { useAdminI18n } from "@/lib/i18n/admin-client"
import { cn } from "@/lib/utils"

/**
 * Rail de navigation des maquettes de septembre 2026 : une liste compacte sous
 * un intitule en capitales espacees, l'element actif signale par un fond lime
 * tres sourd et un liseré a gauche plutot que par un bouton plein.
 *
 * L'ordre est celui de `NAV_ITEMS`, donc celui du cahier des charges : les
 * sections ne sont pas regroupees, pour ne pas eloigner « Abonnements » de la
 * suite operationnelle ou le client s'attend a le trouver.
 */
type NavChild = {
  title: string
  url: string
  /**
   * ⚠️ L'icone d'une sous-entree n'est pas decorative. Depliee, la section
   * aligne quatre libelles sans aucun repere : « Publications »,
   * « Commentaires », « Medias joueurs » se lisent tous pareil du coin de
   * l'oeil, et on les distingue en les lisant. L'icone rend la ligne
   * reconnaissable a la forme, comme les entrees de premier niveau.
   */
  icon?: React.ReactNode
  badge?: number
  badgeTone?: "brand" | "danger"
}

export type NavEntry = {
  title: string
  url: string
  icon?: React.ReactNode
  badge?: number
  badgeTone?: "brand" | "danger"
  section: string
  /** Sous-entrees d'un groupe depliable. Absentes = ligne simple. */
  children?: NavChild[]
}

/** Pastille de compteur, identique sur une ligne et sur une sous-ligne. */
function NavBadge({ value, tone }: { value?: number; tone?: "brand" | "danger" }) {
  if (!value) return null
  return (
    <span
      className={cn(
        "ml-auto flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums group-data-[collapsible=icon]:hidden",
        tone === "danger" ? "bg-destructive text-white" : "bg-brand/20 text-brand",
      )}
    >
      {value}
    </span>
  )
}

export function NavMain({ items }: { items: NavEntry[] }) {
  const pathname = usePathname()
  const { dict } = useAdminI18n()
  // ⚠️ `usePathname()` rend l'adresse du navigateur, prefixe de langue compris
  // (`/en/admin/moderation`), alors que `NAV_ITEMS` porte des chemins nus.
  // Sans ce retrait, l'element actif n'etait jamais surligne en anglais ni en
  // arabe — et le groupe depliable ne se serait jamais ouvert tout seul.
  const current = stripLocale(pathname)

  return (
    <SidebarGroup className="p-0">
      {/* Repli en mode icone : la regle de base compense un intitule de 2rem
          par une marge negative, ce que cette variante a hauteur libre ne
          verifie pas — elle remontait donc la liste sous l'en-tete. */}
      <SidebarGroupLabel className="micro-label h-auto px-2 pb-2 text-muted-foreground/80 group-data-[collapsible=icon]:hidden">
        {dict.nav.groupLabel}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => (
            <NavRow key={item.title} item={item} current={current} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

const ROW_CLASS = cn(
  "h-9 gap-2.5 rounded-lg px-2.5 text-[0.8125rem] font-medium text-sidebar-foreground/70",
  "hover:bg-secondary hover:text-sidebar-foreground",
  "data-active:bg-brand/12 data-active:font-semibold data-active:text-brand",
  "data-active:shadow-[inset_2px_0_0_0_var(--brand)]",
)

/**
 * Une ligne du rail : un lien, ou un groupe qui se deplie.
 *
 * QUAND IL Y A DES ENFANTS, LA LIGNE PARENTE NE NAVIGUE PAS — elle ouvre et
 * ferme. Une ligne qui ferait les deux au meme clic est un piege : on vise
 * « deplier » et on change d'ecran. Rien n'est perdu au passage, la route
 * parente ne faisant que rediriger vers le premier enfant.
 *
 * Le groupe s'ouvre tout seul quand on est dedans, et peut ensuite etre
 * referme a la main : l'effet ne se rejoue qu'au *changement* d'etat actif,
 * pas a chaque rendu.
 */
function NavRow({ item, current }: { item: NavEntry; current: string }) {
  const { dict } = useAdminI18n()
  const { state, isMobile } = useSidebar()
  // ⚠️ RAIL REPLIE EN ICONES : `SidebarMenuSub` y est masque par la feuille de
  // style. Un parent qui ne ferait que deplier n'y produirait donc **rien du
  // tout** au clic — alors qu'avant il menait a la section. Dans cet etat il
  // redevient un lien ; la route parente redirige vers le premier enfant.
  const iconOnly = state === "collapsed" && !isMobile
  const isActive = item.url === "/admin" ? current === "/admin" : current.startsWith(item.url)
  // Ajustement pendant le rendu plutot qu'un effet : c'est le motif que React
  // documente pour « un etat derive d'une prop qui change », et il evite le
  // rendu supplementaire — plus un `setState` dans un effet, que la regle
  // `react-hooks/set-state-in-effect` refuse a juste titre.
  const [open, setOpen] = React.useState(isActive)
  const [wasActive, setWasActive] = React.useState(isActive)
  if (wasActive !== isActive) {
    setWasActive(isActive)
    // On ouvre en entrant dans la section ; on ne referme pas en sortant, pour
    // ne pas defaire un depliage fait a la main.
    if (isActive) setOpen(true)
  }

  const badge = <NavBadge value={item.badge} tone={item.badgeTone} />
  const icon = (
    <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-4">
      {item.icon}
    </span>
  )

  if (!item.children?.length || iconOnly) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          className={ROW_CLASS}
          tooltip={item.title}
          isActive={isActive}
          render={<Link href={item.url} />}
        >
          {icon}
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          {badge}
          {/* `render={<Link />}` plus haut fait de ce composant un enfant React
              du lien malgre le passage par le slot `useRender` de
              `SidebarMenuButton` — c'est ce qui rend `useLinkStatus()`
              utilisable ici. */}
          <LinkPendingIcon className="ml-auto text-brand group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  const panelId = `nav-${item.url.replace(/\W+/g, "-")}`

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className={ROW_CLASS}
        tooltip={item.title}
        // Le parent reste signale quand il est ferme : sinon un groupe replie
        // sur l'ecran courant n'aurait plus aucune marque.
        isActive={isActive && !open}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
        {/* Le compteur du groupe disparait quand il est ouvert : la meme file
            est alors chiffree sur sa propre ligne, juste en dessous, et deux
            fois le meme nombre se lit comme deux files. */}
        {open ? null : badge}
        <ChevronRightIcon
          aria-hidden
          className={cn(
            "ml-auto size-3.5 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
            open && "rotate-90",
          )}
        />
        <span className="sr-only">{i18nExpand(dict, item.title)}</span>
      </SidebarMenuButton>

      {open ? (
        <SidebarMenuSub id={panelId}>
          {item.children.map((child) => {
            const childActive = current.startsWith(child.url)
            return (
              <SidebarMenuSubItem key={child.url}>
                <SidebarMenuSubButton
                  size="sm"
                  isActive={childActive}
                  className={cn(
                    "rounded-md text-[0.8125rem] text-sidebar-foreground/70",
                    "data-active:bg-brand/12 data-active:font-semibold data-active:text-brand",
                  )}
                  render={<Link href={child.url} />}
                >
                  {/* Les icones des sous-entrees sont plus discretes que
                      celles des sections : elles reperent la ligne, elles ne
                      concurrencent pas le niveau au-dessus. */}
                  {child.icon ? (
                    <span className="shrink-0 opacity-70 [&_svg]:size-3.5">{child.icon}</span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{child.title}</span>
                  <NavBadge value={child.badge} tone={child.badgeTone} />
                  {/* `SidebarMenuSubButton` force `[&>svg]:text-sidebar-accent-foreground`
                      (noir), pense pour son fond de survol lime : des que la
                      souris passait sur une autre sous-entree pendant le
                      chargement, le spinner restait noir sur le fond sombre
                      et disparaissait. Lime au repos, noir sur sa propre ligne
                      survolee — d'ou le `!`, plus fort que le selecteur enfant. */}
                  <LinkPendingIcon className="ml-auto text-brand! [a:hover>&]:text-sidebar-accent-foreground!" />
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  )
}

/** « Deplier ou replier Moderation », pour qui n'a que le lecteur d'ecran. */
const i18nExpand = (dict: { nav: { expand: string } }, title: string) =>
  dict.nav.expand.replace("{0}", title)
