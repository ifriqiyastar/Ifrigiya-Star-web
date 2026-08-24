"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRightIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    badge?: number
    section: string
  }[]
}) {
  const pathname = usePathname()
  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <SidebarMenu className="gap-1.5">
          {items.map((item) => {
            const isActive = item.url === "/admin" ? pathname === "/admin" : pathname.startsWith(item.url)

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  className="h-10 rounded-full border border-white/[0.06] bg-white/[0.055] px-2.5 text-[0.75rem] font-medium text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:border-white/10 hover:bg-white/10 hover:text-white data-active:border-primary/60 data-active:bg-[linear-gradient(100deg,#d5ff4e_0%,#9cea18_52%,#68c907_100%)] data-active:font-semibold data-active:text-black data-active:shadow-[0_8px_24px_rgba(135,217,0,0.18)]"
                  tooltip={item.title}
                  isActive={isActive}
                  render={<Link href={item.url} />}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-black/20 group-data-[collapsible=icon]:size-4 [&>svg]:size-3.5">
                    {item.icon}
                  </span>
                  <span>{item.title}</span>
                  <span className="ml-auto flex items-center gap-1 group-data-[collapsible=icon]:hidden">
                    {item.badge ? (
                      <span className="flex min-w-5 items-center justify-center rounded-full bg-black/15 px-1.5 text-[0.625rem] font-bold tabular-nums">
                        {item.badge}
                      </span>
                    ) : null}
                    <span className="flex size-6 items-center justify-center rounded-full border border-current/10 bg-black/10">
                      <ChevronRightIcon className="size-3" />
                    </span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
