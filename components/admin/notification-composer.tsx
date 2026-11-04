"use client";

import * as React from "react";
import {
  BellRingIcon,
  CalendarDaysIcon,
  Globe2Icon,
  Loader2Icon,
  MailIcon,
  SendIcon,
  SmartphoneIcon,
  TargetIcon,
  UserRoundIcon,
  AtSignIcon,
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
import type { ActionResult } from "@/lib/actions/result";
// ⚠️ Module neutre, qui n'importe rien : un composant client ne peut emprunter
// ni `lib/actions/*` ni rien qui tire `server-only`. Le decompte affiche et la
// liste envoyee sortent ainsi de la meme analyse.
import { MAX_TYPED_ADDRESSES, parseAddressList } from "@/lib/email/address-list";
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
   * Le canal optionnel. `selectable` vient d'une sonde serveur : le mode
   * « un e-mail » n'est proposable que si le mecanisme existe derriere, et
   * que si l'administrateur a le droit de s'en servir.
   *
   * ⚠️ Le push n'y figure plus : il n'est pas optionnel, il accompagne la
   * notification. La sonde correspondante a ete retiree de
   * `fetchChannelStates()` avec lui — un appel dont personne ne lit la
   * reponse est un aller-retour paye pour rien.
   */
  channels: {
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
    heading?: string | null;
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
  /**
   * ⚠️⚠️ **Un seul etat, et du texte brut.** Il y en avait deux : `body`, le
   * texte de la notification, et `bodyHtml`, sa mise en forme — qui ne
   * servait **qu'au courriel**, le seul des trois canaux a savoir rendre du
   * gras. Depuis que le courriel est entierement son modele, cette mise en
   * forme ne va plus nulle part : la cloche et l'ecran verrouille affichent
   * du texte nu. Un editeur riche dont le gras n'arrive chez personne est
   * pire qu'un champ simple — il promet une mise en page a l'aveugle.
   */
  const [body, setBody] = React.useState(defaults?.body ?? "");
  /**
   * L'objet propre au courriel, en mode « les deux ».
   *
   * Vide, le courriel prend l'objet de son modele s'il en porte un, puis le
   * titre de la notification. En courriel seul il n'existe pas : le champ
   * « Objet » **est** `title`, puisqu'aucune notification ne part.
   */
  const [emailSubject, setEmailSubject] = React.useState("");
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
  /**
   * ⚠️⚠️ **Le texte du courriel vit dans le modele, plus ici.**
   *
   * L'ecran portait un « Corps de l'e-mail » distinct de celui de la
   * notification, et une case « le courriel reprend le meme texte » pour
   * choisir entre les deux. Les deux ont ete retires : ce qu'un courriel
   * raconte se compose en blocs dans `/admin/notifications/modele`, ou le
   * texte existe **dans les trois langues**. Le champ d'ici, lui, ne pouvait
   * etre ecrit qu'une fois — l'envoi rend pourtant une variante par langue
   * de destinataire, si bien qu'un anglophone lisait un habillage anglais
   * autour d'un corps francais.
   *
   * Ce qui reste a la charge de la diffusion : la cible, les canaux, et le
   * texte de la **notification**, que nul modele ne peut porter — la cloche
   * et l'ecran verrouille n'ont pas de modele.
   */
  /**
   * ⚠️ **Aucun titre pose en tete du courriel.**
   *
   * Signale a l'origine : « le sujet apparait dans le modele ». Le titre de
   * la notification s'y affichait en gros quand le courriel reprenait son
   * texte ; il ne le reprend plus, donc il n'y a plus rien a coiffer. Les
   * titres du courriel sont ceux de ses blocs.
   */
  const mailHeading = null;
  /** L'objet effectif : le sien en mode « les deux », le titre sinon. */
  const mailSubject = mode === "both" ? emailSubject || title : title;
  // Un canal non selectionnable suit son etat impose : le push part toujours
  // quand on ne peut pas le decocher, l'email jamais quand on ne peut pas le
  // cocher.
  /**
   * ⚠️ `targetType !== "emails"` en plus du mode : une adresse sans compte
   * n'a pas de cloche ou deposer une notification. Choisir cette cible bascule
   * deja le mode sur « courriel seul » (`pickSegment`), mais un etat qui
   * reviendrait par un autre chemin ne doit pas pouvoir emettre `in_app` —
   * le Server Action le refuserait, et l'ecran aurait menti jusque-la.
   */
  const notificationOn = mode !== "email" && targetType !== "emails";
  const emailOn = mode !== "notification" && channels.email.selectable;
  /**
   * ⚠️⚠️ **Le courriel ne porte plus aucun texte de la diffusion.**
   *
   * Il en reprenait un : en mode « les deux », le titre et le corps de la
   * notification se posaient dans le bloc « message » du modele. Les deux
   * canaux partageaient donc deux champs, sans que rien a l'ecran ne le
   * dise — « there is no place for mail ». Ils ont maintenant chacun leur
   * section, et la separation va jusqu'au bout : la notification porte son
   * texte, le courriel porte le sien, qui est celui de son modele — ou il
   * existe dans les trois langues.
   */
  const mailBody = "";
  const mailBodyHtml = null;
  /**
   * ⚠️ **Le push n'est plus un choix : il part avec la notification.**
   *
   * Il se decochait, par une case posee dans l'etape des canaux. Elle a ete
   * retiree avec le reste de cette etape, et c'est coherent avec ce que le
   * schema fait deja : **c'est l'ecriture de la notification qui declenche le
   * push**, le couple n'a jamais ete separable dans l'autre sens. Ce qui
   * reste separable — envoyer une notification sans courriel, ou l'inverse —
   * est le mode, choisi en tete d'ecran.
   */
  const pushOn = notificationOn;
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
    // Sixieme pastille : des adresses qui n'ont pas de compte. Elle vit dans
    // la meme barre que les autres parce que c'est une cible comme une autre
    // du point de vue de qui compose — ce qu'elle a de different (courriel
    // seul, pas de nom, pas de langue) se dit sous le champ.
    { value: "emails", label: i18n.t("Adresses saisies"), icon: AtSignIcon, count: null },
  ] as const;

  const selectedSegment = targetType === "role" ? `role:${targetValue}` : targetType;
  // La **meme** analyse que celle du Server Action : le nombre affiche ici est
  // celui qui partira, pas une approximation faite a cote.
  const typed = React.useMemo(
    () => (targetType === "emails" ? parseAddressList(targetValue) : null),
    [targetType, targetValue],
  );
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
              : targetType === "emails"
                ? (typed?.emails.length || null)
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
              : targetType === "emails"
                ? (typed?.emails.length
                    ? i18n.t("{0} adresse(s) saisie(s)", { "0": typed.emails.length })
                    : i18n.t("Saisissez au moins une adresse e-mail valide."))
                : "—";

  const needsPick =
    targetType === "scout_day" || targetType === "user" || targetType === "emails";
  /**
   * ⚠️ **Le bouton doit repondre exactement comme le Server Action.**
   *
   * Il exigeait un corps dans tous les cas, y compris en courriel seul ou
   * l'ecran n'en montre plus aucun a remplir : le bouton restait grise sans
   * qu'on puisse voir pourquoi. Un garde-fou plus severe que la regle qu'il
   * represente ne protege de rien — il cache un geste legitime, exactement
   * comme une permission qui masque un bouton que l'action aurait accepte.
   *
   * La regle, la meme des deux cotes : un titre, une cible quand elle se
   * choisit, et un corps **seulement si une notification part** — la cloche
   * et l'ecran verrouille n'auraient rien a montrer. Le courriel, lui, tient
   * entierement dans les blocs de son modele.
   */
  const needsBody = notificationOn;
  const ready = Boolean(
    title.trim() && (!needsBody || body.trim()) && (!needsPick || targetValue),
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
      // que l'ecran verrouille d'a cote montrait deja son apercu : meme etat
      // vide, deux comportements. Or ce qu'on vient verifier en ouvrant cet
      // onglet, c'est justement le modele — les couleurs, la mise en page,
      // le texte qu'il porte — et rien de cela ne depend de la diffusion.
      //
      // ⚠️ Plus aucun texte d'exemple : ce qui est vide part vide, et c'est
      // ce que le destinataire recevra. En courriel seul, l'apercu est donc
      // exactement le modele.
      previewAction({
        title: mailSubject.trim(),
        heading: mailHeading,
        body: mailBody.trim(),
        bodyHtml: mailBodyHtml,
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
  }, [previewTab, previewLocale, mailSubject, mailHeading, mailBody, mailBodyHtml, templateId, previewAction]);

  /**
   * ⚠️ **Le couple mode / cible se tient dans les deux sens.**
   *
   * Choisir « adresses saisies » basculait bien en courriel seul, mais rien
   * ne se passait dans l'autre sens : on pouvait repasser sur « une
   * notification » en gardant cette cible selectionnee, et l'ecran proposait
   * alors d'envoyer une notification a des adresses qui n'ont pas
   * d'application. Le Server Action l'aurait refuse — apres coup, apres avoir
   * laisse composer tout le message.
   *
   * La cible revient donc a « tous » des qu'un mode qui porte l'in-app est
   * choisi, et la pastille disparait de la barre : elle n'est pas grisee,
   * elle n'a simplement pas de sens ici.
   */
  function pickMode(value: "notification" | "email" | "both") {
    setMode(value);
    if (value !== "email" && targetType === "emails") {
      setTargetType("all");
      setTargetValue("");
    }
  }

  function pickSegment(value: string) {
    if (value.startsWith("role:")) {
      setTargetType("role");
      setTargetValue(value.slice(5));
      return;
    }
    setTargetType(value);
    setTargetValue("");
    setSelectedUser(null);
    // Des adresses sans compte ne peuvent recevoir que du courriel : le mode
    // suit la cible plutot que de laisser choisir un canal impossible.
    if (value === "emails") setMode("email");
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
        setEmailSubject("");
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
                  onClick={() => pickMode("notification")}
                  icon={BellRingIcon}
                  title={i18n.t("Une notification")}
                  hint={i18n.t("Dans l'application, et sur le telephone.")}
                />
                <ModeCard
                  active={mode === "email"}
                  onClick={() => pickMode("email")}
                  icon={MailIcon}
                  title={i18n.t("Un e-mail")}
                  hint={i18n.t("Rien dans l'application, rien sur le telephone.")}
                  disabled={!channels.email.selectable}
                  disabledReason={channels.email.reason}
                />
                <ModeCard
                  active={mode === "both"}
                  onClick={() => pickMode("both")}
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
                  tronquees sans que rien ne defile. La barre en porte cinq ou
                  six selon le mode, ce que seul un `flex-wrap` encaisse. */}
              <div className="flex flex-wrap gap-1 rounded-lg bg-background p-1">
                {SEGMENTS.filter(
                  // Une adresse sans compte ne peut pas recevoir d'in-app :
                  // la pastille n'est proposee qu'en courriel seul.
                  (segment) => segment.value !== "emails" || mode === "email",
                ).map((segment) => {
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
                <Field label={i18n.t("Scout Day concerne")} htmlFor="notif-scout-day">
                  <NativeSelect
                    id="notif-scout-day"
                    name="target_value"
                    required
                    className="h-8 rounded-md border-0 bg-transparent pr-7 pl-0"
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
                </Field>
              ) : null}

              {targetType === "emails" ? (
                <div className="space-y-1.5">
                  <Field label={i18n.t("Adresses e-mail")} htmlFor="notif-addresses">
                    <textarea
                      id="notif-addresses"
                      name="target_value"
                      required
                      rows={4}
                      value={targetValue}
                      onChange={(event) => setTargetValue(event.target.value)}
                      placeholder={i18n.t("marie@exemple.com, karim@exemple.com — une par ligne, ou separees par des virgules")}
                      className="w-full resize-y bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </Field>
                  {/* ⚠️ Ce que la saisie ecarte se lit **avant** d'envoyer.
                      Decouvrir apres coup que douze adresses etaient des
                      doublons, ou qu'une faute de frappe en a fait tomber une,
                      arrive trop tard : une diffusion ne se rappelle pas. */}
                  <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                    {typed?.emails.length
                      ? i18n.t("{0} adresse(s) retenue(s) sur un maximum de {1}.", {
                          "0": typed.emails.length,
                          "1": MAX_TYPED_ADDRESSES,
                        })
                      : i18n.t("Collez des adresses : une par ligne, ou separees par des virgules.")}
                    {typed?.duplicates
                      ? ` ${i18n.t("{0} doublon(s) retire(s).", { "0": typed.duplicates })}`
                      : ""}
                    {typed?.overflow
                      ? ` ${i18n.t("{0} adresse(s) au-dela du plafond de {1} non servie(s).", { "0": typed.overflow, "1": MAX_TYPED_ADDRESSES })}`
                      : ""}
                  </p>
                  {typed?.invalid.length ? (
                    <p className="text-[0.6875rem] leading-relaxed text-warning">
                      {i18n.t("{0} adresse(s) illisible(s) ignoree(s) : {1}.", {
                        "0": typed.invalid.length,
                        "1": typed.invalid.slice(0, 5).join(", "),
                      })}
                    </p>
                  ) : null}
                  {/* Ce que cette cible a de different, dit a sa place plutot
                      que decouvert dans un refus apres l'envoi. */}
                  <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                    {i18n.t("Ces adresses n'ont pas de compte : elles ne recoivent que l'e-mail, en francais, sans leur nom. Un lien de desabonnement est joint, et une adresse desabonnee est ecartee.")}
                  </p>
                </div>
              ) : null}

              {targetType === "user" ? (
                <Field label={i18n.t("Compte destinataire")}>
                  <AccountPicker
                    value={targetValue}
                    selected={selectedUser}
                    onSelect={(account) => {
                      setSelectedUser(account);
                      setTargetValue(account?.id ?? "");
                    }}
                    search={searchAccounts}
                  />
                </Field>
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

            {/* ⚠️⚠️ **Une section par canal, et chacune ne porte que le
                sien.** Il n'y en avait qu'une, « Message », dont les deux
                champs servaient les deux canaux a la fois : le titre de la
                notification etait aussi l'objet du courriel et son titre
                affiche, le corps de la notification etait aussi le texte du
                courriel. Rien a l'ecran ne le disait, et en mode « les deux »
                le courriel n'avait aucun champ a lui — « there is no place
                for mail ». La separation va jusqu'au bout : ce que porte la
                notification ne part plus par courriel, et inversement. */}
            {notificationOn ? (
              <section className="space-y-2">
                <Step number={3} label={i18n.t("La notification")} />
                <Field
                  label={i18n.t("Titre de la notification")}
                  htmlFor="notif-title"
                  aside={<Counter value={title.length} max={64} />}
                >
                  <input
                    id="notif-title"
                    name="title"
                    required
                    maxLength={64}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={i18n.t("Ex : ce que le destinataire lira en premier")}
                    className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </Field>
                <div className="space-y-1.5">
                  {/* ⚠️ Une zone de saisie simple, plus un editeur riche. Le
                      gras ne servait qu'au courriel, qui ne reprend plus ce
                      texte : la cloche et l'ecran verrouille affichent du
                      texte nu, et une barre d'outils qui ne change rien a
                      l'arrivee promet une mise en page imaginaire. */}
                  <Field
                    inset={false}
                    label={i18n.t("Corps du message")}
                    htmlFor="notif-body"
                    aside={<Counter value={body.length} max={LOCK_SCREEN_BODY_CHARS} soft />}
                  >
                    <textarea
                      id="notif-body"
                      name="body"
                      rows={4}
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      placeholder={i18n.t("Detaillez la session, la date et ce que le destinataire doit faire.")}
                      className="w-full resize-y bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
                    />
                  </Field>
                  <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                    {body.length > LOCK_SCREEN_BODY_CHARS
                      ? i18n.t("Au-dela d'environ {0} caracteres, la suite est repliee sur l'ecran verrouille : le message reste entier dans l'application.", { "0": LOCK_SCREEN_BODY_CHARS })
                      : i18n.t("Le texte part tel quel : aucune variable n'est remplacee a l'envoi.")}
                  </p>
                </div>
              </section>
            ) : null}

            {/* ⚠️⚠️ **L'etape des canaux n'existe plus que pour le courriel.**
                Elle montrait trois cartes de canal ; les retirer une a une a
                fini par la vider. Le mode decide deja des canaux, et le push
                n'en est pas un qu'on choisit — c'est l'ecriture de la
                notification qui le declenche. Il ne restait que le modele du
                courriel, qui lui se choisit vraiment : l'etape porte son nom
                et n'apparait que lorsqu'un courriel part. Un titre d'etape
                au-dessus de rien serait pire que l'etape supprimee.

                Le nombre d'appareils joignables, qui tenait dans la carte du
                push, n'est pas perdu : il vit dans « Portee reelle », en
                regard de l'ecran, avec sa barre et sa mise en garde. */}
            {/* Les canaux retenus partent dans `FormData` sous le meme nom,
                comme avant : le Server Action lit `channels` inchange.
                `in_app` et `push` vont ensemble — ils ne se separent plus a
                l'ecran, et ils ne se separaient deja pas en base. */}
            {notificationOn ? <input type="hidden" name="channels" value="in_app" /> : null}
            {pushOn ? <input type="hidden" name="channels" value="push" /> : null}
            {emailOn ? <input type="hidden" name="channels" value="email" /> : null}

            {emailOn ? (
              <section className="space-y-2">
                <Step
                  number={notificationOn ? 4 : 3}
                  label={i18n.t("L'e-mail")}
                />
                {/* L'objet n'a pas la contrainte d'un titre de notification,
                    que l'ecran verrouille tronque : 120 au lieu de 64.
                    ⚠️ En courriel seul c'est `title` : aucune notification ne
                    part, donc le seul titre de la diffusion est cet objet.
                    En mode « les deux » il s'ajoute, facultatif, et vide il
                    laisse le titre de la notification servir de repli. */}
                <Field
                  label={
                    <>
                      {i18n.t("Objet de l'e-mail")}
                      {mode === "both" ? (
                        <span className="ml-1.5 font-normal normal-case text-muted-foreground">
                          {i18n.t("(facultatif)")}
                        </span>
                      ) : null}
                    </>
                  }
                  htmlFor="mail-subject"
                  aside={
                    <Counter value={(mode === "both" ? emailSubject : title).length} max={120} />
                  }
                >
                  <input
                    id="mail-subject"
                    name={mode === "both" ? "email_subject" : "title"}
                    required={mode !== "both"}
                    maxLength={120}
                    value={mode === "both" ? emailSubject : title}
                    onChange={(event) =>
                      mode === "both"
                        ? setEmailSubject(event.target.value)
                        : setTitle(event.target.value)
                    }
                    placeholder={
                      mode === "both"
                        ? title || i18n.t("Ex : ce que le destinataire lira en premier")
                        : i18n.t("Ex : ce que le destinataire lira en premier")
                    }
                    className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </Field>
                {/* ⚠️ Dire que cet objet peut ne pas servir. Un modele qui
                    porte le sien l'impose, langue par langue — et il le doit :
                    celui-ci ne peut etre ecrit qu'une fois, pour des
                    destinataires qui ne lisent pas tous la meme langue. */}
                <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
                  {i18n.t("Si le modele choisi porte son propre objet, c'est le sien qui part, dans la langue de chaque destinataire.")}
                </p>
                <p className="rounded-lg bg-muted px-3 py-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
                  {i18n.t("Le texte de ce courriel vient du modele choisi ci-dessous, ou il est ecrit dans les trois langues. Chaque destinataire le recoit dans la sienne.")}
                </p>
                {templates.length ? (
                <Field
                  label={i18n.t("Modele d'e-mail")}
                  htmlFor="notif-template"
                  aside={
                    <a
                      href={templatesHref}
                      className="text-[0.6875rem] font-semibold text-brand hover:underline"
                    >
                      {i18n.t("Voir les modeles")}
                    </a>
                  }
                >
                  <NativeSelect
                    id="notif-template"
                    name="email_template"
                    className="h-8 rounded-md border-0 bg-transparent pr-7 pl-0"
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
                </Field>
                ) : null}
              </section>
            ) : null}

            {/* Hors de l'etape : un courriel qui ne peut pas partir n'est pas
                un reglage d'envoi, c'est un refus a lire avant d'essayer. */}
            {mode === "email" && !channels.email.selectable ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-destructive">
                {channels.email.reason}
              </p>
            ) : null}

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
                  // Meme regle que l'envoi : un test refuse la ou la
                  // diffusion passerait ne testerait rien d'utile.
                  disabled={testing || pending || !ready}
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

/**
 * Un champ encadre, libelle pose dans l'encoche de sa bordure.
 *
 * Le cadre est un vrai `<fieldset>` : c'est le navigateur qui interrompt la
 * bordure sous le `<legend>`, rien n'est simule a coups de fond opaque, et le
 * libelle reste rattache au champ pour un lecteur d'ecran.
 *
 * ⚠️ **Le cadre ne bouge pas, jamais.** Un champ qui ne se dessinait qu'une
 * fois touche laissait l'ecran vide de limites ; mais un cadre qui change de
 * couleur au clic se lit comme un **second** cadre pose sur le premier, ce
 * qui etait le reproche. ⚠️ `:focus-visible` n'est pas un garde-fou ici :
 * Chrome le fait correspondre **aussi a la souris** sur un champ texte, ou
 * l'on attend une saisie au clavier — la regle « clavier seulement » colorait
 * donc le cadre a chaque clic. C'est le **libelle** qui prend la couleur de la
 * marque quand le champ a le focus : une tabulation reste suivable sans qu'un
 * trait se redessine.
 *
 * `aside` — un compteur, un lien — se pose sur la bordure a droite : il faut
 * donc lui donner le fond exact de la surface qui porte le cadre, d'ou
 * `surface`. Sur le mauvais fond, le trait reapparaitrait derriere.
 */
function Field({
  label,
  htmlFor,
  aside,
  surface = "card",
  inset = true,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  aside?: React.ReactNode;
  /** Fond de la surface qui porte le cadre, recopie derriere `aside`. */
  surface?: "card" | "background";
  /** `false` quand l'enfant porte deja ses marges (l'editeur riche). */
  inset?: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="group relative min-w-0 rounded-lg border border-border pt-1">
      <legend className="micro-label ml-2.5 px-1.5 text-muted-foreground transition-colors group-focus-within:text-brand">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
      </legend>
      {aside ? (
        <span
          className={cn(
            "absolute -top-2 right-2.5 px-1.5",
            surface === "card" ? "bg-card" : "bg-background",
          )}
        >
          {aside}
        </span>
      ) : null}
      {inset ? <div className="px-3 pb-2.5">{children}</div> : children}
    </fieldset>
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
