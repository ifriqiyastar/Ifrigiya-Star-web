import Link from "next/link";
import {
  CalendarIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";

import { DefinitionList, type DefinitionItem } from "@/components/admin/definition-list";
import { ProfilePreviewDialog } from "@/components/admin/profile-preview-dialog";
import { StatusPill } from "@/components/admin/status-pill";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { countryFlag } from "@/lib/countries-api";
import { initials } from "@/lib/format";
import { fill, getAdminDict, getAdminI18n } from "@/lib/i18n/admin";
import { ROLE } from "@/lib/labels";
import type { ProfileSummary } from "@/lib/queries/profiles";
import { cn } from "@/lib/utils";

/** Identite compacte pour les cellules de tableau : avatar + nom + sous-ligne. */
export async function UserCell({
  name,
  secondary,
  avatarUrl,
  href,
  className,
  preview,
}: {
  name: string | null | undefined;
  secondary?: string | null;
  avatarUrl?: string | null;
  href?: string;
  className?: string;
  /**
   * Le compte lui-meme : present, un second declencheur apparait a cote du nom
   * et ouvre son apercu.
   *
   * ⚠️ **Opt-in, et pas par defaut.** Il n'a de sens que la ou le compte est le
   * CONTEXTE d'une ligne qu'on traite sans quitter la liste. Les quatre files
   * de validation ne le prennent pas : leur bouton « Dossier » montre deja
   * cette identite, et en poser un second a cote serait la meme donnee a deux
   * endroits — la duplication que ce depot paie cher ailleurs. L'annuaire des
   * comptes non plus : y ouvrir la fiche est le travail de l'ecran.
   *
   * ⚠️ **Ne coute aucun aller-retour** : l'apercu n'affiche que les champs de
   * `ProfileSummary`, que l'appelant charge deja pour rendre ce nom et cette
   * vignette. Lui donner un champ de plus voudrait dire une lecture de plus sur
   * chaque ligne de chaque liste — voir `ProfilePreviewDialog`.
   */
  preview?: ProfileSummary;
}) {
  const dict = await getAdminDict();
  const displayName = name?.trim() || dict.common.noName;
  const body = (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9 shrink-0 rounded-full">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="rounded-full bg-accent text-[0.625rem] font-semibold tracking-wider">
          {initials(displayName)}
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
        {secondary ? (
          <span className="truncate text-xs text-muted-foreground">{secondary}</span>
        ) : null}
      </span>
    </span>
  );

  const linkClassName =
    "flex rounded-md outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/40";

  if (!preview) {
    if (!href) return <span className={cn("flex", className)}>{body}</span>;

    return (
      <Link href={href} className={cn(linkClassName, className)}>
        {body}
      </Link>
    );
  }

  // ⚠️ LE DECLENCHEUR EST UN FRERE DU LIEN, jamais un enfant : un bouton dans
  // un lien n'est pas du HTML valide, et le clic naviguerait au lieu d'ouvrir.
  return (
    <span className={cn("flex min-w-0 items-center gap-1", className)}>
      {href ? (
        <Link href={href} className={cn(linkClassName, "min-w-0")}>
          {body}
        </Link>
      ) : (
        body
      )}
      <ProfilePreviewDialog
        label={fill(dict.common.previewOf, { name: displayName })}
        title={displayName}
        description={dict.common.previewHint}
      >
        <ProfileFacts profile={preview} name={displayName} href={href} />
      </ProfilePreviewDialog>
    </span>
  );
}

/**
 * Ce que l'apercu montre — et rien de plus.
 *
 * ⚠️ CETTE LISTE EST EXACTEMENT `ProfileSummary`, et c'est la contrainte, pas
 * un hasard : ce sont les champs deja charges par `fetchProfilesByIds()` pour
 * chaque ligne de chaque liste. Ajouter « le profil joueur est-il valide ? »
 * ou « combien a-t-il paye ? » demanderait une lecture de plus par liste, payee
 * sur tous les ecrans pour une modale rarement ouverte. Ces questions-la ont
 * leur ecran : le dernier bouton y mene.
 */
async function ProfileFacts({
  profile,
  name,
  href,
}: {
  profile: ProfileSummary;
  name: string;
  href?: string;
}) {
  const i18n = await getAdminI18n();
  const dict = await getAdminDict();
  const role = i18n.labels.entry(ROLE, profile.role);

  const flag = countryFlag(profile.country);

  const items: DefinitionItem[] = [
    {
      icon: MailIcon,
      label: dict.common.email,
      // ⚠️ SUR UNE SEULE LIGNE, EN ENTIER (retour client). Une adresse
      // `cacopom856@deertees.com` tenait sur une demi-largeur en se coupant en
      // deux, et une adresse se lit d'un bloc — c'est une chaine a recopier,
      // pas une phrase. La ligne prend donc les deux colonnes, le texte ne se
      // replie plus, et une adresse vraiment longue **defile dans sa propre
      // boite** plutot que d'elargir la modale (regle du depot pour tout
      // contenu large).
      className: "sm:col-span-2",
      value: profile.email ? (
        <span className="block max-w-full overflow-x-auto whitespace-nowrap">{profile.email}</span>
      ) : (
        "—"
      ),
    },
    { icon: PhoneIcon, label: dict.common.phone, value: profile.phone || "—" },
    {
      icon: MapPinIcon,
      label: dict.common.country,
      // Le drapeau precede le nom, et n'apparait que si le pays a ete reconnu :
      // un embleme faux vaut moins que pas d'embleme du tout.
      value: profile.country?.trim() ? (
        <span className="flex items-center gap-1.5">
          {flag ? (
            <span aria-hidden className="text-base leading-none">
              {flag}
            </span>
          ) : null}
          <span>{profile.country}</span>
        </span>
      ) : (
        "—"
      ),
    },
    {
      icon: CalendarIcon,
      label: dict.common.registeredOn,
      value: i18n.format.formatDate(profile.created_at),
    },
  ];

  // Une demande de suppression n'est pas un etat courant : elle n'apparait que
  // lorsqu'elle existe, plutot qu'en ligne vide sur chaque apercu.
  if (profile.deletion_requested_at) {
    items.push({
      icon: Trash2Icon,
      label: dict.common.deletionRequestedOn,
      value: i18n.format.formatDateTime(profile.deletion_requested_at),
    });
  }

  return (
    <>
      {/* ⚠️ LA PHOTO, EN GRAND (retour client). La modale n'en portait pas : on
          y lisait l'identite d'un compte sans voir le visage que l'application
          mobile montre, alors que la vignette de la ligne l'avait deja — meme
          URL, deja signee par `fetchProfilesByIds()`, donc aucune lecture ni
          aucune signature de plus. */}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16 shrink-0 rounded-full ring-1 ring-border">
          {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback className="rounded-full bg-accent text-sm font-semibold tracking-wider">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <StatusPill tone={role.tone}>{role.label}</StatusPill>
          <StatusPill tone={profile.is_active ? "success" : "danger"} dot>
            {profile.is_active ? dict.common.active : dict.common.deactivated}
          </StatusPill>
          {profile.is_minor ? (
            <StatusPill tone="warning">{dict.common.minor}</StatusPill>
          ) : null}
          {profile.deletion_requested_at ? (
            <StatusPill tone="danger">{dict.common.deletionRequested}</StatusPill>
          ) : null}
        </div>
      </div>

      <DefinitionList items={items} />

      {href ? (
        <div className="border-t border-border/70 pt-4">
          <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>
            <UserRoundIcon />
            {fill(dict.common.openAccountOf, { name })}
          </Link>
        </div>
      ) : null}
    </>
  );
}
