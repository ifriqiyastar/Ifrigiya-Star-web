"use client"

import Link from "next/link"
import * as React from "react"

import { NAV_ITEMS, type NavBadges } from "@/components/admin/nav-items"
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
  SidebarTrigger,
} from "@/components/ui/sidebar"
import type { AdminPermission } from "@/lib/auth"
import type { AdminTask, NextAdminEvent } from "@/lib/queries/admin-queue"
import type { Diagnostic } from "@/lib/queries/diagnostics"

export function AppSidebar({
  user,
  badges,
  permissions,
  diagnostics = [],
  tasks = [],
  nextEvent = null,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; roleLabel?: string; avatar?: string }
  badges: NavBadges
  permissions: AdminPermission[]
  /** Defauts de configuration a signaler. Liste vide = rien ne s'affiche. */
  diagnostics?: Diagnostic[]
  tasks?: AdminTask[]
  nextEvent?: NextAdminEvent | null
}) {
  const items = NAV_ITEMS.filter((item) => permissions.includes(item.permission)).map((item) => ({
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
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex h-10 items-center gap-2">
          <SidebarMenu className="min-w-0 flex-1">
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
          <SidebarTrigger className="size-7 shrink-0 rounded-lg border border-sidebar-border bg-secondary/60 text-sidebar-foreground/70 hover:bg-secondary hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-3">
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
      <SidebarFooter className="gap-2.5 p-3">
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
