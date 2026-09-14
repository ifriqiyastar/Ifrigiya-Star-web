"use client";

import { useAdminTranslations } from "@/lib/i18n/admin-client";
import type { AdminTranslations } from "@/lib/i18n/admin-shared";


import * as React from "react";
import {
  CalendarDaysIcon,
  Globe2Icon,
  TargetIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";

import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type TargetType = "all" | "role" | "user" | "scout_day";

function getTARGETMETA(i18n: AdminTranslations) {
  return {
  all: {
    icon: Globe2Icon,
    title: i18n.t("Toute la plateforme"),
    description: i18n.t("Tous les comptes actifs recevront cette campagne."),
  },
  role: {
    icon: UsersIcon,
    title: i18n.t("Segment par rôle"),
    description: i18n.t("La campagne sera limitée aux joueurs ou aux professionnels."),
  },
  user: {
    icon: UserRoundIcon,
    title: i18n.t("Envoi individuel"),
    description: i18n.t("Un seul compte recevra cette notification."),
  },
  scout_day: {
    icon: CalendarDaysIcon,
    title: i18n.t("Participants Scout Day"),
    description: i18n.t("L’audience sera construite depuis les inscriptions de la session."),
  },
} satisfies Record<
  TargetType,
  {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }
>;
}

export function NotificationTargetFields({
  users,
  scoutDays,
}: {
  users: { id: string; label: string }[];
  scoutDays: { id: string; label: string }[];
}) {
  const i18n = useAdminTranslations();

  const [type, setType] = React.useState<TargetType>("all");
  const meta = getTARGETMETA(i18n)[type];
  const MetaIcon = meta.icon;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="target_type" className="text-foreground">
          {i18n.t("Type d’audience")}</Label>
        <NativeSelect
          id="target_type"
          name="target_type"
          value={type}
          onChange={(event) => setType(event.target.value as TargetType)}
          className="h-11 rounded-md border-border bg-[#101318] text-xs"
        >
          <option value="all">{i18n.t("Tous les utilisateurs")}</option>
          <option value="role">{i18n.t("Un type de compte")}</option>
          <option value="user">{i18n.t("Un utilisateur précis")}</option>
          <option value="scout_day">{i18n.t("Participants d’un Scout Day")}</option>
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <Label htmlFor="target_value" className="text-foreground">
          {i18n.t("Cible sélectionnée")}</Label>
        {type === "all" ? (
          <>
            <input type="hidden" name="target_value" value="" />
            <div className="flex h-11 items-center rounded-md border border-border bg-[#101318] px-3.5 text-xs text-muted-foreground">
              {i18n.t("Tous les comptes actifs")}</div>
          </>
        ) : type === "role" ? (
          <NativeSelect
            id="target_value"
            name="target_value"
            required
            className="h-11 rounded-md border-border bg-[#101318] text-xs"
          >
            <option value="">{i18n.t("Sélectionner un rôle")}</option>
            <option value="player">{i18n.t("Joueurs")}</option>
            <option value="professional">{i18n.t("Professionnels")}</option>
          </NativeSelect>
        ) : type === "user" ? (
          <NativeSelect
            id="target_value"
            name="target_value"
            required
            className="h-11 rounded-md border-border bg-[#101318] text-xs"
          >
            <option value="">{i18n.t("Sélectionner un utilisateur")}</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <NativeSelect
            id="target_value"
            name="target_value"
            required
            className="h-11 rounded-md border-border bg-[#101318] text-xs"
          >
            <option value="">{i18n.t("Sélectionner un Scout Day")}</option>
            {scoutDays.map((event) => (
              <option key={event.id} value={event.id}>
                {event.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>

      <div
        className="flex items-start gap-3 rounded-md border border-border bg-secondary/40 p-3 md:col-span-2"
        aria-live="polite"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand/12 text-brand">
          <MetaIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">{meta.title}</p>
            <span className="micro-label flex items-center gap-1.5 text-brand">
              <TargetIcon className="size-3" />
              {i18n.t("Cible résolue à l’envoi")}</span>
          </div>
          <p className="mt-1 text-[0.625rem] leading-relaxed text-muted-foreground">
            {meta.description}
          </p>
        </div>
      </div>
    </>
  );
}
