import type { SVGProps } from "react";

/** Pictogrammes des trois piliers (detection, progression, excellence), pour
 * la version telephone du bandeau ou ils remplacent l'ancienne liste nue. */

export function IconDetection(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconProgression(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 17 L9 11 L13 15 L21 6" />
      <path d="M15 6 H21 V12" />
    </svg>
  );
}

export function IconExcellence(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="14.5" r="5.2" />
      <path d="M9.3 9.8 L6.8 3 M14.7 9.8 L17.2 3" />
      <path d="M9.8 14.5 L11.2 15.9 L14.7 12.4" />
    </svg>
  );
}
