import type { Metadata } from "next";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { ServerForm } from "@/components/admin/server-form";
import { StatusPill } from "@/components/admin/status-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteEvaluation, saveEvaluation, setEvaluationVisibility } from "@/lib/actions/evaluations";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Evaluations" };

export default async function EvaluationsPage() {
  await requirePermission("evaluations.manage");
  const supabase = await createClient();
  const [{ data: evaluations, error }, { data: registrations }, { data: scoutDays }] = await Promise.all([
    supabase.from("scout_evaluations").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("scout_day_registrations").select("id, player_id, scout_day_id").limit(1000),
    supabase.from("scout_days").select("id, title").order("event_date", { ascending: false }).limit(1000),
  ]);
  const registrationById = new Map((registrations ?? []).map((row) => [row.id, row]));
  const profiles = await fetchProfilesByIds(
    (registrations ?? []).map((row) => row.player_id).filter(Boolean),
  );
  const scoutDayById = new Map((scoutDays ?? []).map((row) => [row.id, row.title]));

  return (
    <>
      <PageHeader kicker="Scouting" title="Evaluations" description="Notes techniques, physiques, tactiques et mentales. La note globale est toujours calculee cote serveur." />
      <Panel>
        <PanelHeader title="Nouvelle evaluation" description="Choisissez le joueur et son Scout Day, puis saisissez quatre notes sur 100." />
        <ServerForm action={saveEvaluation} submitLabel="Creer l'evaluation" className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="registration_id">Joueur et Scout Day</Label>
            <NativeSelect id="registration_id" name="registration_id" required>
              <option value="">Selectionner une inscription</option>
              {(registrations ?? []).map((registration) => {
                const profile = profiles.get(registration.player_id);
                return (
                  <option key={registration.id} value={registration.id}>
                    {profile?.full_name ?? profile?.email ?? "Joueur"} — {scoutDayById.get(registration.scout_day_id) ?? "Scout Day"}
                  </option>
                );
              })}
            </NativeSelect>
          </div>
          <Field label="Technique" name="technical_score" type="number" min="0" max="100" required />
          <Field label="Physique" name="physical_score" type="number" min="0" max="100" required />
          <Field label="Tactique" name="tactical_score" type="number" min="0" max="100" required />
          <Field label="Mental" name="mental_score" type="number" min="0" max="100" required />
          <div className="space-y-2 md:col-span-2 xl:col-span-3"><Label htmlFor="report">Rapport</Label><Textarea id="report" name="report" /></div>
          <div className="space-y-2 md:col-span-2 xl:col-span-4"><Label htmlFor="comments">Commentaires internes</Label><Textarea id="comments" name="comments" /></div>
        </ServerForm>
      </Panel>
      <Panel>
        <PanelHeader title="Historique des evaluations" description="Publication reversible et historique conserve dans le journal d'audit." />
        {error ? <p className="p-5 text-sm text-destructive">{error.message}</p> : !evaluations?.length ? <EmptyState title="Aucune evaluation" description="Les evaluations creees apparaitront ici." /> : (
          <Table><TableHeader><TableRow><TableHead>Joueur</TableHead><TableHead>Tech.</TableHead><TableHead>Phys.</TableHead><TableHead>Tact.</TableHead><TableHead>Mental</TableHead><TableHead>Global</TableHead><TableHead>Visibilite</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{evaluations.map((row) => { const registration = registrationById.get(row.registration_id); const profile = registration ? profiles.get(registration.player_id) : undefined; return <TableRow key={row.id}><TableCell>{profile?.full_name ?? registration?.player_id ?? "—"}</TableCell><TableCell>{row.technical_score}</TableCell><TableCell>{row.physical_score}</TableCell><TableCell>{row.tactical_score}</TableCell><TableCell>{row.mental_score}</TableCell><TableCell className="font-semibold text-brand">{row.overall_score}</TableCell><TableCell><StatusPill tone={row.visible_to_player ? "success" : "neutral"}>{row.visible_to_player ? "Publiee" : "Privee"}</StatusPill></TableCell><TableCell>{formatDate(row.created_at)}</TableCell><TableCell><div className="flex gap-2"><ActionButton action={setEvaluationVisibility.bind(null, row.id, !row.visible_to_player)}>{row.visible_to_player ? "Masquer" : "Publier"}</ActionButton><ActionButton action={deleteEvaluation.bind(null, row.id)} variant="destructive" confirm={{ title: "Supprimer l'evaluation ?", description: "Cette operation est definitive." }}>Supprimer</ActionButton></div></TableCell></TableRow>; })}</TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} {...props} /></div>;
}
