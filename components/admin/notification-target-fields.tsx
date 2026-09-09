"use client";

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

const TARGET_META = {
  all: {
    icon: Globe2Icon,
    title: "Toute la plateforme",
    description: "Tous les comptes actifs recevront cette campagne.",
  },
  role: {
    icon: UsersIcon,
    title: "Segment par rôle",
    description: "La campagne sera limitée aux joueurs ou aux professionnels.",
  },
  user: {
    icon: UserRoundIcon,
    title: "Envoi individuel",
    description: "Un seul compte recevra cette notification.",
  },
  scout_day: {
    icon: CalendarDaysIcon,
    title: "Participants Scout Day",
    description: "L’audience sera construite depuis les inscriptions de la session.",
  },
} satisfies Record<
  TargetType,
  {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }
>;

export function NotificationTargetFields({
  users,
  scoutDays,
}: {
  users: { id: string; label: string }[];
  scoutDays: { id: string; label: string }[];
}) {
  const [type, setType] = React.useState<TargetType>("all");
  const meta = TARGET_META[type];
  const MetaIcon = meta.icon;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="target_type" className="text-foreground">
          Type d’audience
        </Label>
        <NativeSelect
          id="target_type"
          name="target_type"
          value={type}
          onChange={(event) => setType(event.target.value as TargetType)}
          className="h-11 rounded-md border-border bg-[#101318] text-xs"
        >
          <option value="all">Tous les utilisateurs</option>
          <option value="role">Un type de compte</option>
          <option value="user">Un utilisateur précis</option>
          <option value="scout_day">Participants d’un Scout Day</option>
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <Label htmlFor="target_value" className="text-foreground">
          Cible sélectionnée
        </Label>
        {type === "all" ? (
          <>
            <input type="hidden" name="target_value" value="" />
            <div className="flex h-11 items-center rounded-md border border-border bg-[#101318] px-3.5 text-xs text-muted-foreground">
              Tous les comptes actifs
            </div>
          </>
        ) : type === "role" ? (
          <NativeSelect
            id="target_value"
            name="target_value"
            required
            className="h-11 rounded-md border-border bg-[#101318] text-xs"
          >
            <option value="">Sélectionner un rôle</option>
            <option value="player">Joueurs</option>
            <option value="professional">Professionnels</option>
          </NativeSelect>
        ) : type === "user" ? (
          <NativeSelect
            id="target_value"
            name="target_value"
            required
            className="h-11 rounded-md border-border bg-[#101318] text-xs"
          >
            <option value="">Sélectionner un utilisateur</option>
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
            <option value="">Sélectionner un Scout Day</option>
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
              Cible résolue à l’envoi
            </span>
          </div>
          <p className="mt-1 text-[0.625rem] leading-relaxed text-muted-foreground">
            {meta.description}
          </p>
        </div>
      </div>
    </>
  );
}
