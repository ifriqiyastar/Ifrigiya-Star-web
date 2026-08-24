import type { Metadata } from "next";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { NotificationTargetFields } from "@/components/admin/notification-target-fields";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { ServerForm } from "@/components/admin/server-form";
import { StatusPill } from "@/components/admin/status-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { retryNotification, sendNotification } from "@/lib/actions/notifications";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requirePermission("notifications.manage");
  const supabase = await createClient();
  const [{ data: campaigns, error }, { data: profiles }, { data: scoutDays }] = await Promise.all([
    supabase.from("admin_notification_campaigns").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("id, full_name, email, role").eq("is_active", true).order("full_name").limit(2000),
    supabase.from("scout_days").select("id, title, event_date").order("event_date", { ascending: false }).limit(1000),
  ]);
  const userOptions = (profiles ?? []).map((profile) => ({ id: profile.id, label: `${profile.full_name ?? profile.email ?? "Compte"} — ${profile.role}` }));
  const scoutDayOptions = (scoutDays ?? []).map((event) => ({ id: event.id, label: `${event.title} — ${formatDate(event.event_date)}` }));
  const userById = new Map(userOptions.map((option) => [option.id, option.label]));
  const scoutDayById = new Map(scoutDayOptions.map((option) => [option.id, option.label]));
  const targetLabel = (type: string, value: string | null) => {
    if (type === "all") return "Toute la plateforme";
    if (type === "role") return value === "player" ? "Tous les joueurs" : "Tous les professionnels";
    if (type === "user") return userById.get(value ?? "") ?? "Utilisateur supprime";
    if (type === "scout_day") return scoutDayById.get(value ?? "") ?? "Scout Day supprime";
    return value ?? type;
  };
  return <><PageHeader kicker="Communication" title="Notifications" description="Envois individuels ou segmentes par notification in-app, push et email, avec suivi de livraison." />
    <Panel><PanelHeader title="Nouvel envoi" description="Le worker de diffusion traite les campagnes placees en file." />
      <ServerForm action={sendNotification} submitLabel="Programmer l'envoi" className="grid gap-4 p-5 md:grid-cols-2">
        <Field label="Titre" name="title" required /><NotificationTargetFields users={userOptions} scoutDays={scoutDayOptions} />
        <div className="space-y-2 md:col-span-2"><Label>Canaux</Label><div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" name="channels" value="in_app" defaultChecked /> Dans l&apos;application</label><label><input type="checkbox" name="channels" value="push" /> Push</label><label><input type="checkbox" name="channels" value="email" /> Email</label></div></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="body">Message</Label><Textarea id="body" name="body" required /></div>
      </ServerForm></Panel>
    <Panel><PanelHeader title="Historique de livraison" />{error ? <p className="p-5 text-sm text-destructive">Appliquez la migration admin pour activer ce module : {error.message}</p> : !campaigns?.length ? <EmptyState title="Aucun envoi" description="Les campagnes apparaitront ici." /> : <Table><TableHeader><TableRow><TableHead>Campagne</TableHead><TableHead>Cible</TableHead><TableHead>Canaux</TableHead><TableHead>Statut</TableHead><TableHead>Livres / echecs</TableHead><TableHead>Date</TableHead><TableHead /></TableRow></TableHeader><TableBody>{campaigns.map((row) => <TableRow key={row.id}><TableCell><p className="font-medium">{row.title}</p><p className="max-w-80 truncate text-xs text-muted-foreground">{row.body}</p></TableCell><TableCell>{targetLabel(row.target_type, row.target_value)}</TableCell><TableCell>{(row.channels ?? []).join(", ")}</TableCell><TableCell><StatusPill tone={row.status === "sent" ? "success" : row.status === "failed" ? "danger" : "warning"}>{row.status}</StatusPill></TableCell><TableCell>{row.delivered_count ?? 0} / {row.failed_count ?? 0}</TableCell><TableCell>{formatDate(row.created_at)}</TableCell><TableCell>{row.status === "failed" ? <ActionButton action={retryNotification.bind(null, row.id)}>Reessayer</ActionButton> : null}</TableCell></TableRow>)}</TableBody></Table>}</Panel>
  </>;
}

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} {...props} /></div>; }
