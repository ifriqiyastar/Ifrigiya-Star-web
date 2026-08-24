"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseEnv } from "./config";

/** Client Supabase cote navigateur (formulaire de connexion, deconnexion). */
export function createClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient(url, key);
}
