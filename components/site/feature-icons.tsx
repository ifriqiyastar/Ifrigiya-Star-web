import type { SVGProps } from "react";

/** Pictogrammes des trois legendes sous la grappe de telephones. */

export function IconFeed(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="5" width="16" height="3.6" rx="1.4" />
      <rect x="4" y="10.2" width="16" height="3.6" rx="1.4" />
      <rect x="4" y="15.4" width="10" height="3.6" rx="1.4" />
    </svg>
  );
}

export function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
      <path d="M3.5 9.8 H20.5" />
      <path d="M8 3 V6.5 M16 3 V6.5" />
    </svg>
  );
}

export function IconMessage(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="5.5" width="17" height="11.5" rx="2.4" />
      <path d="M4 8 L12 13.2 L20 8" />
    </svg>
  );
}
