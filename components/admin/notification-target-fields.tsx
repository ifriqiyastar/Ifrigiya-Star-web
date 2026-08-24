"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export function NotificationTargetFields({
  users,
  scoutDays,
}: {
  users: { id: string; label: string }[];
  scoutDays: { id: string; label: string }[];
}) {
  const [type, setType] = React.useState("all");

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="target_type">Destinataires</Label>
        <NativeSelect id="target_type" name="target_type" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">Tous les utilisateurs</option>
          <option value="role">Un type de compte</option>
          <option value="user">Un utilisateur</option>
          <option value="scout_day">Participants d&apos;un Scout Day</option>
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="target_value">Cible</Label>
        {type === "all" ? (
          <><input type="hidden" name="target_value" value="" /><p className="flex h-10 items-center text-sm text-muted-foreground">Toute la plateforme</p></>
        ) : type === "role" ? (
          <NativeSelect id="target_value" name="target_value" required><option value="">Selectionner</option><option value="player">Joueurs</option><option value="professional">Professionnels</option></NativeSelect>
        ) : type === "user" ? (
          <NativeSelect id="target_value" name="target_value" required><option value="">Selectionner un utilisateur</option>{users.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}</NativeSelect>
        ) : (
          <NativeSelect id="target_value" name="target_value" required><option value="">Selectionner un Scout Day</option>{scoutDays.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}</NativeSelect>
        )}
      </div>
    </>
  );
}
