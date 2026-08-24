import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAdminAccess, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Toutes les pages du back-office passent par ici, donc par `requireAdmin()`.
 * Ce n'est pas la seule barriere : chaque Server Action refait le controle, et
 * le RLS Postgres (`public.is_admin()`) reste le dernier mot.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  // Compteurs des files d'attente, affiches dans la navigation.
  const [players, professionals, reports, access] = await Promise.all([
    supabase
      .from("player_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente_validation"),
    supabase
      .from("professional_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente_validation"),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "en_attente"),
    getAdminAccess(admin.userId),
  ]);

  const badges = {
    validations: (players.count ?? 0) + (professionals.count ?? 0),
    signalements: reports.count ?? 0,
  };

  return (
    <SidebarProvider
      className="admin-dashboard-shell"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 66)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="sidebar"
        user={{ name: admin.fullName ?? "Administrateur", email: admin.email ?? "" }}
        badges={badges}
        permissions={access.permissions}
      />
      <SidebarInset>
        <SiteHeader
          user={{
            name: admin.fullName ?? "Administrateur",
            email: admin.email ?? "",
            roleLabel: access.roleLabel,
          }}
        />
        <div className="@container/main flex flex-1 flex-col">
          <main className="admin-content flex flex-1 flex-col gap-4 p-3 sm:gap-5 sm:p-5 lg:gap-6 lg:p-6">
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
