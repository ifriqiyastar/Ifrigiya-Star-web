"use client"

import Link from "next/link"
import * as React from "react"

import { NAV_ITEMS } from "@/components/admin/nav-items"
import { useAdminQueue } from "@/components/admin/queue-live"
import { RailDiagnostics } from "@/components/admin/rail-diagnostics"
import { TodayCard } from "@/components/admin/today-card"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import type { AdminPermission } from "@/lib/auth"
import type { NextAdminEvent } from "@/lib/queries/admin-queue"
import type { Diagnostic } from "@/lib/queries/diagnostics"

export function AppSidebar({
  user,
  permissions,
  diagnostics = [],
  nextEvent = null,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; roleLabel?: string; avatar?: string }
  permissions: AdminPermission[]
  /** Defauts de configuration a signaler. Liste vide = rien ne s'affiche. */
  diagnostics?: Diagnostic[]
  nextEvent?: NextAdminEvent | null
}) {
  // Memes chiffres que la cloche, et vivants comme elle : les deux lisent le
  // meme instantane.
  const { tasks, badges } = useAdminQueue()
  const items = NAV_ITEMS.filter(
    // `permission: null` = accessible a tout administrateur (cf. nav-items.ts).
    (item) => item.permission === null || permissions.includes(item.permission),
  ).map((item) => ({
    title: item.label,
    url: item.href,
    icon: <item.icon />,
    badge: item.badge ? badges[item.badge] : 0,
    // Le rouge est reserve a la moderation : c'est la seule file ou un
    // element non traite reste visible du public.
    badgeTone: item.badge === "signalements" ? ("danger" as const) : ("brand" as const),
    section: item.section,
  }))

  return (
    <Sidebar collapsible="icon" className="admin-sidebar" {...props}>
      {/* En mode icone, le logo cede sa place au declencheur : c'est le seul
          endroit ou l'on peut redeployer le rail a la souris. Il etait masque
          la (`group-data-[collapsible=icon]:hidden`) et celui du bandeau est
          reserve au mobile (`md:hidden`) — une fois replie, le rail ne pouvait
          donc plus etre rouvert qu'au clavier (Ctrl/Cmd + B). */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3 group-data-[collapsible=icon]:px-1.5">
        <div className="flex h-10 items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-10 rounded-lg p-1! hover:bg-secondary group-data-[collapsible=icon]:p-0!"
                tooltip="Ifriqiya Star"
                render={<Link href="/admin" />}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#84cc16] font-heading text-[10px] font-black text-[#0b0e12]">
                  IS
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-heading truncate text-[0.8125rem] leading-tight font-extrabold tracking-wide">
                    IFRIQIYA STAR
                  </span>
                  <span className="micro-label text-brand">Scouting pro</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger
            aria-label="Reduire ou deployer le menu"
            title="Reduire ou deployer le menu (Ctrl + B)"
            className="size-7 shrink-0 rounded-lg border border-sidebar-border bg-secondary/60 text-sidebar-foreground/70 hover:bg-secondary hover:text-sidebar-foreground"
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-3 group-data-[collapsible=icon]:px-2">
        <NavMain items={items} />
        {/* L'espace entre la navigation et le compte connecte ne porte que ce
            qui n'est nulle part ailleurs : les defauts d'installation, qui
            degradent l'application en silence. Rien a signaler = rien a
            afficher. */}
        <div className="mt-auto space-y-3 pt-4 group-data-[collapsible=icon]:hidden">
          <TodayCard tasks={tasks} nextEvent={nextEvent} />
          <RailDiagnostics issues={diagnostics} />
        </div>
      </SidebarContent>
      <SidebarFooter className="gap-2.5 p-3 group-data-[collapsible=icon]:p-2">
        <NavUser user={user} />
      </SidebarFooter>
      {/* La bordure elle-meme devient cliquable : deuxieme prise pour replier
          et redeployer, sans avoir a viser le bouton de l'en-tete. */}
      <SidebarRail />
    </Sidebar>
  )
}
