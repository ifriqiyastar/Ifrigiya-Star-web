"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Pave de saisie du code recu par e-mail — une case par chiffre.
 *
 * Un champ de texte ordinaire aurait suffi a taper six chiffres ; les cases
 * servent au geste reel, qui est de **reporter** un code lu dans un e-mail :
 * elles montrent ou l'on en est et combien il en reste, et rendent le collage
 * evident. C'est le pendant web de `CodeInput` dans l'app mobile.
 *
 * ⚠️ **Il n'y a qu'un seul `<input>`, transparent, etendu sur toute la
 * rangee** — et non un champ par case. Six champs obligeraient a gerer a la
 * main le deplacement du curseur, l'effacement arriere qui remonte d'une case,
 * le collage reparti sur six cibles et l'auto-remplissage du navigateur, qui
 * ne sait viser qu'un champ. Les cases ne sont que du dessin : l'etat vit dans
 * le champ unique, `autoComplete="one-time-code"` compris.
 */
export function OtpInput({
  id,
  value,
  onChange,
  onFilled,
  length,
  label,
  hint,
  error,
  disabled,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Appele des que la derniere case est remplie — la saisie est finie. */
  onFilled?: (value: string) => void;
  length: number;
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = React.useState(false);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");
  // La case « active » est celle que le prochain chiffre remplira ; une fois
  // le code complet, c'est la derniere, sinon le curseur sortirait du pave.
  const active = Math.min(value.length, length - 1);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Le code arrive souvent colle depuis l'e-mail, espaces compris.
    const next = event.target.value.replace(/\D/g, "").slice(0, length);
    onChange(next);
    if (next.length === length) onFilled?.(next);
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={length}
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
          // Le champ porte la saisie mais aucun pixel : le curseur est masque
          // (`text-transparent` ne suffit pas, le caret a sa propre couleur) et
          // c'est la case active qui fait office de repere.
          className="absolute inset-0 z-10 h-full w-full cursor-text rounded-xl bg-transparent text-transparent caret-transparent opacity-0 outline-none"
        />
        <div className="flex gap-2" aria-hidden="true">
          {digits.map((digit, index) => (
            <div
              key={index}
              className={cn(
                "flex h-14 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 font-heading text-2xl font-bold tabular-nums transition-colors",
                error && "border-destructive/50",
                focused && index === active && !disabled && "border-brand/70 ring-2 ring-brand/15",
                disabled && "opacity-60",
              )}
            >
              {digit || <span className="text-white/20">·</span>}
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-white/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
