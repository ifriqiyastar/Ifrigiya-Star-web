import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { ServerForm } from "@/components/admin/server-form";
import { StatusPill } from "@/components/admin/status-pill";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignAdminRole } from "@/lib/actions/admin-access";
import { requirePermission } from "@/lib/auth";
import { fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Acces administrateurs" };

export default async function AdminAccessPage() {
  await requirePermission("admins.manage");
  const supabase = await createClient();
  const [rolesResult, assignmentsResult, adminsResult] = await Promise.all([
    supabase.from("admin_roles").select("id, code, label, description").order("label"),
    supabase.from("admin_user_roles").select("admin_id, role_id, assigned_at"),
    supabase.from("profiles").select("id").eq("role", "admin"),
  ]);
  const roles = rolesResult.data ?? [];
  const admins = await fetchProfilesByIds((adminsResult.data ?? []).map((row) => row.id));
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const assignmentByAdmin = new Map((assignmentsResult.data ?? []).map((row) => [row.admin_id, row]));

  return <><PageHeader kicker="Securite" title="Roles et permissions" description="Separez validation, moderation, evenements, finances, support et administration. Chaque droit est aussi controle cote serveur." />
    {rolesResult.error ? <Panel><p className="p-5 text-sm text-destructive">Appliquez la migration RBAC pour activer ce module : {rolesResult.error.message}</p></Panel> : <>
      <Panel><PanelHeader title="Attribuer un role" description="Reserve aux super-administrateurs. Un administrateur ne peut pas modifier son propre role." />
        <ServerForm action={assignAdminRole} submitLabel="Attribuer" className="grid gap-4 p-5 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="profile_id">Administrateur</Label><NativeSelect id="profile_id" name="profile_id" required><option value="">Selectionner</option>{[...admins.values()].map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.email ?? profile.id}</option>)}</NativeSelect></div>
          <div className="space-y-2"><Label htmlFor="role_id">Role</Label><NativeSelect id="role_id" name="role_id" required><option value="">Selectionner</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</NativeSelect></div>
        </ServerForm>
      </Panel>
      <Panel><PanelHeader title="Administrateurs" /><Table><TableHeader><TableRow><TableHead>Compte</TableHead><TableHead>Role</TableHead><TableHead>Description</TableHead></TableRow></TableHeader><TableBody>{[...admins.values()].map((profile) => { const assignment = assignmentByAdmin.get(profile.id); const role = assignment ? roleById.get(assignment.role_id) : undefined; return <TableRow key={profile.id}><TableCell><p className="font-medium">{profile.full_name ?? "Administrateur"}</p><p className="text-xs text-muted-foreground">{profile.email}</p></TableCell><TableCell><StatusPill tone={role?.code === "super_admin" ? "warning" : "info"}>{role?.label ?? "Role non attribue"}</StatusPill></TableCell><TableCell>{role?.description ?? "Acces historique complet jusqu'a attribution d'un role."}</TableCell></TableRow>; })}</TableBody></Table></Panel>
    </>}
  </>;
}
