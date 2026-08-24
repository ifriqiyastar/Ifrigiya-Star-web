import { Field, FieldGrid } from "@/components/admin/forms/field";
import { ServerForm } from "@/components/admin/server-form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { saveScoutDay } from "@/lib/actions/scout-days";

export type ScoutDayFormValue = {
  id?: string;
  title?: string | null;
  description?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  capacity?: number | null;
  eligibility_criteria?: string | null;
  is_paid?: boolean | null;
  price_amount?: number | null;
  price_currency?: string | null;
};

export function ScoutDayForm({ value, submitLabel, onSuccess }: { value?: ScoutDayFormValue; submitLabel: string; onSuccess?: () => void }) {
  return (
    <ServerForm action={saveScoutDay} submitLabel={submitLabel} onSuccess={onSuccess} className="space-y-5 p-4 sm:p-5">
      {value?.id ? <input type="hidden" name="id" value={value.id} /> : null}
      <FieldGrid>
        <Field label="Titre" htmlFor="title"><Input id="title" name="title" defaultValue={value?.title ?? ""} required /></Field>
        <Field label="Lieu" htmlFor="location"><Input id="location" name="location" defaultValue={value?.location ?? ""} required /></Field>
        <Field label="Date" htmlFor="event_date"><Input id="event_date" name="event_date" type="date" defaultValue={value?.event_date?.slice(0, 10) ?? ""} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Debut" htmlFor="start_time"><Input id="start_time" name="start_time" type="time" defaultValue={value?.start_time?.slice(0, 5) ?? ""} /></Field>
          <Field label="Fin" htmlFor="end_time"><Input id="end_time" name="end_time" type="time" defaultValue={value?.end_time?.slice(0, 5) ?? ""} /></Field>
        </div>
        <Field label="Capacite" htmlFor="capacity" hint="Vide = sans limite"><Input id="capacity" name="capacity" type="number" min="1" defaultValue={value?.capacity ?? ""} /></Field>
        <Field label="Devise" htmlFor="price_currency"><NativeSelect id="price_currency" name="price_currency" defaultValue={value?.price_currency ?? "TND"}><option value="TND">TND</option><option value="EUR">EUR</option><option value="USD">USD</option></NativeSelect></Field>
        <Field label="Tarification" htmlFor="is_paid"><label className="flex h-10 items-center gap-2 text-sm"><input id="is_paid" name="is_paid" type="checkbox" defaultChecked={Boolean(value?.is_paid)} /> Evenement payant</label></Field>
        <Field label="Prix" htmlFor="price_amount"><Input id="price_amount" name="price_amount" type="number" min="0" step="0.001" defaultValue={value?.price_amount ?? 0} /></Field>
      </FieldGrid>
      <Field label="Description" htmlFor="description"><Textarea id="description" name="description" defaultValue={value?.description ?? ""} /></Field>
      <Field label="Criteres d'eligibilite" htmlFor="eligibility_criteria"><Textarea id="eligibility_criteria" name="eligibility_criteria" defaultValue={value?.eligibility_criteria ?? ""} /></Field>
    </ServerForm>
  );
}
