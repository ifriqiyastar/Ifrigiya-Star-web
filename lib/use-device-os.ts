"use client";

import { useSyncExternalStore } from "react";

/**
 * Detection du systeme d'exploitation du visiteur, partagee entre
 * `StoreButtons` (quel badge de store afficher) et le declencheur de QR code
 * de l'en-tete (quand proposer un QR plutot qu'un lien direct). Extrait de
 * `components/site/store-buttons.tsx` pour que les deux emplacements restent
 * d'accord sur ce qu'est "un telephone" — deux heuristiques separees auraient
 * pu diverger.
 */
export type DeviceOs = "inconnu" | "ios" | "android";

function detecterOs(): DeviceOs {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipod|ipad/i.test(ua)) return "ios";
  // Depuis iPadOS 13 un iPad se declare « Macintosh » et rien dans la chaine
  // ne le distingue d'un Mac : seul le nombre de points de contact le fait.
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  return "inconnu";
}

/** L'UA ne bouge pas : il n'y a rien a observer, donc rien a desabonner. */
const sAbonner = () => () => {};
const snapshotServeur = (): DeviceOs => "inconnu";

/**
 * `useSyncExternalStore` plutot qu'un `useState` pose dans un effet : le
 * systeme d'exploitation est une donnee exterieure a React, elle ne change
 * jamais pendant la visite (d'ou l'abonnement vide), et c'est l'API qui
 * laisse le rendu serveur repondre autre chose que le client sans que
 * l'hydratation le signale comme une divergence.
 */
export function useDeviceOs(): DeviceOs {
  return useSyncExternalStore(sAbonner, detecterOs, snapshotServeur);
}
