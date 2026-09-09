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
import { formatDate, formatDateTime, ageFromBirthDate } from "@/lib/format";
import {
  ACCOUNT_STATUS,
  DOCUMENT_STATUS,
  FOOT_PREFERENCE,
  IDENTITY_STATUS,
  PLAYER_LEVEL,
  PROFESSIONAL_TYPE,
  entry,
  label,
} from "@/lib/labels";
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
function AccountHeader({
  profile,
  fallbackName,
  extra,
}: {
  profile?: ProfileSummary;
  fallbackName?: string;
  extra?: React.ReactNode;
}) {
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
        <p className="font-medium">{displayName(profile, [fallbackName])}</p>
        <p className="text-xs text-muted-foreground">{profile?.email ?? "Email inconnu"}</p>
      </div>
      <span className="flex-1" />
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        {profile ? (
          <Link
            href={`/admin/utilisateurs/${profile.id}`}
            className="text-xs font-medium text-brand hover:underline"
          >
            Fiche complete
          </Link>
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

export function PlayerDossier({
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
  const age = ageFromBirthDate(player.birth_date as string | null);
  const isMinor = Boolean(profile?.is_minor) || (age !== null && age < 18);

  const items: DefinitionItem[] = [
    { label: "Nom complet", icon: UserIcon, value: orDash(
      [player.first_name, player.last_name].filter(Boolean).join(" ") || null) },
    { label: "Date de naissance", icon: CalendarIcon, value: player.birth_date
      ? `${formatDate(player.birth_date as string)}${age !== null ? ` — ${age} ans` : ""}`
      : "—" },
    { label: "Nationalite", icon: FlagIcon, value: orDash(player.nationality) },
    { label: "Localisation", icon: MapPinIcon, value: orDash(
      [player.city, player.country].filter(Boolean).join(", ") || null) },
    { label: "Email", icon: MailIcon, value: orDash(profile?.email) },
    { label: "Telephone", icon: PhoneIcon, value: orDash(profile?.phone) },
    { label: "Poste principal", value: orDash(player.main_position) },
    { label: "Poste secondaire", value: orDash(player.secondary_position) },
    { label: "Niveau", value: player.level ? label(PLAYER_LEVEL, player.level as string) : "—" },
    { label: "Pied fort", value: player.foot_preference
      ? label(FOOT_PREFERENCE, player.foot_preference as string)
      : "—" },
    { label: "Gabarit", value: orDash(
      [player.height_cm ? `${player.height_cm} cm` : null,
       player.weight_kg ? `${player.weight_kg} kg` : null].filter(Boolean).join(" · ") || null) },
    { label: "Club actuel", value: player.is_free_agent
      ? "Libre de tout contrat"
      : orDash(player.current_club) },
    { label: "Compte cree le", value: formatDateTime(player.created_at as string) },
    { label: "Derniere modification", value: formatDateTime(player.updated_at as string) },
  ];

  return (
    <div className="space-y-5">
      <AccountHeader
        profile={profile}
        fallbackName={[player.first_name, player.last_name].filter(Boolean).join(" ")}
        extra={
          <>
            <StatusPill tone={entry(ACCOUNT_STATUS, player.status as string).tone}>
              {label(ACCOUNT_STATUS, player.status as string)}
            </StatusPill>
            {isMinor ? <StatusPill tone="warning">Mineur</StatusPill> : null}
            {player.is_visible === false ? (
              <StatusPill tone="neutral">Profil masque</StatusPill>
            ) : null}
          </>
        }
      />

      <Section title="Profil sportif et identite">
        <DefinitionList items={items} />
      </Section>

      {player.about ? (
        <Section title="Presentation">
          <p className="rounded-xl border border-border bg-background p-4 text-sm leading-relaxed whitespace-pre-line">
            {player.about as string}
          </p>
        </Section>
      ) : null}

      {player.status_reason ? (
        <Section title="Motif du precedent passage">
          <p className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-relaxed">
            {player.status_reason as string}
          </p>
        </Section>
      ) : null}

      <Section title="Parcours en club">
        {!clubs.length ? (
          <p className="rounded-xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
            Aucun club declare. Ce n&apos;est pas bloquant : le parcours est facultatif.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {clubs.map((club) => (
              <li key={club.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <span className="font-medium">{club.club_name}</span>
                <span className="flex-1" />
                <span className="text-xs text-muted-foreground">
                  {club.start_date ? formatDate(club.start_date) : "?"} →{" "}
                  {club.end_date ? formatDate(club.end_date) : "aujourd'hui"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Piece d'identite (KYC)">
        {!identity ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            Aucun dossier d&apos;identite depose. Valider le profil ouvre l&apos;acces a
            l&apos;application sans qu&apos;aucune piece n&apos;ait ete verifiee.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={entry(IDENTITY_STATUS, identity.status).tone}>
                {label(IDENTITY_STATUS, identity.status)}
              </StatusPill>
              <StatusPill tone="neutral">{identity.document_type.toUpperCase()}</StatusPill>
              {identity.facial_check_provider ? (
                <StatusPill tone={identity.facial_check_passed ? "success" : "danger"}>
                  Controle facial {identity.facial_check_passed ? "reussi" : "echoue"}
                </StatusPill>
              ) : (
                <StatusPill tone="neutral">Controle facial non realise</StatusPill>
              )}
              <span className="text-xs text-muted-foreground">
                Depose le {formatDateTime(identity.created_at)}
              </span>
            </div>
            {identity.rejection_reason ? (
              <p className="text-xs text-destructive">Motif de refus : {identity.rejection_reason}</p>
            ) : null}
            {identity.storage_path ? (
              <DocumentFrame
                url={privateStorageUrl("identity-documents", identity.storage_path)!}
                label={`Piece d'identite — ${identity.document_type.toUpperCase()}`}
              />
            ) : (
              <DocumentLink url={null} label="Piece d'identite" />
            )}
          </div>
        )}
      </Section>

      {isMinor ? (
        <Section title="Representant legal (§4.2)">
          {!guardian ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              Compte mineur sans representant legal declare. Le consentement d&apos;un
              representant est requis avant toute validation.
            </p>
          ) : (
            <div className="space-y-2">
              <DefinitionList
                items={[
                  { label: "Representant", icon: UserIcon, value: guardian.full_name },
                  { label: "Lien", value: orDash(guardian.relationship) },
                  { label: "Email", icon: MailIcon, value: orDash(guardian.email) },
                  { label: "Telephone", icon: PhoneIcon, value: orDash(guardian.phone) },
                  {
                    label: "Consentement",
                    icon: BadgeCheckIcon,
                    value: guardian.consent_given ? (
                      <StatusPill tone="success">
                        Donne le {formatDate(guardian.consent_given_at)}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="danger">Non donne</StatusPill>
                    ),
                  },
                  {
                    label: "Dossier representant",
                    value: (
                      <StatusPill tone={entry(DOCUMENT_STATUS, guardian.status).tone}>
                        {label(DOCUMENT_STATUS, guardian.status)}
                      </StatusPill>
                    ),
                  },
                ]}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <DocumentLink
                  url={privateStorageUrl("guardian-documents", guardian.id_document_storage_path)}
                  label="Piece d'identite du representant"
                />
                <DocumentLink
                  url={privateStorageUrl(
                    "guardian-documents",
                    guardian.consent_document_storage_path,
                  )}
                  label="Attestation de consentement"
                />
              </div>
            </div>
          )}
        </Section>
      ) : null}

      <Section title="Medias deposes">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="neutral">{mediaCounts.videos} video(s)</StatusPill>
          <StatusPill tone="neutral">{mediaCounts.photos} photo(s)</StatusPill>
          <span className="text-xs text-muted-foreground">
            Les medias se moderent depuis l&apos;ecran Moderation, pas ici.
          </span>
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

export function ProfessionalDossier({
  pro,
  profile,
  documents,
}: {
  pro: Record<string, string | null>;
  profile?: ProfileSummary;
  documents: ProDocumentRow[];
}) {
  const pending = documents.filter((document) => document.status === "en_attente").length;

  return (
    <div className="space-y-5">
      <AccountHeader
        profile={profile}
        fallbackName={pro.contact_full_name ?? pro.organization_name ?? undefined}
        extra={
          <>
            <StatusPill tone={entry(ACCOUNT_STATUS, pro.status as string).tone}>
              {label(ACCOUNT_STATUS, pro.status as string)}
            </StatusPill>
            {pending ? (
              <StatusPill tone="warning">{pending} piece(s) non tranchee(s)</StatusPill>
            ) : null}
          </>
        }
      />

      <Section title="Structure et contact">
        <DefinitionList
          items={[
            {
              label: "Type",
              icon: BadgeCheckIcon,
              value: pro.professional_type
                ? label(PROFESSIONAL_TYPE, pro.professional_type)
                : "—",
            },
            { label: "Organisation", value: orDash(pro.organization_name) },
            { label: "Contact", icon: UserIcon, value: orDash(pro.contact_full_name) },
            { label: "Fonction", value: orDash(pro.position_title) },
            {
              label: "Localisation",
              icon: MapPinIcon,
              value: orDash([pro.city, pro.country].filter(Boolean).join(", ") || null),
            },
            { label: "Email", icon: MailIcon, value: orDash(profile?.email) },
            { label: "Telephone", icon: PhoneIcon, value: orDash(profile?.phone) },
            { label: "Compte cree le", value: formatDateTime(pro.created_at) },
          ]}
        />
      </Section>

      {pro.status_reason ? (
        <Section title="Motif du precedent passage">
          <p className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm leading-relaxed">
            {pro.status_reason}
          </p>
        </Section>
      ) : null}

      <Section title="Justificatifs professionnels">
        {!documents.length ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            Aucun justificatif depose. Valider ce compte lui ouvre la base joueurs sans
            qu&apos;aucune piece n&apos;ait ete produite.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((document) => (
              <div key={document.id} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={entry(DOCUMENT_STATUS, document.status).tone}>
                    {label(DOCUMENT_STATUS, document.status)}
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
              Chaque piece se valide ou se refuse dans l&apos;onglet « Justificatifs pro » :
              le statut du compte et celui des pieces sont deux decisions distinctes.
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------- piece d'identite */

export function IdentityDossier({
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
  const age = ageFromBirthDate(player?.birth_date ?? null);
  const declared = [player?.first_name, player?.last_name].filter(Boolean).join(" ");

  return (
    <div className="space-y-5">
      <AccountHeader
        profile={profile}
        fallbackName={declared}
        extra={
          <>
            <StatusPill tone={entry(IDENTITY_STATUS, identity.status).tone}>
              {label(IDENTITY_STATUS, identity.status)}
            </StatusPill>
            {profile?.is_minor || (age !== null && age < 18) ? (
              <StatusPill tone="warning">Mineur</StatusPill>
            ) : null}
          </>
        }
      />

      <Section title="Ce qui doit concorder avec la piece">
        <DefinitionList
          items={[
            { label: "Nom declare", icon: UserIcon, value: orDash(declared || null) },
            {
              label: "Date de naissance declaree",
              icon: CalendarIcon,
              value: player?.birth_date
                ? `${formatDate(player.birth_date)}${age !== null ? ` — ${age} ans` : ""}`
                : "—",
            },
            { label: "Nationalite declaree", icon: FlagIcon, value: orDash(player?.nationality) },
            { label: "Type de piece", icon: ShieldCheckIcon, value: identity.document_type.toUpperCase() },
            {
              label: "Controle facial",
              value: identity.facial_check_provider ? (
                <StatusPill tone={identity.facial_check_passed ? "success" : "danger"}>
                  {identity.facial_check_passed ? "Reussi" : "Echoue"} —{" "}
                  {identity.facial_check_provider}
                </StatusPill>
              ) : (
                "Non realise"
              ),
            },
            { label: "Depose le", value: formatDateTime(identity.created_at) },
          ]}
        />
      </Section>

      {guardian ? (
        <Section title="Representant legal">
          <div className="grid gap-2 sm:grid-cols-2">
            <DocumentLink
              url={privateStorageUrl("guardian-documents", guardian.id_document_storage_path)}
              label={`Piece de ${guardian.full_name}`}
              hint={guardian.relationship ?? undefined}
            />
            <DocumentLink
              url={privateStorageUrl("guardian-documents", guardian.consent_document_storage_path)}
              label="Attestation de consentement"
              hint={guardian.consent_given ? "Consentement donne" : "Consentement non donne"}
            />
          </div>
        </Section>
      ) : null}

      <Section title="Document">
        {identity.storage_path ? (
          <DocumentFrame
            url={privateStorageUrl("identity-documents", identity.storage_path)!}
            label={`Piece d'identite — ${identity.document_type.toUpperCase()}`}
          />
        ) : (
          <DocumentLink url={null} label="Piece d'identite" />
        )}
      </Section>

      <p className="rounded-xl border border-border bg-background px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Valider ici ne valide <strong>pas</strong> le compte : l&apos;application mobile lit le
        statut du profil joueur, qui se tranche dans la file « Profils joueurs ».
      </p>
    </div>
  );
}

/* -------------------------------------------------------- justificatif pro */

export function DocumentDossier({
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
  const others = siblings.filter((row) => row.id !== document.id);

  return (
    <div className="space-y-5">
      <AccountHeader
        profile={profile}
        fallbackName={pro?.contact_full_name ?? pro?.organization_name ?? undefined}
        extra={
          <StatusPill tone={entry(DOCUMENT_STATUS, document.status).tone}>
            {label(DOCUMENT_STATUS, document.status)}
          </StatusPill>
        }
      />

      <Section title="Compte rattache">
        <DefinitionList
          items={[
            {
              label: "Type",
              icon: BadgeCheckIcon,
              value: pro?.professional_type ? label(PROFESSIONAL_TYPE, pro.professional_type) : "—",
            },
            { label: "Organisation", value: orDash(pro?.organization_name) },
            { label: "Fonction", value: orDash(pro?.position_title) },
            {
              label: "Statut du compte",
              value: pro?.status ? (
                <StatusPill tone={entry(ACCOUNT_STATUS, pro.status).tone}>
                  {label(ACCOUNT_STATUS, pro.status)}
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
            hint={document.created_at ? `Depose le ${formatDate(document.created_at)}` : undefined}
          />
        ) : (
          <DocumentLink url={null} label={document.document_label} />
        )}
      </Section>

      {others.length ? (
        <Section title="Autres pieces du meme compte">
          <div className="space-y-2">
            {others.map((row) => (
              <DocumentLink
                key={row.id}
                url={privateStorageUrl("professional-documents", row.storage_path)}
                label={row.document_label}
                hint={label(DOCUMENT_STATUS, row.status)}
              />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
