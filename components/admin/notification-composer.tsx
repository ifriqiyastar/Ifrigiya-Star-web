"use client";

import * as React from "react";
import {
  BellIcon,
  BellRingIcon,
  BugIcon,
  InfoIcon,
  Loader2Icon,
  MailIcon,
  SendIcon,
  SlidersHorizontalIcon,
  SmartphoneIcon,
} from "lucide-react";
import { toast } from "sonner";

import { NativeSelect } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/actions/result";
import { cn } from "@/lib/utils";

export type AudienceOption = { id: string; label: string; count: number };

/**
 * Composition d'une notification **et** apercu de ce que le destinataire verra,
 * cote a cote comme la maquette « Diffusion & notifications push ».
 *
 * Les deux colonnes vivent dans le meme composant client parce que l'apercu et
 * le compteur de caracteres suivent la saisie. Les champs gardent leur `name`,
 * donc le Server Action recoit le meme `FormData` qu'avant.
 *
 * Ce qui n'y figure pas, et pourquoi :
 *
 *  * **pas de variables `{nom_joueur}`** — la diffusion insere le texte tel
 *    quel, rien ne les remplacerait, et le destinataire lirait l'accolade ;
 *  * **pas de canal email** — aucun fournisseur n'est configure, la case est
 *    montree desactivee plutot que promise ;
 *  * **pas de telemetrie de passerelle** — rien ne relit les accuses de
 *    reception. La colonne de droite montre la portee reelle : combien de
 *    comptes ont enregistre un appareil.
 */
export function NotificationComposer({
  action,
  testAction,
  audiences,
  users,
  scoutDays,
  reach,
  defaults,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  testAction: (formData: FormData) => Promise<ActionResult>;
  /** Volumetrie reelle de chaque segment, calculee cote serveur. */
  audiences: { all: number; players: number; professionals: number };
  users: { id: string; label: string }[];
  scoutDays: AudienceOption[];
  reach: { devices: number; activeAccounts: number };
  defaults?: { title?: string; body?: string };
}) {
  const [title, setTitle] = React.useState(defaults?.title ?? "");
  const [body, setBody] = React.useState(defaults?.body ?? "");
  const [targetType, setTargetType] = React.useState("all");
  const [targetValue, setTargetValue] = React.useState("");
  const formRef = React.useRef<HTMLFormElement>(null);
  const [testing, startTest] = React.useTransition();
  const [pending, startSend] = React.useTransition();

  /**
   * L'envoi est declenche a la main plutot que par `useActionState` : le
   * formulaire doit se vider **apres** un succes, et remettre l'etat a zero
   * depuis un effet est justement ce que React deconseille.
   */
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    startSend(async () => {
      const result = await action(formData);
      if (result.ok) {
        toast.success(result.message);
        setTitle("");
        setBody("");
      } else {
        toast.error(result.message);
      }
    });
  }

  const SEGMENTS = [
    { value: "all", label: "Tous les utilisateurs", count: audiences.all },
    { value: "role:player", label: "Joueurs uniquement", count: audiences.players },
    { value: "role:professional", label: "Pros & recruteurs", count: audiences.professionals },
    { value: "scout_day", label: "Scout Day", count: null },
  ] as const;

  const selectedSegment = targetType === "role" ? `role:${targetValue}` : targetType;
  const selectedScoutDay = scoutDays.find((event) => event.id === targetValue);

  const resolved =
    targetType === "all"
      ? `Toute la plateforme (${audiences.all} compte(s) actif(s))`
      : targetType === "role" && targetValue === "player"
        ? `Joueurs actifs (${audiences.players} compte(s))`
        : targetType === "role" && targetValue === "professional"
          ? `Professionnels actifs (${audiences.professionals} compte(s))`
          : targetType === "scout_day"
            ? selectedScoutDay
              ? `${selectedScoutDay.label} — ${selectedScoutDay.count} inscrit(s) non annule(s)`
              : "Selectionnez un Scout Day"
            : targetType === "user"
              ? (users.find((user) => user.id === targetValue)?.label ?? "Selectionnez un compte")
              : "—";

  function pickSegment(value: string) {
    if (value.startsWith("role:")) {
      setTargetType("role");
      setTargetValue(value.slice(5));
      return;
    }
    setTargetType(value);
    setTargetValue("");
  }

  function sendTest() {
    const form = formRef.current;
    if (!form) return;
    startTest(async () => {
      const result = await testAction(new FormData(form));
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-12">
      <form ref={formRef} onSubmit={submit} className="xl:col-span-8">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex h-12 items-center justify-between gap-2 border-b border-border bg-muted px-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <SendIcon className="size-4 text-brand" />
              Nouvel envoi de notification
            </h2>
            <span className="micro-label flex items-center gap-1.5 rounded bg-background px-2 py-1 text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand" />
              Diffusion immediate
            </span>
          </div>

          <div className="space-y-4 p-4">
            <div className="flex items-start gap-2.5 rounded-lg bg-muted p-3">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-info" />
              <div>
                <p className="text-sm font-medium">Il n&apos;y a pas de file d&apos;attente</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  L&apos;envoi ecrit une notification par destinataire ; c&apos;est cette ecriture
                  qui declenche le push sur les appareils ayant enregistre un jeton. Rien ne reste
                  en attente d&apos;un worker, et le nombre de destinataires servis est renvoye
                  immediatement.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="notif-title" className="micro-label">
                  Titre de la notification
                </label>
                <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
                  {title.length} / 64
                </span>
              </div>
              <input
                id="notif-title"
                name="title"
                required
                maxLength={64}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex : nouvelle session Scout Day a Tunis"
                className="h-9 w-full rounded-lg bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-brand"
              />
            </div>

            <div className="space-y-1.5">
              <label className="micro-label">Destinataires cibles (segmentation)</label>
              <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-background p-1 sm:grid-cols-4">
                {SEGMENTS.map((segment) => (
                  <button
                    key={segment.value}
                    type="button"
                    onClick={() => pickSegment(segment.value)}
                    className={cn(
                      "flex h-8 items-center justify-center rounded px-2 text-[0.6875rem] font-semibold transition-colors",
                      selectedSegment === segment.value
                        ? "bg-accent font-bold text-brand"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {segment.label}
                    {segment.count !== null ? (
                      <span className="ml-1 tabular-nums opacity-70">({segment.count})</span>
                    ) : null}
                  </button>
                ))}
              </div>

              {/* Le type et la valeur partent dans `FormData` sous les noms
                  attendus par le Server Action. */}
              <input type="hidden" name="target_type" value={targetType} />
              {targetType === "role" ? (
                <input type="hidden" name="target_value" value={targetValue} />
              ) : null}

              {targetType === "scout_day" ? (
                <NativeSelect
                  name="target_value"
                  required
                  value={targetValue}
                  onChange={(event) => setTargetValue(event.target.value)}
                >
                  <option value="">Selectionner un Scout Day</option>
                  {scoutDays.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.label} — {event.count} inscrit(s)
                    </option>
                  ))}
                </NativeSelect>
              ) : null}

              {targetType === "user" ? (
                <NativeSelect
                  name="target_value"
                  required
                  value={targetValue}
                  onChange={(event) => setTargetValue(event.target.value)}
                >
                  <option value="">Selectionner un compte</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.label}
                    </option>
                  ))}
                </NativeSelect>
              ) : null}

              {targetType === "all" ? <input type="hidden" name="target_value" value="" /> : null}

              <div className="flex flex-wrap items-center gap-2 rounded bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                <SlidersHorizontalIcon className="size-3.5 text-info" />
                <span>Cible resolue :</span>
                <span className="font-semibold text-foreground">{resolved}</span>
                <button
                  type="button"
                  onClick={() => {
                    setTargetType("user");
                    setTargetValue("");
                  }}
                  className="ml-auto text-[0.6875rem] font-semibold text-brand hover:underline"
                >
                  Cibler un compte precis
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="micro-label">Canaux de diffusion</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ChannelCard
                  icon={BellRingIcon}
                  title="In-app"
                  hint="Fil et cloche de l'application"
                  active
                />
                <ChannelCard
                  icon={SmartphoneIcon}
                  title="Push mobile"
                  hint="Appareils avec un jeton enregistre"
                  active
                />
                <ChannelCard
                  icon={MailIcon}
                  title="Email"
                  hint="Aucun fournisseur configure"
                  active={false}
                />
              </div>
              <input type="hidden" name="channels" value="in_app" />
              <input type="hidden" name="channels" value="push" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="notif-body" className="micro-label">
                Corps du message
              </label>
              <textarea
                id="notif-body"
                name="body"
                required
                rows={4}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Detaillez la session, la date et ce que le destinataire doit faire."
                className="w-full resize-y rounded-lg bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-brand"
              />
              <p className="text-[0.6875rem] text-muted-foreground">
                Le texte part tel quel : aucune variable n&apos;est remplacee a l&apos;envoi.
              </p>
            </div>

            <div className="flex flex-col items-center justify-between gap-2 pt-1 sm:flex-row">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BellIcon className="size-3.5" />
                {reach.devices} compte(s) ont un appareil joignable par push
              </span>
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={sendTest}
                  disabled={testing || pending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold hover:bg-accent/70 disabled:opacity-60"
                >
                  {testing ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <BugIcon className="size-4" />
                  )}
                  Envoi test (a moi)
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground transition-[filter] hover:brightness-110 disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <SendIcon className="size-4" />
                  )}
                  Envoyer maintenant
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-3 xl:col-span-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2 pb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <SmartphoneIcon className="size-4 text-brand" />
              Apercu ecran verrouille
            </h2>
            <span className="micro-label text-muted-foreground">Maintenant</span>
          </div>

          <div className="space-y-2 rounded-lg bg-background p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="flex size-4 items-center justify-center rounded bg-brand text-[8px] font-bold text-brand-foreground">
                  IS
                </span>
                <span className="micro-label">Ifriqiya Star</span>
              </span>
              <span className="micro-label text-muted-foreground">Maintenant</span>
            </div>
            <div className="pl-1">
              <p className="text-sm leading-snug font-bold break-words">
                {title || "Titre de la notification"}
              </p>
              <p className="mt-1 line-clamp-3 text-xs leading-tight text-muted-foreground break-words">
                {body || "Le message apparaitra ici, tel que le destinataire le lira."}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-[0.6875rem] text-muted-foreground">
            <span>Notification in-app + push</span>
            <span className="tabular-nums">{title.length + body.length} caracteres</span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Portee reelle</h2>
          <ReachRow
            label="Comptes actifs"
            value={`${reach.activeAccounts}`}
            hint="Destinataires possibles d'une diffusion « toute la plateforme »"
          />
          <ReachRow
            label="Appareils joignables"
            value={`${reach.devices}`}
            hint="Comptes ayant enregistre un jeton push"
          />
          <span aria-hidden className="block h-1.5 w-full overflow-hidden rounded-full bg-accent">
            <span
              className="block h-full rounded-full bg-brand"
              style={{
                width: `${reach.activeAccounts ? Math.round(Math.min(1, reach.devices / reach.activeAccounts) * 100) : 0}%`,
              }}
            />
          </span>
          <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
            Les autres comptes recevront la notification dans l&apos;application, sans push. La
            remise effective d&apos;un push n&apos;est pas mesuree : personne ne relit les accuses
            de reception.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChannelCard({
  icon: Icon,
  title,
  hint,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg bg-background p-3",
        !active && "opacity-60",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted-foreground")} />
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold">{title}</span>
          <span className="block truncate text-[0.625rem] text-muted-foreground">{hint}</span>
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "size-3.5 shrink-0 rounded border",
          active ? "border-brand bg-brand" : "border-border",
        )}
      />
    </div>
  );
}

function ReachRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[0.625rem] text-muted-foreground">{hint}</span>
      </span>
      <span className="font-heading shrink-0 text-lg leading-none font-bold tabular-nums">
        {value}
      </span>
    </div>
  );
}
