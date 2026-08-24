"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { ArrowUpRightIcon, SearchIcon } from "lucide-react"

import { NAV_ITEMS, type NavBadges } from "@/components/admin/nav-items"
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

export function AppSidebar({ user, badges, permissions, ...props }: React.ComponentProps<typeof Sidebar> & { user: { name: string; email: string; avatar?: string }; badges: NavBadges; permissions: AdminPermission[] }) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const items = NAV_ITEMS.filter((item) => permissions.includes(item.permission)).map((item) => ({
    title: item.label,
    url: item.href,
    icon: <item.icon />,
    badge: item.badge ? badges[item.badge] : 0,
    section: item.section,
  }))

  return (
    <Sidebar collapsible="icon" className="admin-sidebar" {...props}>
      <SidebarHeader className="px-3 pt-4 pb-2">
        <div className="flex h-11 items-center gap-2">
          <SidebarMenu className="min-w-0 flex-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-11 rounded-full p-1! hover:bg-white/5 group-data-[collapsible=icon]:p-0!"
                tooltip="Ifriqiya Star"
                render={<Link href="/admin" />}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-[9px] font-black text-primary-foreground shadow-[0_0_20px_rgba(175,247,15,0.22)]">
                  IS
                </span>
                <span className="font-heading text-[0.8125rem] font-extrabold tracking-wide">
                  IFRIQIYA STAR
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger className="size-8 shrink-0 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-2">
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter className="gap-2.5 p-3">
        <form
          className="sidebar-search-card group relative overflow-hidden rounded-2xl border border-primary/15 bg-primary/10 p-3 group-data-[collapsible=icon]:hidden"
          onSubmit={(event) => {
            event.preventDefault()
            if (query.trim()) {
              router.push(`/admin/utilisateurs?q=${encodeURIComponent(query.trim())}`)
            }
          }}
        >
          <div className="pointer-events-none absolute -top-8 -right-7 size-24 rounded-full bg-primary/30 blur-2xl" />
          <div className="relative mb-3 flex size-11 items-center justify-center rounded-full border border-primary/35 bg-[radial-gradient(circle_at_35%_30%,#eaff9d,#87d900_42%,#1f5f12_75%)] shadow-[0_0_24px_rgba(175,247,15,0.32)]">
            <SearchIcon className="size-4 text-black" />
          </div>
          <label htmlFor="sidebar-user-search" className="mb-1.5 block text-[0.625rem] font-semibold tracking-[0.16em] text-white/55 uppercase">
            Recherche rapide
          </label>
          <div className="relative">
            <input
              id="sidebar-user-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom ou email..."
              className="h-9 w-full rounded-full border border-white/10 bg-black/35 pr-9 pl-3 text-[0.6875rem] text-white outline-none placeholder:text-white/35 focus:border-primary/70"
            />
            <button
              type="submit"
              aria-label="Rechercher"
              className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-black transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ArrowUpRightIcon className="size-3.5" />
            </button>
          </div>
        </form>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
