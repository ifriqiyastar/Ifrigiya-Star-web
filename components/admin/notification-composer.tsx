"use client";

import * as React from "react";
import {
  BellRingIcon,
  CalendarDaysIcon,
  CheckIcon,
  Globe2Icon,
  Loader2Icon,
  MailIcon,
  SendIcon,
  SmartphoneIcon,
  TargetIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { BrandMark } from "@/components/admin/brand-mark";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AccountPicker, type Account } from "@/components/admin/account-picker";
import { NativeSelect } from "@/components/ui/native-select";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import type { ActionResult } from "@/lib/actions/result";
import { useAdminI18n, useAdminTranslations } from "@/lib/i18n/admin-client";
import { cn } from "@/lib/utils";

export type AudienceOption = { id: string; label: string; count: number };

/** Ce que l'ecran verrouille d'un telephone laisse reellement lire. */
const LOCK_SCREEN_BODY_CHARS = 120;

/**
 * Composition d'une notification **et** apercu de ce que le destinataire verra.
 *
 * Les deux colonnes vivent dans le meme composant client parce que l'apercu,
 * les compteurs et la cible resolue suivent la saisie. Les champs gardent leur
 * `name`, donc le Server Action recoit le meme `FormData` qu'avant.
 *
 * Le formulaire se lit en trois temps — **qui**, **quoi**, **par ou** — et cet
 * ordre n'est pas cosmetique : le titre et le corps du meme message etaient
 * separes par deux groupes de champs etrangers, si bien qu'on redigeait une
 * phrase en deux fois, de part et d'autre du selecteur d'audience.
 *
 * Ce qui n'y figure pas, et pourquoi :
 *
 *  * **pas de variables `{nom_joueur}`** — la diffusion insere le texte tel
 *    quel, rien ne les remplacerait, et le destinataire lirait l'accolade ;
 *  * **pas de canal choisissable pour l'in-app ni le push** — l'envoi ecrit
 *    une notification par destinataire et c'est cette ecriture qui declenche
 *    le push : ni l'un ni l'autre ne se decoche. Des cases a cocher inertes
 *    laissaient croire le contraire, ils sont desormais annonces comme des
 *    faits ;
 *  * **pas de telemetrie de passerelle** — rien ne relit les accuses de
 *    reception. La colonne de droite montre la portee reelle : combien de
 *    comptes ont enregistre un appareil.
 */
export function NotificationComposer({
  action,
  testAction,
  audiences,
  searchAccounts,
  scoutDays,
  reach,
  channels,
  templates,
  templatesHref,
  previewAction,
  defaults,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  testAction: (formData: FormData) => Promise<ActionResult>;
  /** Volumetrie reelle de chaque segment, calculee cote serveur. */
  audiences: { all: number; players: number; professionals: number };
  /** Recherche serveur : la page n'envoie plus les comptes d'avance. */
  searchAccounts: (query: string) => Promise<Account[]>;
  scoutDays: AudienceOption[];
  /** `devices` vaut `null` quand la portee push n'est pas mesurable. */
  reach: { devices: number | null; activeAccounts: number };
  /**
   * Les deux canaux optionnels. `selectable` vient d'une sonde serveur :
   * une case n'apparait que si le mecanisme existe derriere, et que si
   * l'administrateur a le droit de la toucher.
   */
  channels: {
    push: { selectable: boolean; reason: string };
    email: { selectable: boolean; reason: string };
  };
  /**
   * Les modeles d'e-mail disponibles. Le premier est celui par defaut : la
   * requete les trie ainsi, et c'est lui que la diffusion prend quand
   * personne ne choisit.
   */
  templates: { id: string; name: string; isDefault: boolean }[];
  /** Lien vers la galerie, pour aller voir ou modifier un modele. */
  templatesHref: string;
  /** Rend le courriel tel qu'il partirait, pour l'apercu vivant. */
  previewAction: (input: {
    title: string;
    body: string;
    bodyHtml: string | null;
    templateId: string | null;
    locale: string;
  }) => Promise<{ html: string }>;
  defaults?: { title?: string; body?: string };
}) {
  const i18n = useAdminTranslations();
  const { dict } = useAdminI18n();

  const [title, setTitle] = React.useState(defaults?.title ?? "");
  // ⚠️ Deux etats pour un seul message : `body` est le texte brut — celui
  // de la notification in-app et du push — et `bodyHtml` sa mise en forme,
  // qui ne sert qu'au courriel. Le second produit le premier, jamais
  // l'inverse : l'editeur remonte les deux a chaque frappe.
  const [body, setBody] = React.useState(defaults?.body ?? "");
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [targetType, setTargetType] = React.useState("all");
  const [targetValue, setTargetValue] = React.useState("");
  // Le push est coche par defaut — c'est le comportement attendu d'une
  // annonce ; l'email ne l'est pas, il sort de l'application.
  /**
   * ⚠️ **Ce qu'on envoie, avant tout le reste.**
   *
   * L'ecran supposait qu'une diffusion etait toujours une notification, a
   * laquelle un courriel pouvait s'ajouter : on ne pouvait donc pas envoyer
   * une lettre d'information sans deposer aussi une notification dans la
   * cloche de chacun et un push sur son telephone. Le mode est desormais le
   * premier choix, et il decide des champs comme des canaux.
   */
  const [mode, setMode] = React.useState<"notification" | "email" | "both">("notification");
  /**
   * En mode « les deux », le courriel peut porter son propre texte.
   *
   * ⚠️ Coche par defaut, et c'est deliberе : le cas courant est une meme
   * annonce par deux voies, et proposer d'emblee deux redactions ferait payer
   * a tout le monde le prix d'un besoin occasionnel. Decoche, on ecrit
   * l'objet et le corps du courriel a part — un objet de boite de reception
   * ne se redige pas comme un titre d'ecran verrouille.
   */
  const [sameText, setSameText] = React.useState(true);
  const [emailTitle, setEmailTitle] = React.useState("");
  const [emailBody, setEmailBody] = React.useState("");
  const [emailBodyHtml, setEmailBodyHtml] = React.useState("");
  const [withPush, setWithPush] = React.useState(true);
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? "");
  const [previewTab, setPreviewTab] = React.useState<"lock" | "email">("lock");
  // L'apercu suit le mode : en courriel seul, l'ecran verrouille ne montre
  // rien de ce qui part.
  const [tabFor, setTabFor] = React.useState(mode);
  if (tabFor !== mode) {
    setTabFor(mode);
    setPreviewTab(mode === "email" ? "email" : "lock");
  }
  const [previewLocale, setPreviewLocale] = React.useState("fr");
  const [previewHtml, setPreviewHtml] = React.useState("");
  const [previewing, setPreviewing] = React.useState(false);
  /** Le courriel a-t-il sa propre redaction ? Jamais en mode courriel seul. */
  const splitText = mode === "both" && !sameText;
  /** Ce que le courriel portera reellement, quel que soit le mode. */
  const mailTitle = splitText ? emailTitle : title;
  const mailBody = splitText ? emailBody : body;
  const mailBodyHtml = splitText ? emailBodyHtml : bodyHtml;

  const SAMPLE_TITLE = i18n.t("Titre de la notification");
  const SAMPLE_BODY = i18n.t("Le message apparaitra ici, tel que le destinataire le lira.");
  /**
   * L'apercu comporte-t-il de l'exemple ?
   *
   * ⚠️ « Ou », pas « et » : avec un titre ecrit et un message encore vide, la
   * moitie de ce qu'on regarde est un texte d'exemple. Ne rien signaler
   * laisserait croire que le corps est deja redige.
   */
  const previewIsSample = !mailTitle.trim() || !mailBody.trim();
  // Un canal non selectionnable suit son etat impose : le push part toujours
  // quand on ne peut pas le decocher, l'email jamais quand on ne peut pas le
  // cocher.
  const notificationOn = mode !== "email";
  const emailOn = mode !== "notification" && channels.email.selectable;
  const pushOn = notificationOn && (channels.push.selectable ? withPush : true);
  const [confirming, setConfirming] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [testing, startTest] = React.useTransition();
  const [pending, startSend] = React.useTransition();

  const SEGMENTS = [
    { value: "all", label: i18n.t("Tous les utilisateurs"), icon: Globe2Icon, count: audiences.all },
    { value: "role:player", label: i18n.t("Joueurs uniquement"), icon: UsersIcon, count: audiences.players },
    { value: "role:professional", label: i18n.t("Pros & recruteurs"), icon: UsersIcon, count: audiences.professionals },
    { value: "scout_day", label: i18n.t("Scout Day"), icon: CalendarDaysIcon, count: null },
    // Cinquieme pastille plutot qu'un lien en marge : choisir « un compte
    // precis » ailleurs eteignait toute la barre, qui annoncait alors une
    // cible que le formulaire n'avait plus.
    { value: "user", label: i18n.t("Compte precis"), icon: UserRoundIcon, count: null },
  ] as const;

  const selectedSegment = targetType === "role" ? `role:${targetValue}` : targetType;
  const selectedScoutDay = scoutDays.find((event) => event.id === targetValue);
  // Le compte choisi est garde en memoire du composant : il vient du
  // chercheur, la page ne le connait pas.
  const [selectedUser, setSelectedUser] = React.useState<Account | null>(null);

  /** Combien de comptes la cible represente — `null` quand elle est incomplete. */
  const resolvedCount =
    targetType === "all"
      ? audiences.all
      : targetType === "role" && targetValue === "player"
        ? audiences.players
        : targetType === "role" && targetValue === "professional"
          ? audiences.professionals
          : targetType === "scout_day"
            ? (selectedScoutDay?.count ?? null)
            : targetType === "user"
              ? (selectedUser ? 1 : null)
              : null;

  const resolved =
    targetType === "all"
      ? i18n.t("Toute la plateforme ({0} compte(s) actif(s))", { "0": audiences.all })
      : targetType === "role" && targetValue === "player"
        ? i18n.t("Joueurs actifs ({0} compte(s))", { "0": audiences.players })
        : targetType === "role" && targetValue === "professional"
          ? i18n.t("Professionnels actifs ({0} compte(s))", { "0": audiences.professionals })
          : targetType === "scout_day"
            ? selectedScoutDay
              ? i18n.t("{0} — {1} inscrit(s) non annule(s)", { "0": selectedScoutDay.label, "1": selectedScoutDay.count })
              : i18n.t("Selectionnez un Scout Day")
            : targetType === "user"
              ? (selectedUser?.name ?? i18n.t("Selectionnez un compte"))
              : "—";

  const needsPick = targetType === "scout_day" || targetType === "user";
  const ready = Boolean(
    title.trim() &&
      body.trim() &&
      (!needsPick || targetValue) &&
      // ⚠️ Un courriel redige a part et laisse vide partirait sans objet ni
      // corps : le bouton reste bloque tant qu'il n'est pas ecrit.
      (!splitText || (emailTitle.trim() && emailBody.trim())),
  );
  /**
   * Une diffusion ne se rappelle pas. Au-dela d'un destinataire, le clic
   * d'envoi ouvre une confirmation qui nomme l'audience et son volume — un
   * envoi nominatif, lui, n'a pas de quoi surprendre.
   */
  const needsConfirm = targetType !== "user";

  /**
   * ⚠️ **L'apercu du courriel est rendu par le serveur, apres une pause de
   * frappe.** Le gabarit est un composant React Email : le reproduire dans
   * le navigateur donnerait un apercu qui *ressemble* au courriel, et qui
   * finirait par en differer — precisement sur l'ecran ou l'on s'y fie pour
   * appuyer sur « Envoyer ». 500 ms suffisent a ne pas appeler a chaque
   * touche ; la demande n'est lancee que lorsque l'onglet est ouvert.
   */
  React.useEffect(() => {
    if (previewTab !== "email") return;
    let cancelled = false;
    // ⚠️ Tout `setState` vit **dans** le minuteur, jamais dans le corps de
    // l'effet : `react-hooks` refuse le second (« cascading renders ») et il
    // a raison — et l'indicateur de rendu doit s'allumer quand la demande
    // part, pas a chaque touche.
    const timer = setTimeout(() => {
      setPreviewing(true);
      // ⚠️ **Un composeur vide rend quand meme le courriel.** L'onglet
      // refusait tant qu'un titre et un message n'etaient pas tapes, alors
      // que l'ecran verrouille d'a cote montrait deja son apercu avec des
      // textes d'exemple : meme etat vide, deux comportements. Or ce qu'on
      // vient verifier en ouvrant cet onglet, c'est justement l'habillage —
      // le modele, les couleurs, la mise en page — et rien de tout cela ne
      // depend de ce qu'on va ecrire.
      previewAction({
        title: mailTitle.trim() || SAMPLE_TITLE,
        body: mailBody.trim() || SAMPLE_BODY,
        bodyHtml: mailBody.trim() ? mailBodyHtml || null : null,
        templateId: templateId || null,
        locale: previewLocale,
      })
        .then((result) => {
          // Une reponse arrivee apres un nouveau changement est perimee :
          // l'afficher ferait clignoter l'apercu vers un etat passe.
          if (!cancelled) setPreviewHtml(result.html);
        })
        .catch(() => {
          if (!cancelled) setPreviewHtml("");
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `SAMPLE_*` sont des chaines : la comparaison de dependances se fait par
    // valeur, donc les citer ne relance pas l'effet a chaque rendu.
  }, [previewTab, previewLocale, mailTitle, mailBody, mailBodyHtml, templateId, previewAction, SAMPLE_TITLE, SAMPLE_BODY]);

  function pickSegment(value: string) {
    if (value.startsWith("role:")) {
      setTargetType("role");
      setTargetValue(value.slice(5));
      return;
    }
    setTargetType(value);
    setTargetValue("");
    setSelectedUser(null);
  }

  /**
   * L'envoi est declenche a la main plutot que par `useActionState` : le
   * formulaire doit se vider **apres** un succes, et remettre l'etat a zero
   * depuis un effet est justement ce que React deconseille.
   */
  function send() {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    setConfirming(false);
    startSend(async () => {
      const result = await action(formData);
      if (result.ok) {
        toast.success(result.message);
        setTitle("");
        setBody("");
        setBodyHtml("");
      } else {
        toast.error(result.message);
      }
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (needsConfirm) {
      setConfirming(true);
      return;
    }
    send();
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
              {i18n.t("Nouvel envoi de notification")}
            </h2>
            <span className="micro-label flex items-center gap-1.5 rounded bg-background px-2 py-1 text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand" />
              {i18n.t("Diffusion immediate")}
            </span>
          </div>

          <div className="space-y-5 p-4">
            <section className="space-y-2">
              <Step number={1} label={i18n.t("Que voulez-vous envoyer ?")} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ModeCard
                  active={mode === "notification"}
                  onClick={() => setMode("notification")}
                  icon={BellRingIcon}
                  title={i18n.t("Une notification")}
                  hint={i18n.t("Dans l'application, et sur le telephone.")}
                />
                <ModeCard
                  active={mode === "email"}
                  onClick={() => setMode("email")}
                  icon={MailIcon}
                  title={i18n.t("Un e-mail")}
                  hint={i18n.t("Rien dans l'application, rien sur le telephone.")}
                  disabled={!channels.email.selectable}
                  disabledReason={channels.email.reason}
                />
                <ModeCard
                  active={mode === "both"}
                  onClick={() => setMode("both")}
                  icon={SendIcon}
                  title={i18n.t("Les deux")}
                  hint={i18n.t("Le meme texte par les deux voies.")}
                  disabled={!channels.email.selectable}
                  disabledReason={channels.email.reason}
                />
              </div>
            </section>

            <section className="space-y-2">
              <Step number={2} label={i18n.t("Destinataires cibles (segmentation)")} />
              {/* Une rangee qui se replie, pas une grille : des colonnes
                  `minmax(0,1fr)` retrecissent sous leur contenu au lieu de
                  deborder, et cinq pastilles dans huit colonnes finissent
                  tronquees sans que rien ne defile. */}
              <div className="flex flex-wrap gap-1 rounded-lg bg-background p-1">
                {SEGMENTS.map((segment) => {
                  const Icon = segment.icon;
                  const active = selectedSegment === segment.value;
                  return (
                    <button
                      key={segment.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => pickSegment(segment.value)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[0.6875rem] font-semibold transition-colors",
                        active
                          ? "bg-accent font-bold text-brand"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      {segment.label}
                      {segment.count !== null ? (
                        <span className="tabular-nums opacity-70">({segment.count})</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Le type et la valeur partent dans `FormData` sous les noms
                  attendus par le Server Action. */}
              <input type="hidden" name="target_type" value={targetType} />
              {targetType === "role" ? (
                <input type="hidden" name="target_value" value={targetValue} />
              ) : null}
              {targetType === "all" ? <input type="hidden" name="target_value" value="" /> : null}

              {targetType === "scout_day" ? (
                <NativeSelect
                  name="target_value"
                  required
                  aria-label={i18n.t("Selectionner un Scout Day")}
                  value={targetValue}
                  onChange={(event) => setTargetValue(event.target.value)}
                >
                  <option value="">{i18n.t("Selectionner un Scout Day")}</option>
                  {scoutDays.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.label} — {event.count} {i18n.t("inscrit(s)")}
                    </option>
                  ))}
                </NativeSelect>
              ) : null}

              {targetType === "user" ? (
                <AccountPicker
                  value={targetValue}
                  selected={selectedUser}
                  onSelect={(account) => {
                    setSelectedUser(account);
                    setTargetValue(account?.id ?? "");
                  }}
                  search={searchAccounts}
                />
              ) : null}

              <p
                aria-live="polite"
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs",
                  resolvedCount === null
                    ? "bg-warning/10 text-warning"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <TargetIcon className="size-3.5 shrink-0" />
                <span>{i18n.t("Cible resolue :")}</span>
                <span className="font-semibold text-foreground">{resolved}</span>
              </p>
            </section>

            <section className="space-y-2">
              <Step number={3} label={i18n.t("Message")} />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="notif-title" className="micro-label">
                    {mode === "email" ? i18n.t("Objet de l'e-mail") : i18n.t("Titre de la notification")}
                  </label>
                  {/* L'objet d'un courriel n'a pas la contrainte d'un titre
                      de notification, que l'ecran verrouille tronque. */}
                  <Counter value={title.length} max={mode === "email" ? 120 : 64} />
                </div>
                <input
                  id="notif-title"
                  name="title"
                  required
                  maxLength={mode === "email" ? 120 : 64}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={i18n.t("Ex : nouvelle session Scout Day a Tunis")}
                  className="h-9 w-full rounded-lg bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="micro-label">{i18n.t("Corps du message")}</span>
                  <Counter value={body.length} max={LOCK_SCREEN_BODY_CHARS} soft />
                </div>
                {/* Le texte brut voyage dans `FormData` sous le nom que le
                    Server Action lit depuis toujours ; la mise en forme
                    l'accompagne a cote, sans le remplacer. */}
                <input type="hidden" name="body" value={body} />
                <input type="hidden" name="body_html" value={bodyHtml} />
                <RichTextEditor
                  value={bodyHtml}
                  onChange={(html, text) => {
                    setBodyHtml(html);
                    setBody(text);
                  }}
                  placeholder={i18n.t("Detaillez la session, la date et ce que le destinataire doit faire.")}
                />
                <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                  {body.length > LOCK_SCREEN_BODY_CHARS
                    ? i18n.t("Au-dela d'environ {0} caracteres, la suite est repliee sur l'ecran verrouille : le message reste entier dans l'application.", { "0": LOCK_SCREEN_BODY_CHARS })
                    : i18n.t("Le texte part tel quel : aucune variable n'est remplacee a l'envoi.")}
                </p>
              </div>
            </section>

            {mode === "both" ? (
              <section className="space-y-2 rounded-lg bg-background p-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sameText}
                    onChange={(event) => setSameText(event.target.checked)}
                    className="size-4 accent-brand"
                  />
                  <span className="text-xs font-medium">
                    {i18n.t("Le courriel reprend le meme texte")}
                  </span>
                </label>
                {splitText ? (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="mail-title" className="micro-label">
                          {i18n.t("Objet de l'e-mail")}
                        </label>
                        <Counter value={emailTitle.length} max={120} />
                      </div>
                      <input
                        id="mail-title"
                        maxLength={120}
                        value={emailTitle}
                        onChange={(event) => setEmailTitle(event.target.value)}
                        placeholder={title || i18n.t("Ex : nouvelle session Scout Day a Tunis")}
                        className="h-9 w-full rounded-lg bg-card px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="micro-label">{i18n.t("Corps de l'e-mail")}</span>
                      <RichTextEditor
                        value={emailBodyHtml}
                        onChange={(html, text) => {
                          setEmailBodyHtml(html);
                          setEmailBody(text);
                        }}
                        placeholder={i18n.t("Detaillez la session, la date et ce que le destinataire doit faire.")}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                    {i18n.t("Decochez pour rediger un objet et un corps propres au courriel.")}
                  </p>
                )}
              </section>
            ) : null}

            <section className="space-y-2">
              <Step number={4} label={i18n.t("Canaux de diffusion")} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <ChannelCard
                  icon={BellRingIcon}
                  title="In-app"
                  hint={i18n.t("Fil et cloche de l'application. Toujours envoye : c'est lui qui porte le push.")}
                  state={notificationOn ? "always" : "off"}
                  stateLabel={notificationOn ? i18n.t("Toujours") : i18n.t("Hors mode")}
                />
                <ChannelCard
                  icon={SmartphoneIcon}
                  title={i18n.t("Push mobile")}
                  hint={
                    reach.devices === null
                      ? i18n.t("Portee non mesurable sur cette installation")
                      : i18n.t("{0} compte(s) avec un appareil joignable", { "0": reach.devices })
                  }
                  state={!notificationOn ? "off" : channels.push.selectable ? "option" : "always"}
                  stateLabel={
                    !notificationOn ? i18n.t("Hors mode") : channels.push.reason || i18n.t("Toujours")
                  }
                  checked={pushOn}
                  onToggle={() => setWithPush((value) => !value)}
                />
                <ChannelCard
                  icon={MailIcon}
                  title={i18n.t("Email")}
                  hint={
                    channels.email.selectable
                      ? i18n.t("Adresse du compte destinataire")
                      : channels.email.reason
                  }
                  state={emailOn ? "always" : "off"}
                  stateLabel={emailOn ? i18n.t("Toujours") : i18n.t("Hors mode")}
                />
              </div>
              {/* Les canaux retenus partent dans `FormData` sous le meme nom,
                  comme avant : le Server Action lit `channels` inchange. */}
              {notificationOn ? <input type="hidden" name="channels" value="in_app" /> : null}
              {pushOn ? <input type="hidden" name="channels" value="push" /> : null}
              {emailOn ? <input type="hidden" name="channels" value="email" /> : null}
              {/* Le texte propre au courriel ne voyage que s'il existe :
                  absent, le Server Action reprend celui de la notification. */}
              {splitText ? (
                <>
                  <input type="hidden" name="email_subject" value={emailTitle} />
                  <input type="hidden" name="email_body" value={emailBody} />
                  <input type="hidden" name="email_body_html" value={emailBodyHtml} />
                </>
              ) : null}
              {emailOn && templates.length ? (
                <div className="space-y-1.5 rounded-lg bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="notif-template" className="micro-label">
                      {i18n.t("Modele d'e-mail")}
                    </label>
                    <a
                      href={templatesHref}
                      className="text-[0.6875rem] font-semibold text-brand hover:underline"
                    >
                      {i18n.t("Voir les modeles")}
                    </a>
                  </div>
                  <NativeSelect
                    id="notif-template"
                    name="email_template"
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.isDefault ? ` — ${i18n.t("Par defaut")}` : ""}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : null}
              {notificationOn && !pushOn ? (
                <p className="rounded-lg bg-warning/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-warning">
                  {i18n.t("Sans push, la notification n'apparaitra que dans l'application : personne ne sera alerte sur son telephone.")}
                </p>
              ) : null}
              {mode === "email" && !channels.email.selectable ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-destructive">
                  {channels.email.reason}
                </p>
              ) : null}
            </section>

            <div className="flex flex-col items-stretch justify-between gap-2 border-t border-border/70 pt-3 sm:flex-row sm:items-center">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <SendIcon className="size-3.5 shrink-0" />
                {resolvedCount === null
                  ? i18n.t("Choisissez une cible pour connaitre le volume d'envoi.")
                  : mode === "email"
                    ? i18n.t("{0} destinataire(s) par e-mail", { "0": resolvedCount })
                    : i18n.t("{0} destinataire(s) a l'envoi", { "0": resolvedCount })}
              </span>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={sendTest}
                  disabled={testing || pending || !title.trim() || !body.trim()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold hover:bg-accent/70 disabled:opacity-60"
                >
                  {testing ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <BellRingIcon className="size-4" />
                  )}
                  {i18n.t("Envoi test (a moi)")}
                </button>
                <button
                  type="submit"
                  disabled={pending || !ready}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground transition-[filter] hover:brightness-110 disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <SendIcon className="size-4" />
                  )}
                  {i18n.t("Envoyer maintenant")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-3 xl:col-span-4">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Deux apercus, parce qu'il y a deux rendus : ce que le telephone
              pose sur l'ecran verrouille — du texte brut — et le courriel,
              qui porte la mise en forme et l'habillage. Un seul des deux
              mentirait sur l'autre. */}
          <div className="flex items-center gap-1 border-b border-border bg-muted p-1.5">
            <PreviewTab
              active={previewTab === "lock"}
              onClick={() => setPreviewTab("lock")}
              icon={SmartphoneIcon}
              label={i18n.t("Ecran verrouille")}
            />
            <PreviewTab
              active={previewTab === "email"}
              onClick={() => setPreviewTab("email")}
              icon={MailIcon}
              label={i18n.t("E-mail")}
              muted={!emailOn}
            />
            {previewTab === "email" ? (
              <select
                value={previewLocale}
                onChange={(event) => setPreviewLocale(event.target.value)}
                aria-label={i18n.t("Langue de l'apercu")}
                className="ml-auto cursor-pointer rounded bg-background px-2 py-1 text-[0.6875rem] font-semibold outline-none"
              >
                <option value="fr">FR</option>
                <option value="en">EN</option>
                <option value="ar">AR</option>
              </select>
            ) : (
              <span className="micro-label ml-auto pr-1 text-muted-foreground">
                {i18n.t("Maintenant")}
              </span>
            )}
          </div>

          {previewTab === "lock" ? (
            <div className="p-4">
              {/* Le cadre imite l'ecran verrouille pour que la troncature se
                  voie avant l'envoi, pas apres : deux lignes de corps, comme
                  un telephone en affiche. */}
              <div className="space-y-3 rounded-xl bg-background p-3">
                <p className="text-center font-heading text-2xl leading-none font-bold text-muted-foreground/70 tabular-nums">
                  09:41
                </p>
                <div className="space-y-2 rounded-lg bg-card p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <BrandMark className="size-4 rounded-[3px]" />
                      <span className="micro-label">Ifriqiya Soccer Star</span>
                    </span>
                    <span className="micro-label text-muted-foreground">
                      {i18n.t("Maintenant")}
                    </span>
                  </div>
                  <div>
                    <p className="line-clamp-1 text-sm leading-snug font-bold wrap-break-word">
                      {title || i18n.t("Titre de la notification")}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-tight text-muted-foreground wrap-break-word">
                      {body || i18n.t("Le message apparaitra ici, tel que le destinataire le lira.")}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[0.6875rem] leading-relaxed text-muted-foreground">
                {i18n.t("Le push ne porte aucune mise en forme : c'est ce texte-la qui s'affiche.")}
              </p>
            </div>
          ) : (
            <div className="relative">
              {previewing ? (
                <span className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full bg-card/90 px-2 py-1 text-[0.625rem] text-muted-foreground shadow-sm">
                  <Loader2Icon className="size-3 animate-spin" />
                  {i18n.t("Rendu en cours")}
                </span>
              ) : null}
              {previewIsSample && previewHtml ? (
                <span className="absolute top-2 left-2 z-10 rounded-full bg-card/90 px-2 py-1 text-[0.625rem] font-semibold text-muted-foreground shadow-sm">
                  {i18n.t("Exemple")}
                </span>
              ) : null}
              {previewHtml ? (
                // ⚠️ `sandbox=""` : le courriel porte son propre `<body>` et
                // ses styles en ligne, et son contenu vient d'une saisie.
                <iframe
                  title={i18n.t("Apercu de l'e-mail")}
                  srcDoc={previewHtml}
                  sandbox=""
                  className="h-120 w-full border-0 bg-white"
                />
              ) : (
                <p className="p-6 text-center text-xs text-muted-foreground">
                  {i18n.t("Rendu en cours")}
                </p>
              )}
              {!emailOn ? (
                <p className="border-t border-border px-3 py-2 text-[0.625rem] leading-relaxed text-warning">
                  {i18n.t("Le canal e-mail n'est pas coche : cet apercu montre ce qui partirait si vous le cochiez.")}
                </p>
              ) : null}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[0.6875rem] text-muted-foreground">
            <span>
              {[
                "In-app",
                pushOn ? i18n.t("Push") : null,
                emailOn ? i18n.t("Email") : null,
              ]
                .filter(Boolean)
                .join(" + ")}
            </span>
            <span className="tabular-nums">
              {title.length + body.length} {i18n.t("caracteres")}
            </span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">{i18n.t("Portee reelle")}</h2>
          <ReachRow
            label={i18n.t("Comptes actifs")}
            value={`${reach.activeAccounts}`}
            hint={i18n.t("Destinataires possibles d'une diffusion « toute la plateforme »")}
          />
          <ReachRow
            label={i18n.t("Appareils joignables")}
            /* ⚠️ « — » et non « 0 » quand la mesure est indisponible : un zero
               se lirait comme « personne n'a installe l'application ». */
            value={reach.devices === null ? "—" : `${reach.devices}`}
            hint={i18n.t("Comptes ayant enregistre un jeton push")}
          />
          {reach.devices === null ? null : (
            <span aria-hidden className="block h-1.5 w-full overflow-hidden rounded-full bg-accent">
              <span
                className="block h-full rounded-full bg-brand"
                style={{
                  width: `${reach.activeAccounts ? Math.round(Math.min(1, reach.devices / reach.activeAccounts) * 100) : 0}%`,
                }}
              />
            </span>
          )}
          <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
            {reach.devices === null
              ? i18n.t("Cette installation ne sait pas compter les appareils joignables : la fonction qui les denombre sans exposer les jetons n'est pas en place. Le push part quand meme.")
              : i18n.t("Les autres comptes recevront la notification dans l'application, sans push. La remise effective d'un push n'est pas mesuree : personne ne relit les accuses de reception.")}
          </p>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.t("Envoyer cette notification ?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {resolvedCount === null
                ? resolved
                : i18n.t("{0} — soit {1} destinataire(s). Une notification partie ne peut pas etre rappelee.", { "0": resolved, "1": resolvedCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg bg-muted p-3">
            {emailOn ? (
              <p className="micro-label mb-1.5 text-muted-foreground">
                {i18n.t("Modele d'e-mail")} ·{" "}
                <span className="text-foreground">
                  {templates.find((row) => row.id === templateId)?.name ??
                    i18n.t("Textes livres")}
                </span>
              </p>
            ) : null}
            <p className="text-sm font-semibold wrap-break-word">{title}</p>
            <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-muted-foreground wrap-break-word">
              {body}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{dict.common.cancel}</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={send}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {i18n.t("Envoyer maintenant")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Un mode d'envoi. ⚠️ Desactive quand le canal email n'est pas disponible :
 * proposer « un e-mail » sur une installation sans cle d'envoi ferait choisir
 * un mode dont rien ne partirait, et la raison est dite au survol.
 */
function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  hint,
  disabled,
  disabledReason,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? disabledReason : undefined}
      className={cn(
        "flex flex-col items-start rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-brand/50 bg-brand/10"
          : "border-border bg-background hover:border-border/80",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="flex items-center gap-1.5">
        <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted-foreground")} />
        <span className={cn("text-xs font-semibold", active && "text-brand")}>{title}</span>
      </span>
      <span className="mt-1 text-[0.625rem] leading-relaxed text-muted-foreground">
        {disabled ? disabledReason : hint}
      </span>
    </button>
  );
}

function PreviewTab({
  active,
  onClick,
  icon: Icon,
  label,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[0.6875rem] font-semibold transition-colors",
        active
          ? "bg-card font-bold text-brand shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        muted && !active && "opacity-60",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

/** Numero d'etape du formulaire, dans la pastille carree du systeme. */
function Step({ number, label }: { number: number; label: string }) {
  return (
    <h3 className="flex items-center gap-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-brand/12 font-heading text-[0.625rem] font-bold text-brand tabular-nums">
        {number}
      </span>
      <span className="micro-label">{label}</span>
    </h3>
  );
}

/**
 * Compteur de caracteres. `soft` marque une limite indicative — celle de
 * l'ecran verrouille — que rien n'empeche de depasser, par opposition au
 * `maxLength` du titre.
 */
function Counter({ value, max, soft }: { value: number; max: number; soft?: boolean }) {
  const over = value > max;
  return (
    <span
      className={cn(
        "text-[0.6875rem] tabular-nums",
        over ? (soft ? "text-warning" : "text-destructive") : "text-muted-foreground",
      )}
    >
      {value} / {max}
    </span>
  );
}

/**
 * Un canal de diffusion.
 *
 * ⚠️ Trois etats, et la difference est le fond du sujet : `always` est un
 * **fait** (l'in-app et le push partent avec la notification, rien ne les
 * decoche), `option` est un **choix**, `off` est une **absence** dont la
 * raison est ecrite. Les trois se dessinaient auparavant avec la meme case a
 * cocher, qui ne cochait rien.
 */
function ChannelCard({
  icon: Icon,
  title,
  hint,
  state,
  stateLabel,
  checked,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  state: "always" | "option" | "off";
  stateLabel?: string;
  checked?: boolean;
  onToggle?: () => void;
}) {
  // ⚠️ L'etat est pose **au-dessus** du descriptif, pas a cote : cote a cote,
  // « Toujours » et « Indisponible » sont `shrink-0` et prennent leur largeur
  // sur le texte, qui se faisait raboter bien avant de deborder. Le descriptif
  // occupe donc sa propre ligne, et il se replie au lieu d'etre coupe.
  const body = (
    <>
      <span className="flex w-full items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            className={cn(
              "size-4 shrink-0",
              state === "off" ? "text-muted-foreground" : "text-brand",
            )}
          />
          <span className="truncate text-xs font-semibold">{title}</span>
        </span>
        {state === "option" ? (
          <span
            aria-hidden
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded border",
              checked ? "border-brand bg-brand text-brand-foreground" : "border-border",
            )}
          >
            {checked ? <CheckIcon className="size-3" /> : null}
          </span>
        ) : (
          // Pas d'icone a cote de l'etat : les seize pixels qu'elle prend
          // etaient pris sur le titre du canal, rabote a 1280 px. Le mot
          // suffit, et l'opacite de la carte dit deja l'absence.
          <span className="micro-label shrink-0 text-muted-foreground">{stateLabel}</span>
        )}
      </span>
      <span className="mt-1 line-clamp-2 text-[0.625rem] leading-relaxed text-muted-foreground">
        {hint}
      </span>
    </>
  );

  const shell = cn(
    "flex flex-col items-start rounded-lg bg-background p-3 text-left",
    state === "off" && "opacity-60",
  );

  if (state === "option") {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className={cn(shell, "transition-colors hover:bg-accent/50")}
      >
        {body}
      </button>
    );
  }
  return <div className={shell}>{body}</div>;
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
