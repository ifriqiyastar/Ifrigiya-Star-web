import { getAdminI18n } from "@/lib/i18n/admin";
import Link from "next/link";
import {
  BadgeCheckIcon,
  CalendarIcon,
  FlagIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";

import { DefinitionList, type DefinitionItem } from "@/components/admin/definition-list";
import { DocumentFrame, DocumentLink } from "@/components/admin/document-frame";
import { StatusPill } from "@/components/admin/status-pill";
import { ageFromBirthDate } from "@/lib/format";
import { ACCOUNT_STATUS, DOCUMENT_STATUS, FOOT_PREFERENCE, IDENTITY_STATUS, PLAYER_LEVEL, PROFESSIONAL_TYPE } from "@/lib/labels";
import { displayName, type ProfileSummary } from "@/lib/queries/profiles";
import { privateStorageUrl } from "@/lib/supabase/config";

/**
 * Le dossier complet d'une demande de validation, rendu dans une modale.
 *
 * POURQUOI. Les files de validation montraient six colonnes — nom, age, ville,
 * poste, KYC, date. On y validait donc un compte sans avoir vu la moitie de ce
 * qu'on validait : la nationalite, le club, le representant legal d'un mineur,
 * les pieces deja refusees. Le dossier rassemble tout ce que la base sait de
 * la demande, au moment ou la decision se prend.
 *
 * ⚠️ **Ces composants ne requetent rien.** `DetailDialog` rend ses enfants
 * cote serveur, donc une file de cent lignes construit cent dossiers meme si
 * personne n'en ouvre un : toutes les donnees sont chargees en amont par la
 * page, en une requete par table (`.in(...)`), jamais une par ligne.
 *
 * Les gestes de decision restent sur la ligne, a cote du bouton qui ouvre le
 * dossier : `ReasonDialog` est lui-meme une modale, et deux dialogues
 * superposes se disputent le focus et la touche Echap.
 */

/* ------------------------------------------------------------------ commun */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </section>
  );
}

/** L'identite du compte, commune aux quatre files. */
async function AccountHeader({
  profile,
  fallbackName,
  extra,
}: {
  profile?: ProfileSummary;
  fallbackName?: string;
  extra?: React.ReactNode;
}) {
  const i18n = await getAdminI18n();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-4">
      {profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar_url}
          alt=""
          className="size-12 shrink-0 rounded-full border border-border object-cover"
        />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary">
          <UserIcon className="size-5 text-muted-foreground" />
        </span>
      )}
      <div className="min-w-0">
        <p className="font-medium">{displayName(profile, [fallbackName], i18n.locale)}</p>
        <p className="text-xs text-muted-foreground">{profile?.email ?? i18n.t("Email inconnu")}</p>
      </div>
      <span className="flex-1" />
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        {profile ? (
          <Link
            href={i18n.path(`/admin/utilisateurs/${profile.id}`)}
            className="text-xs font-medium text-brand hover:underline"
          >
            {i18n.t("Fiche complete")}</Link>
        ) : null}
      </div>
    </div>
  );
}

const orDash = (value: React.ReactNode) =>
  value === null || value === undefined || value === "" ? "—" : value;

/* ----------------------------------------------------------------- joueurs */

export type GuardianRow = {
  id: string;
  player_id: string;
  full_name: string;
  relationship: string | null;
  email: string | null;
  phone: string | null;
  id_document_storage_path: string | null;
  consent_document_storage_path: string | null;
  consent_given: boolean;
  consent_given_at: string | null;
  status: string;
};

export type ClubHistoryRow = {
  id: string;
  player_id: string;
  club_name: string;
  start_date: string | null;
  end_date: string | null;
};

export type IdentityRow = {
  id: string;
  player_id: string;
  document_type: string;
  storage_path: string | null;
  status: string;
  facial_check_provider: string | null;
  facial_check_passed: boolean | null;
  rejection_reason?: string | null;
  created_at: string;
};

export async function PlayerDossier({
  player,
  profile,
  identity,
  guardian,
  clubs,
  mediaCounts,
}: {
  player: Record<string, string | number | boolean | null>;
  profile?: ProfileSummary;
  identity?: IdentityRow;
  guardian?: GuardianRow;
  clubs: ClubHistoryRow[];
  mediaCounts: { videos: number; photos: number };
}) {
  const i18n = await getAdminI18n();

  const age = ageFromBirthDate(player.birth_date as string | null);
  const isMinor = Boolean(profile?.is_minor) || (age !== null && age < 18);

  const items: DefinitionItem[] = [
    { label: i18n.t("Nom complet"), icon: UserIcon, value: orDash(
      [player.first_name, player.last_name].filter(Boolean).join(" ") || null) },
    { label: i18n.t("Date de naissance"), icon: CalendarIcon, value: player.birth_date
      ? `${i18n.format.formatDate(player.birth_date as string)}${age !== null ? i18n.t(" — {0} ans", { "0": age }) : ""}`
      : "—" },
    { label: i18n.t("Nationalite"), icon: FlagIcon, value: orDash(player.nationality) },
    { label: i18n.t("Localisation"), icon: MapPinIcon, value: orDash(
      [player.city, player.country].filter(Boolean).join(", ") || null) },
    { label: i18n.t("Email"), icon: MailIcon, value: orDash(profile?.email) },
    { label: i18n.t("Telephone"), icon: PhoneIcon, value: orDash(profile?.phone) },
    { label: i18n.t("Poste principal"), value: i18n.labels.position(player.main_position ? String(player.main_position) : null) },
    { label: i18n.t("Poste secondaire"), value: i18n.labels.position(player.secondary_position ? String(player.secondary_position) : null) },
    { label: i18n.t("Niveau"), value: player.level ? i18n.labels.label(PLAYER_LEVEL, player.level as string) : "—" },
    { label: i18n.t("Pied fort"), value: player.foot_preference
      ? i18n.labels.label(FOOT_PREFERENCE, player.foot_preference as string)
      : "—" },
    { label: i18n.t("Gabarit"), value: orDash(
      [player.height_cm ? i18n.t("{0} cm", { "0": player.height_cm }) : null,
       player.weight_kg ? i18n.t("{0} kg", { "0": player.weight_kg }) : null].filter(Boolean).join(" · ") || null) },
    { label: i18n.t("Club actuel"), value: player.is_free_agent
      ? i18n.t("Libre de tout contrat")
      : orDash(player.current_club) },
    { label: i18n.t("Compte cree le"), value: i18n.format.formatDateTime(player.created_at as string) },
    { label: i18n.t("Derniere modification"), value: i18n.format.formatDateTime(player.updated_at as string) },
  ];

  return (
    <div className="space-y-5">
      <AccountHeader
        profile={profile}
        fallbackName={[player.first_name, player.last_name].filter(Boolean).join(" ")}
        extra={
          <>
            <StatusPill tone={i18n.labels.entry(ACCOUNT_STATUS, player.status as string).tone}>
              {i18n.labels.label(ACCOUNT_STATUS, player.status as string)}
            </StatusPill>
            {isMinor ? <StatusPill tone="warning">{i18n.t("Mineur")}</StatusPill> : null}
            {player.is_visible === false ? (
              <StatusPill tone="neutral">{i18n.t("Profil masque")}</StatusPill>
            ) : null}
          </>
        }
      />

      <Section title={i18n.t("Profil sportif et identite")}>
        <DefinitionList items={items} />
      </Section>

      {player.about ? (
        <Section title={i18n.t("Presentation")}>
          <p className="rounded-xl border border-border bg-background p-4 text-sm leading-relaxed whitespace-pre-line">
            {player.about as string}
          </p>
        </Section>
      ) : null}

      {player.status_reason ? (
        <Section title={i18n.t("Motif du precedent passage")}>
          <p className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-relaxed">
            {player.status_reason as string}
          </p>
        </Section>
      ) : null}

      <Section title={i18n.t("Parcours en club")}>
        {!clubs.length ? (
          <p className="rounded-xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
            {i18n.t("Aucun club declare. Ce n'est pas bloquant : le parcours est facultatif.")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {clubs.map((club) => (
              <li key={club.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <span className="font-medium">{club.club_name}</span>
                <span className="flex-1" />
                <span className="text-xs text-muted-foreground">
                  {club.start_date ? i18n.format.formatDate(club.start_date) : "?"} →{" "}
                  {club.end_date ? i18n.format.formatDate(club.end_date) : i18n.t("aujourd'hui")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={i18n.t("Piece d'identite (KYC)")}>
        {!identity ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            {i18n.t("Aucun dossier d'identite depose. Valider le profil ouvre l'acces a l'application sans qu'aucune piece n'ait ete verifiee.")}</p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={i18n.labels.entry(IDENTITY_STATUS, identity.status).tone}>
                {i18n.labels.label(IDENTITY_STATUS, identity.status)}
              </StatusPill>
              <StatusPill tone="neutral">{identity.document_type.toUpperCase()}</StatusPill>
              {identity.facial_check_provider ? (
                <StatusPill tone={identity.facial_check_passed ? "success" : "danger"}>
                  {i18n.t("Controle facial")} {identity.facial_check_passed ? "reussi" : "echoue"}
                </StatusPill>
              ) : (
                <StatusPill tone="neutral">{i18n.t("Controle facial non realise")}</StatusPill>
              )}
              <span className="text-xs text-muted-foreground">
                {i18n.t("Depose le")} {i18n.format.formatDateTime(identity.created_at)}
              </span>
            </div>
            {identity.rejection_reason ? (
              <p className="text-xs text-destructive">{i18n.t("Motif de refus :")} {identity.rejection_reason}</p>
            ) : null}
            {identity.storage_path ? (
              <DocumentFrame
                url={privateStorageUrl("identity-documents", identity.storage_path)!}
                label={i18n.t("Piece d'identite — {0}", { "0": identity.document_type.toUpperCase() })}
              />
            ) : (
              <DocumentLink url={null} label={i18n.t("Piece d'identite")} />
            )}
          </div>
        )}
      </Section>

      {isMinor ? (
        <Section title={i18n.t("Representant legal (§4.2)")}>
          {!guardian ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              {i18n.t("Compte mineur sans representant legal declare. Le consentement d'un representant est requis avant toute validation.")}</p>
          ) : (
            <div className="space-y-2">
              <DefinitionList
                items={[
                  { label: i18n.t("Representant"), icon: UserIcon, value: guardian.full_name },
                  { label: i18n.t("Lien"), value: orDash(guardian.relationship) },
                  { label: i18n.t("Email"), icon: MailIcon, value: orDash(guardian.email) },
                  { label: i18n.t("Telephone"), icon: PhoneIcon, value: orDash(guardian.phone) },
                  {
                    label: i18n.t("Consentement"),
                    icon: BadgeCheckIcon,
                    value: guardian.consent_given ? (
                      <StatusPill tone="success">
                        {i18n.t("Donne le")} {i18n.format.formatDate(guardian.consent_given_at)}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="danger">{i18n.t("Non donne")}</StatusPill>
                    ),
                  },
                  {
                    label: i18n.t("Dossier representant"),
                    value: (
                      <StatusPill tone={i18n.labels.entry(DOCUMENT_STATUS, guardian.status).tone}>
                        {i18n.labels.label(DOCUMENT_STATUS, guardian.status)}
                      </StatusPill>
                    ),
                  },
                ]}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <DocumentLink
                  url={privateStorageUrl("guardian-documents", guardian.id_document_storage_path)}
                  label={i18n.t("Piece d'identite du representant")}
                />
                <DocumentLink
                  url={privateStorageUrl(
                    "guardian-documents",
                    guardian.consent_document_storage_path,
                  )}
                  label={i18n.t("Attestation de consentement")}
                />
              </div>
            </div>
          )}
        </Section>
      ) : null}

      <Section title={i18n.t("Medias deposes")}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="neutral">{mediaCounts.videos}  {i18n.t("video(s)")}</StatusPill>
          <StatusPill tone="neutral">{mediaCounts.photos}  {i18n.t("photo(s)")}</StatusPill>
          <span className="text-xs text-muted-foreground">
            {i18n.t("Les medias se moderent depuis l'ecran Moderation, pas ici.")}</span>
        </div>
      </Section>
    </div>
  );
}

/* ---------------------------------------------------------- professionnels */

export type ProDocumentRow = {
  id: string;
  professional_id: string;
  document_label: string;
  storage_path: string | null;
  status: string;
  created_at?: string;
};

export async function ProfessionalDossier({
  pro,
  profile,
  documents,
}: {
  pro: Record<string, string | null>;
  profile?: ProfileSummary;
  documents: ProDocumentRow[];
}) {
  const i18n = await getAdminI18n();

  const pending = documents.filter((document) => document.status === "en_attente").length;

  return (
    <div className="space-y-5">
      <AccountHeader
        profile={profile}
        fallbackName={pro.contact_full_name ?? pro.organization_name ?? undefined}
        extra={
          <>
            <StatusPill tone={i18n.labels.entry(ACCOUNT_STATUS, pro.status as string).tone}>
              {i18n.labels.label(ACCOUNT_STATUS, pro.status as string)}
            </StatusPill>
            {pending ? (
              <StatusPill tone="warning">{pending}  {i18n.t("piece(s) non tranchee(s)")}</StatusPill>
            ) : null}
          </>
        }
      />

      <Section title={i18n.t("Structure et contact")}>
        <DefinitionList
          items={[
            {
              label: i18n.t("Type"),
              icon: BadgeCheckIcon,
              value: pro.professional_type
                ? i18n.labels.label(PROFESSIONAL_TYPE, pro.professional_type)
                : "—",
            },
            { label: i18n.t("Organisation"), value: orDash(pro.organization_name) },
            { label: i18n.t("Contact"), icon: UserIcon, value: orDash(pro.contact_full_name) },
            { label: i18n.t("Fonction"), value: orDash(pro.position_title) },
            {
              label: i18n.t("Localisation"),
              icon: MapPinIcon,
              value: orDash([pro.city, pro.country].filter(Boolean).join(", ") || null),
            },
            { label: i18n.t("Email"), icon: MailIcon, value: orDash(profile?.email) },
            { label: i18n.t("Telephone"), icon: PhoneIcon, value: orDash(profile?.phone) },
            { label: i18n.t("Compte cree le"), value: i18n.format.formatDateTime(pro.created_at) },
          ]}
        />
      </Section>

      {pro.status_reason ? (
        <Section title={i18n.t("Motif du precedent passage")}>
          <p className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-relaxed">
            {pro.status_reason}
          </p>
        </Section>
      ) : null}

      <Section title={i18n.t("Justificatifs professionnels")}>
        {!documents.length ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            {i18n.t("Aucun justificatif depose. Valider ce compte lui ouvre la base joueurs sans qu'aucune piece n'ait ete produite.")}</p>
        ) : (
          <div className="space-y-2">
            {documents.map((document) => (
              <div key={document.id} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={i18n.labels.entry(DOCUMENT_STATUS, document.status).tone}>
                    {i18n.labels.label(DOCUMENT_STATUS, document.status)}
                  </StatusPill>
                  <span className="text-sm font-medium">{document.document_label}</span>
                </div>
                {document.storage_path ? (
                  <DocumentFrame
                    url={privateStorageUrl("professional-documents", document.storage_path)!}
                    label={document.document_label}
                  />
                ) : (
                  <DocumentLink url={null} label={document.document_label} />
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              {i18n.t("Chaque piece se valide ou se refuse dans l'onglet « Justificatifs pro » : le statut du compte et celui des pieces sont deux decisions distinctes.")}</p>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------- piece d'identite */

export async function IdentityDossier({
  identity,
  profile,
  player,
  guardian,
}: {
  identity: IdentityRow;
  profile?: ProfileSummary;
  player?: Record<string, string | null>;
  guardian?: GuardianRow;
}) {
  const i18n = await getAdminI18n();

  const age = ageFromBirthDate(player?.birth_date ?? null);
  const declared = [player?.first_name, player?.last_name].filter(Boolean).join(" ");

  return (
    <div className="space-y-5">
      <AccountHeader
        profile={profile}
        fallbackName={declared}
        extra={
          <>
            <StatusPill tone={i18n.labels.entry(IDENTITY_STATUS, identity.status).tone}>
              {i18n.labels.label(IDENTITY_STATUS, identity.status)}
            </StatusPill>
            {profile?.is_minor || (age !== null && age < 18) ? (
              <StatusPill tone="warning">{i18n.t("Mineur")}</StatusPill>
            ) : null}
          </>
        }
      />

      <Section title={i18n.t("Ce qui doit concorder avec la piece")}>
        <DefinitionList
          items={[
            { label: i18n.t("Nom declare"), icon: UserIcon, value: orDash(declared || null) },
            {
              label: i18n.t("Date de naissance declaree"),
              icon: CalendarIcon,
              value: player?.birth_date
                ? `${i18n.format.formatDate(player.birth_date)}${age !== null ? i18n.t(" — {0} ans", { "0": age }) : ""}`
                : "—",
            },
            { label: i18n.t("Nationalite declaree"), icon: FlagIcon, value: orDash(player?.nationality) },
            { label: i18n.t("Type de piece"), icon: ShieldCheckIcon, value: identity.document_type.toUpperCase() },
            {
              label: i18n.t("Controle facial"),
              value: identity.facial_check_provider ? (
                <StatusPill tone={identity.facial_check_passed ? "success" : "danger"}>
                  {identity.facial_check_passed ? i18n.t("Reussi") : i18n.t("Echoue")} —{" "}
                  {identity.facial_check_provider}
                </StatusPill>
              ) : (
                i18n.t("Non realise")
              ),
            },
            { label: i18n.t("Depose le"), value: i18n.format.formatDateTime(identity.created_at) },
          ]}
        />
      </Section>

      {guardian ? (
        <Section title={i18n.t("Representant legal")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <DocumentLink
              url={privateStorageUrl("guardian-documents", guardian.id_document_storage_path)}
              label={i18n.t("Piece de {0}", { "0": guardian.full_name })}
              hint={guardian.relationship ?? undefined}
            />
            <DocumentLink
              url={privateStorageUrl("guardian-documents", guardian.consent_document_storage_path)}
              label={i18n.t("Attestation de consentement")}
              hint={guardian.consent_given ? i18n.t("Consentement donne") : i18n.t("Consentement non donne")}
            />
          </div>
        </Section>
      ) : null}

      <Section title={i18n.t("Document")}>
        {identity.storage_path ? (
          <DocumentFrame
            url={privateStorageUrl("identity-documents", identity.storage_path)!}
            label={i18n.t("Piece d'identite — {0}", { "0": identity.document_type.toUpperCase() })}
          />
        ) : (
          <DocumentLink url={null} label={i18n.t("Piece d'identite")} />
        )}
      </Section>

      <p className="rounded-xl border border-border bg-background px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        {i18n.t("Valider ici ne valide")} <strong>{i18n.t("pas")}</strong>  {i18n.t("le compte : l'application mobile lit le statut du profil joueur, qui se tranche dans la file « Profils joueurs ».")}</p>
    </div>
  );
}

/* -------------------------------------------------------- justificatif pro */

export async function DocumentDossier({
  document,
  profile,
  pro,
  siblings,
}: {
  document: ProDocumentRow;
  profile?: ProfileSummary;
  pro?: Record<string, string | null>;
  siblings: ProDocumentRow[];
}) {
  const i18n = await getAdminI18n();

  const others = siblings.filter((row) => row.id !== document.id);

  return (
    <div className="space-y-5">
      <AccountHeader
        profile={profile}
        fallbackName={pro?.contact_full_name ?? pro?.organization_name ?? undefined}
        extra={
          <StatusPill tone={i18n.labels.entry(DOCUMENT_STATUS, document.status).tone}>
            {i18n.labels.label(DOCUMENT_STATUS, document.status)}
          </StatusPill>
        }
      />

      <Section title={i18n.t("Compte rattache")}>
        <DefinitionList
          items={[
            {
              label: i18n.t("Type"),
              icon: BadgeCheckIcon,
              value: pro?.professional_type ? i18n.labels.label(PROFESSIONAL_TYPE, pro.professional_type) : "—",
            },
            { label: i18n.t("Organisation"), value: orDash(pro?.organization_name) },
            { label: i18n.t("Fonction"), value: orDash(pro?.position_title) },
            {
              label: i18n.t("Statut du compte"),
              value: pro?.status ? (
                <StatusPill tone={i18n.labels.entry(ACCOUNT_STATUS, pro.status).tone}>
                  {i18n.labels.label(ACCOUNT_STATUS, pro.status)}
                </StatusPill>
              ) : (
                "—"
              ),
            },
          ]}
        />
      </Section>

      <Section title={document.document_label}>
        {document.storage_path ? (
          <DocumentFrame
            url={privateStorageUrl("professional-documents", document.storage_path)!}
            label={document.document_label}
            hint={document.created_at ? i18n.t("Depose le {0}", { "0": i18n.format.formatDate(document.created_at) }) : undefined}
          />
        ) : (
          <DocumentLink url={null} label={document.document_label} />
        )}
      </Section>

      {others.length ? (
        <Section title={i18n.t("Autres pieces du meme compte")}>
          <div className="space-y-2">
            {others.map((row) => (
              <DocumentLink
                key={row.id}
                url={privateStorageUrl("professional-documents", row.storage_path)}
                label={row.document_label}
                hint={i18n.labels.label(DOCUMENT_STATUS, row.status)}
              />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
