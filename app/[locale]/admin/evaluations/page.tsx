import { getAdminI18n } from "@/lib/i18n/admin";
import type { Metadata } from "next";
import {
  ActivityIcon,
  AwardIcon,
  BrainIcon,
  ClipboardCheckIcon,
  ClipboardPenIcon,
  EyeIcon,
  EyeOffIcon,
  GaugeIcon,
  HistoryIcon,
  ShieldCheckIcon,
  TargetIcon,
  WaypointsIcon,
} from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { EmptyState } from "@/components/admin/empty-state";
import { NoteCards } from "@/components/admin/note-cards";
import { HeaderMeta, PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { ServerForm } from "@/components/admin/server-form";
import { StatCard } from "@/components/admin/stat-card";
import { StatusPill } from "@/components/admin/status-pill";
import { UserCell } from "@/components/admin/user-cell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { saveEvaluation, setEvaluationVisibility } from "@/lib/actions/evaluations";
import { requirePermission } from "@/lib/auth";

import { fetchProfilesByIds } from "@/lib/queries/profiles";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const i18n = await getAdminI18n();
  return { title: i18n.t("Evaluations") };
}

const PAGE_SIZE = 20;

export default async function EvaluationsPage({
  searchParams,
}: PageProps<"/[locale]/admin/evaluations">) {
  const i18n = await getAdminI18n();

  await requirePermission("evaluations.manage");
  const resolved = await searchParams;
  const page = Math.max(
    1,
    Number(typeof resolved.page === "string" ? resolved.page : 1) || 1,
  );
  const supabase = await createClient();

  const [
    { data: evaluations, error, count },
    { data: registrations },
    { data: scoutDays },
    { data: evaluators },
    { count: publishedTotal },
  ] = await Promise.all([
    supabase
      .from("scout_evaluations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase
      .from("scout_day_registrations")
      .select("id, player_id, scout_day_id")
      .limit(1000),
    supabase
      .from("scout_days")
      .select("id, title")
      .order("event_date", { ascending: false })
      .limit(1000),
    // Seuls les comptes professionnels valides peuvent signer un rapport.
    supabase
      .from("professional_profiles")
      .select("id, contact_full_name, organization_name, professional_type")
      .eq("status", "valide")
      .order("contact_full_name")
      .limit(1000),
    supabase
      .from("scout_evaluations")
      .select("id", { count: "exact", head: true })
      .eq("visible_to_player", true),
  ]);

  const rows = evaluations ?? [];
  const registrationById = new Map(
    (registrations ?? []).map((row) => [row.id, row]),
  );
  const scoutDayById = new Map(
    (scoutDays ?? []).map((row) => [row.id, row.title]),
  );
  const evaluatorById = new Map(
    (evaluators ?? []).map((row) => [row.id, row]),
  );
  const profiles = await fetchProfilesByIds(
    (registrations ?? []).map((row) => row.player_id).filter(Boolean),
  );

  const total = count ?? 0;
  const published = publishedTotal ?? 0;
  const privateTotal = Math.max(0, total - published);
  const recentAverage = rows.length
    ? Math.round(
        rows.reduce((sum, row) => sum + Number(row.overall_score ?? 0), 0) /
          rows.length,
      )
    : 0;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: i18n.t("Scouting") }, { label: i18n.t("Evaluations") }]}
        title={i18n.t("Centre d'evaluation des talents")}
        meta={
          <HeaderMeta tone={privateTotal > 0 ? "brand" : "neutral"}>
            {i18n.t(privateTotal === 1 ? "{0} rapport prive" : "{0} rapports prives", { "0": i18n.format.formatNumber(privateTotal) })}
          </HeaderMeta>
        }
        description={i18n.t("Saisissez les observations terrain, mesurez les quatre dimensions du joueur et pilotez la publication des rapports depuis un espace unique.")}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={i18n.t("Rapports au total")}
          value={total}
          hint={i18n.t("Historique conserve")}
          icon={ClipboardCheckIcon}
        />
        <StatCard
          label={i18n.t("Rapports publies")}
          value={published}
          hint={total ? i18n.t("{0}% du total", { "0": Math.round((published / total) * 100) }) : i18n.t("Aucun rapport")}
          icon={EyeIcon}
          progress={total ? published / total : 0}
        />
        <StatCard
          label={i18n.t("Rapports prives")}
          value={privateTotal}
          hint={i18n.t("En attente de diffusion")}
          icon={EyeOffIcon}
          delta={privateTotal ? i18n.t("A reviser") : i18n.t("A jour")}
          deltaTone={privateTotal ? "warning" : "brand"}
        />
        <StatCard
          label={i18n.t("Score moyen recent")}
          value={rows.length ? `${recentAverage}/100` : "—"}
          hint={i18n.t("Sur les {0} rapports affiches", { "0": rows.length })}
          icon={GaugeIcon}
        />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Panel>
          <PanelHeader
            icon={ClipboardPenIcon}
            title={i18n.t("Nouvelle fiche d'evaluation")}
            description={i18n.t("Associez le rapport a une inscription et au professionnel qui le signe. L'evaluation reste privee jusqu'a sa publication.")}
            action={
              <span className="micro-label rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-brand">
                {i18n.t("Saisie terrain")}</span>
            }
          />

          <ServerForm
            action={saveEvaluation}
            submitLabel={i18n.t("Enregistrer l'evaluation")}
            className="grid gap-5 p-4 sm:p-5 md:grid-cols-2 [&>button:last-child]:col-span-full [&>button:last-child]:justify-self-end"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="registration_id" className="text-foreground">
                  {i18n.t("Joueur et Scout Day")}</Label>
                <StepBadge step="01" />
              </div>
              <NativeSelect
                id="registration_id"
                name="registration_id"
                required
                className="h-11 rounded-md border-border bg-input text-xs"
              >
                <option value="">{i18n.t("Selectionner une inscription")}</option>
                {(registrations ?? []).map((registration) => {
                  const profile = profiles.get(registration.player_id);
                  return (
                    <option key={registration.id} value={registration.id}>
                      {profile?.full_name ?? profile?.email ?? i18n.t("Joueur")} —{" "}
                      {scoutDayById.get(registration.scout_day_id) ?? i18n.t("Scout Day")}
                    </option>
                  );
                })}
              </NativeSelect>
              <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                {i18n.t("L’inscription relie automatiquement le joueur a la session observee.")}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="evaluator_id" className="text-foreground">
                  {i18n.t("Professionnel signataire")}</Label>
                <StepBadge step="02" />
              </div>
              <NativeSelect
                id="evaluator_id"
                name="evaluator_id"
                required
                className="h-11 rounded-md border-border bg-input text-xs"
              >
                <option value="">{i18n.t("Selectionner un evaluateur")}</option>
                {(evaluators ?? []).map((evaluator) => (
                  <option key={evaluator.id} value={evaluator.id}>
                    {evaluator.contact_full_name}
                    {evaluator.organization_name
                      ? ` — ${evaluator.organization_name}`
                      : ""}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                {i18n.t("Seul un professionnel valide peut porter la signature du rapport.")}</p>
            </div>

            <div className="space-y-3 md:col-span-2">
              <div className="flex flex-wrap items-end justify-between gap-2 border-t border-border pt-5">
                <div>
                  <p className="micro-label text-brand">{i18n.t("Grille de performance")}</p>
                  <h2 className="mt-1 font-heading text-base font-bold">
                    {i18n.t("Notes par domaine")}</h2>
                </div>
                <p className="text-[0.6875rem] text-muted-foreground">
                  {i18n.t("Quatre notes obligatoires, de 0 a 100")}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ScoreField
                  label={i18n.t("Technique")}
                  name="technical_score"
                  icon={TargetIcon}
                  hint={i18n.t("Gestuelle et maitrise")}
                />
                <ScoreField
                  label={i18n.t("Physique")}
                  name="physical_score"
                  icon={ActivityIcon}
                  hint={i18n.t("Intensite et endurance")}
                  tone="info"
                />
                <ScoreField
                  label={i18n.t("Tactique")}
                  name="tactical_score"
                  icon={WaypointsIcon}
                  hint={i18n.t("Lecture et placement")}
                  tone="warning"
                />
                <ScoreField
                  label={i18n.t("Mental")}
                  name="mental_score"
                  icon={BrainIcon}
                  hint={i18n.t("Decision et resilience")}
                  tone="success"
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="report" className="text-foreground">
                  {i18n.t("Rapport de scouting")}</Label>
                <StepBadge step="03" />
              </div>
              <Textarea
                id="report"
                name="report"
                rows={5}
                className="min-h-32 rounded-md border-border bg-input text-xs leading-relaxed"
                placeholder={i18n.t("Decrivez les points forts, les axes de progression, le potentiel observe et votre recommandation...")}
              />
              <p className="text-[0.6875rem] text-muted-foreground">
                {i18n.t("Privilegiez une observation factuelle, contextualisee et directement exploitable.")}</p>
            </div>
          </ServerForm>
        </Panel>

        <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Panel>
            <PanelHeader
              icon={AwardIcon}
              title={i18n.t("Cadre de notation")}
              description={i18n.t("Un langage commun pour comparer les rapports.")}
            />
            <div className="space-y-2 p-4">
              <RatingBand
                range="85–100"
                label={i18n.t("Impact immediat")}
                description={i18n.t("Niveau distinctif, pret a performer.")}
                tone="brand"
              />
              <RatingBand
                range="70–84"
                label={i18n.t("Fort potentiel")}
                description={i18n.t("Base solide, progression ciblee.")}
                tone="info"
              />
              <RatingBand
                range="50–69"
                label={i18n.t("A developper")}
                description={i18n.t("Qualites visibles, ecarts a combler.")}
                tone="warning"
              />
              <RatingBand
                range="0–49"
                label={i18n.t("En observation")}
                description={i18n.t("Niveau encore insuffisamment confirme.")}
                tone="danger"
              />
            </div>
          </Panel>

          <Panel highlighted>
            <div className="p-4">
              <span className="flex size-8 items-center justify-center rounded-md bg-brand/12 text-brand">
                <ShieldCheckIcon className="size-4" />
              </span>
              <p className="micro-label mt-4 text-brand">{i18n.t("Flux de validation")}</p>
              <h3 className="mt-1 font-heading text-sm font-bold">
                {i18n.t("Prive par defaut")}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {i18n.t("Enregistrer ne notifie pas le joueur. Relisez d’abord le rapport, puis utilisez l’action Publier dans l’historique.")}</p>
              <div className="mt-4 grid grid-cols-3 gap-1 text-center">
                {[
                  ["01", i18n.t("Saisir")],
                  ["02", i18n.t("Relire")],
                  ["03", i18n.t("Publier")],
                ].map(([step, label]) => (
                  <div key={step} className="rounded-md bg-secondary px-2 py-2">
                    <span className="micro-label text-brand">{step}</span>
                    <p className="mt-1 text-[0.625rem] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </aside>
      </section>

      <Panel>
        <PanelHeader
          icon={HistoryIcon}
          title={i18n.t("Registre des evaluations")}
          description={i18n.t("Les rapports les plus recents, leur score consolide et leur statut de diffusion.")}
          action={
            <span className="micro-label rounded-md border border-border bg-secondary px-2.5 py-1.5 text-muted-foreground">
              {i18n.t(total === 1 ? "{0} entree" : "{0} entrees", { "0": i18n.format.formatNumber(total) })}
            </span>
          }
        />

        {error ? (
          <p className="p-5 text-sm text-destructive">{error.message}</p>
        ) : !rows.length ? (
          <EmptyState
            icon={ClipboardCheckIcon}
            title={i18n.t("Aucune evaluation")}
            description={i18n.t("Les nouvelles fiches apparaitront ici apres leur enregistrement.")}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n.t("Joueur")}</TableHead>
                <TableHead>{i18n.t("Scout Day")}</TableHead>
                <TableHead>{i18n.t("Observation")}</TableHead>
                <TableHead>{i18n.t("Detail des notes")}</TableHead>
                <TableHead>{i18n.t("Global")}</TableHead>
                <TableHead>{i18n.t("Signataire")}</TableHead>
                <TableHead>{i18n.t("Visibilite")}</TableHead>
                <TableHead>{i18n.t("Date")}</TableHead>
                <TableHead className="text-right">{i18n.t("Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const registration = registrationById.get(row.registration_id);
                const profile = registration
                  ? profiles.get(registration.player_id)
                  : undefined;
                const evaluator = evaluatorById.get(row.evaluator_id);
                const overall = Number(row.overall_score ?? 0);

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <UserCell
                        name={profile?.full_name ?? registration?.player_id ?? i18n.t("Joueur inconnu")}
                        secondary={profile?.email}
                        avatarUrl={profile?.avatar_url}
                        href={registration ? i18n.path(`/admin/utilisateurs/${registration.player_id}`) : undefined}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="max-w-40 truncate text-xs font-medium">
                        {registration
                          ? scoutDayById.get(registration.scout_day_id) ?? i18n.t("Scout Day")
                          : "—"}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-60 whitespace-normal">
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {row.comment || i18n.t("Aucune observation redigee.")}
                      </p>
                    </TableCell>
                    <TableCell>
                      <ScoreSummary
                        technical={Number(row.technical_score)}
                        physical={Number(row.physical_score)}
                        tactical={Number(row.tactical_score)}
                        mental={Number(row.mental_score)}
                      />
                    </TableCell>
                    <TableCell>
                      <OverallScore value={overall} />
                    </TableCell>
                    <TableCell>
                      <div className="max-w-40">
                        <p className="truncate text-xs font-medium">
                          {evaluator?.contact_full_name ?? i18n.t("Professionnel")}
                        </p>
                        <p className="truncate text-[0.625rem] text-muted-foreground">
                          {evaluator?.organization_name ?? evaluator?.professional_type ?? i18n.t("Signataire valide")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        tone={row.visible_to_player ? "success" : "neutral"}
                        dot
                      >
                        {row.visible_to_player ? i18n.t("Publie") : i18n.t("Prive")}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {i18n.format.formatDate(row.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <ActionButton
                          action={setEvaluationVisibility.bind(
                            null,
                            row.id,
                            !row.visible_to_player,
                          )}
                          variant={row.visible_to_player ? "outline" : "default"}
                        >
                          {row.visible_to_player ? <EyeOffIcon /> : <EyeIcon />}
                          {row.visible_to_player ? i18n.t("Masquer") : i18n.t("Publier")}
                        </ActionButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Pagination
          basePath={i18n.path("/admin/evaluations")}
          params={{ page: String(page) }}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </Panel>

      <NoteCards
        notes={[
          {
            icon: GaugeIcon,
            title: i18n.t("Calcul consolide automatique"),
            body: i18n.t("La note globale est calculee cote serveur a partir des quatre domaines. Elle ne peut pas etre modifiee independamment des notes qui la composent."),
          },
          {
            icon: EyeIcon,
            title: i18n.t("Publication reversible"),
            body: i18n.t("Une evaluation nait privee. La publication la rend visible au joueur ; la masquer la retire de sa vue sans supprimer le rapport ni son historique."),
          },
          {
            icon: ShieldCheckIcon,
            title: i18n.t("Traçabilite des decisions"),
            body: i18n.t("Le signataire professionnel et l'administrateur ayant saisi la fiche restent traces afin que chaque evaluation conserve un responsable identifiable."),
          },
        ]}
      />
    </>
  );
}

async function StepBadge({ step }: { step: string }) {
  const i18n = await getAdminI18n();

  return (
    <span className="micro-label rounded border border-border bg-secondary px-1.5 py-1 text-muted-foreground">
      {i18n.t("Etape")} {step}
    </span>
  );
}

function ScoreField({
  label,
  name,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  name: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "brand" | "info" | "warning" | "success";
}) {
  const tones = {
    brand: "bg-brand/12 text-brand",
    info: "bg-info/12 text-info",
    warning: "bg-warning/12 text-warning",
    success: "bg-success/12 text-success",
  };

  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 items-center justify-center rounded-md", tones[tone])}>
          <Icon className="size-3.5" />
        </span>
        <div>
          <Label htmlFor={name} className="text-xs font-semibold text-foreground">
            {label}
          </Label>
          <p className="text-[0.6rem] text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="relative mt-3">
        <Input
          id={name}
          name={name}
          type="number"
          min="0"
          max="100"
          required
          inputMode="numeric"
          placeholder="00"
          className="h-12 rounded-md border-border bg-input pr-12 font-heading text-xl font-extrabold tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[0.625rem] text-muted-foreground">
          / 100
        </span>
      </div>
    </div>
  );
}

function RatingBand({
  range,
  label,
  description,
  tone,
}: {
  range: string;
  label: string;
  description: string;
  tone: "brand" | "info" | "warning" | "danger";
}) {
  const tones = {
    brand: "bg-brand text-brand-foreground",
    info: "bg-info/15 text-info",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/15 text-destructive",
  };

  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-input p-3">
      <span
        className={cn(
          "flex min-w-14 shrink-0 items-center justify-center rounded px-2 py-1 text-[0.625rem] font-bold tabular-nums",
          tones[tone],
        )}
      >
        {range}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold">{label}</p>
        <p className="mt-0.5 text-[0.625rem] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

async function ScoreSummary({
  technical,
  physical,
  tactical,
  mental,
}: {
  technical: number;
  physical: number;
  tactical: number;
  mental: number;
}) {
  const i18n = await getAdminI18n();

  return (
    <div className="grid w-32 grid-cols-4 gap-1" aria-label={i18n.t("Detail des quatre notes")}>
      {[
        [i18n.t("TEC"), technical],
        [i18n.t("PHY"), physical],
        [i18n.t("TAC"), tactical],
        [i18n.t("MEN"), mental],
      ].map(([label, value]) => (
        <span
          key={label}
          className="flex flex-col items-center rounded bg-secondary px-1.5 py-1"
        >
          <span className="text-[0.5rem] text-muted-foreground">{label}</span>
          <span className="text-[0.6875rem] font-semibold tabular-nums">{value}</span>
        </span>
      ))}
    </div>
  );
}

async function OverallScore({ value }: { value: number }) {
  const i18n = await getAdminI18n();

  return (
    <span
      className={cn(
        "flex size-10 items-center justify-center rounded-md border font-heading text-sm font-extrabold tabular-nums",
        value >= 85
          ? "border-brand/40 bg-brand/12 text-brand"
          : value >= 70
            ? "border-info/30 bg-info/10 text-info"
            : value >= 50
              ? "border-warning/30 bg-warning/10 text-warning"
              : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
      aria-label={i18n.t("Score global {0} sur 100", { "0": value })}
    >
      {value}
    </span>
  );
}
