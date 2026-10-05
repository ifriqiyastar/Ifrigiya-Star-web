"use client";

import * as React from "react";

import type { AdminTask } from "@/lib/queries/admin-queue";

/**
 * Ce que l'administrateur a deja vu dans la cloche.
 *
 * La pastille comptait tous les dossiers en attente, en permanence : ouvrir la
 * cloche ne changeait rien, et un chiffre qui ne s'eteint jamais finit par ne
 * plus etre lu. On retient donc, **par file**, le nombre de dossiers presents
 * au moment ou la cloche a ete ouverte ; la pastille ne compte plus que ce qui
 * depasse ce nombre, c'est-a-dire ce qui est arrive depuis.
 *
 * Ce n'est qu'un accuse de lecture de la pastille, pas de la file : la liste
 * deroulee et les pastilles du rail continuent d'afficher tout ce qui attend,
 * puisqu'un dossier vu n'est pas un dossier traite.
 *
 * Quand une file descend (un dossier traite), le seuil descend avec elle —
 * sinon un dossier traite puis un nouveau arrive laisseraient le compte
 * inchange, et le nouveau passerait inapercu.
 *
 * Stockage local au navigateur, cle par compte : c'est une commodite d'affichage
 * par poste, pas un etat qui doit survivre a un changement d'appareil.
 */
type SeenMap = Record<string, number>;

const PREFIX = "admin-queue-seen:";
const listeners = new Set<() => void>();

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "{}";
  } catch {
    return "{}";
  }
}

function write(key: string, value: SeenMap) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage refuse (navigation privee) : la pastille reste allumee, rien de pire.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function parse(raw: string): SeenMap {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? (value as SeenMap) : {};
  } catch {
    return {};
  }
}

function countsOf(tasks: AdminTask[]): SeenMap {
  return Object.fromEntries(tasks.map((task) => [task.key, task.count]));
}

export function useQueueSeen(tasks: AdminTask[], account: string) {
  const key = PREFIX + account;
  // `null` cote serveur : on ignore ce que le poste a deja vu, donc la pastille
  // n'est pas rendue plutot que de s'afficher puis de s'eteindre a l'hydratation.
  const raw = React.useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const seen = React.useMemo(() => (raw === null ? null : parse(raw)), [raw]);

  // Le seuil suit la file vers le bas. Ecrire dans le stockage depuis un effet
  // est sans danger : ce n'est pas un etat React, et l'abonnement relit ensuite.
  React.useEffect(() => {
    if (!seen) return;
    const clamped: SeenMap = {};
    let changed = false;
    for (const [taskKey, count] of Object.entries(seen)) {
      const current = tasks.find((task) => task.key === taskKey)?.count ?? 0;
      if (current > 0) clamped[taskKey] = Math.min(count, current);
      if (current < count) changed = true;
    }
    if (changed) write(key, clamped);
  }, [key, seen, tasks]);

  const unseen =
    seen === null
      ? 0
      : tasks.reduce(
          (total, task) => total + Math.max(0, task.count - Math.min(seen[task.key] ?? 0, task.count)),
          0,
        );

  const markSeen = React.useCallback(() => write(key, countsOf(tasks)), [key, tasks]);

  return { unseen, markSeen };
}
