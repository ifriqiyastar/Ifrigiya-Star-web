"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { BellIcon, SearchIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { initials } from "@/lib/format"

export function SiteHeader({ user }: { user: { name: string; email: string; roleLabel: string } }) {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const title = pathname === "/admin" ? "Tableau de bord" : pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "Administration"
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background sm:h-16 transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-2 px-3 sm:px-5 lg:px-6">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto md:hidden"
        />
        <h1 className="text-sm font-semibold capitalize sm:text-base lg:hidden">{title}</h1>
        <form className="relative ml-1 hidden w-full max-w-sm lg:block" onSubmit={(event) => { event.preventDefault(); if (query.trim()) router.push(`/admin/utilisateurs?q=${encodeURIComponent(query.trim())}`); }}>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Rechercher un utilisateur" placeholder="Rechercher un nom, email ou telephone..." className="h-9 w-full rounded-full border border-border bg-card pr-4 pl-9 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
        </form>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button nativeButton={false} render={<Link href="/admin/notifications" />} variant="ghost" size="icon-sm" aria-label="Ouvrir les notifications" className="rounded-full border border-border bg-card">
            <BellIcon className="size-4" />
          </Button>
          <div className="hidden items-center gap-2.5 sm:flex">
            <Avatar size="sm"><AvatarFallback className="bg-primary font-semibold text-primary-foreground">{initials(user.name || user.email)}</AvatarFallback></Avatar>
            <div className="hidden leading-tight md:block">
              <p className="max-w-36 truncate text-xs font-semibold lg:text-sm">{user.name}</p>
              <p className="text-[10px] text-muted-foreground">{user.roleLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
