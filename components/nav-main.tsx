"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
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
export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    badge?: number
    badgeTone?: "brand" | "danger"
    section: string
  }[]
}) {
  const pathname = usePathname()
  return (
    <SidebarGroup className="p-0">
      {/* Repli en mode icone : la regle de base compense un intitule de 2rem
          par une marge negative, ce que cette variante a hauteur libre ne
          verifie pas — elle remontait donc la liste sous l'en-tete. */}
      <SidebarGroupLabel className="micro-label h-auto px-2 pb-2 text-muted-foreground/80 group-data-[collapsible=icon]:hidden">
        Navigation operationnelle
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const isActive =
              item.url === "/admin" ? pathname === "/admin" : pathname.startsWith(item.url)

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  className={cn(
                    "h-9 gap-2.5 rounded-lg px-2.5 text-[0.8125rem] font-medium text-sidebar-foreground/70",
                    "hover:bg-secondary hover:text-sidebar-foreground",
                    "data-active:bg-brand/12 data-active:font-semibold data-active:text-brand",
                    "data-active:shadow-[inset_2px_0_0_0_var(--brand)]",
                  )}
                  tooltip={item.title}
                  isActive={isActive}
                  render={<Link href={item.url} />}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-4">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.badge ? (
                    <span
                      className={cn(
                        "ml-auto flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums group-data-[collapsible=icon]:hidden",
                        item.badgeTone === "danger"
                          ? "bg-destructive text-white"
                          : "bg-brand/20 text-brand",
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
