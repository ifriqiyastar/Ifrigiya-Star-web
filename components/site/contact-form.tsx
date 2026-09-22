"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRightIcon, CopyIcon } from "lucide-react";

import { useI18n } from "@/lib/i18n/client";

const inputClass =
  "peer w-full rounded-xl border border-(--site-line-strong) bg-black px-4 pt-6 pb-2.5 text-base text-white placeholder-transparent transition-colors focus:border-(--site-accent) focus:outline-none focus:ring-1 focus:ring-(--site-accent)";

/**
 * Label flottant : au repos il reprend la place du placeholder (centre,
 * grande taille), et remonte en petit des que le champ est focus ou rempli.
 * Le `placeholder=" "` (espace, jamais vide) est ce qui rend
 * `:placeholder-shown` fiable sur tous les navigateurs.
 */
const labelClass =
  "pointer-events-none absolute start-4 top-3.5 text-xs text-(--site-muted) transition-all duration-150 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-focus:top-3.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-(--site-accent)";

/** Meme chose, mais la position "au repos" est plus haute : un textarea est grand, le centrer verticalement ferait flotter le label au milieu du cadre. */
const textareaLabelClass =
  "pointer-events-none absolute start-4 top-3.5 text-xs text-(--site-muted) transition-all duration-150 peer-placeholder-shown:top-6 peer-placeholder-shown:text-base peer-focus:top-3.5 peer-focus:text-xs peer-focus:text-(--site-accent)";

/** Un <select> n'a pas de pseudo-classe :placeholder-shown : son label reste flottant en permanence, l'option grisee jouant deja ce role. */
const selectLabelClass =
  "pointer-events-none absolute start-4 top-3.5 text-xs text-(--site-muted) transition-colors peer-focus:text-(--site-accent)";

export function ContactForm() {
  const { dict } = useI18n();
  const t = dict.contactPage;
  const [draft, setDraft] = useState<{ body: string; href: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [error, setError] = useState("");

  function prepareEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const subject = String(data.get("subject") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    if (!name || !email || !subject || !message) {
      setError(t.missing);
      return;
    }

    const body = `${message}\n\n—\nNom : ${name}\nE-mail : ${email}`;
    const href = `mailto:contact@ifriqiya-soccer-star.com?subject=${encodeURIComponent(`[Contact Ifriqiya Soccer Star] ${subject}`)}&body=${encodeURIComponent(body)}`;
    setError("");
    setCopyStatus("");
    setDraft({ body, href });
    window.location.href = href;
  }

  async function copyMessage() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopyStatus(t.copied);
    } catch {
      setCopyStatus(t.copyFailed);
    }
  }

  return (
    <form
      onSubmit={prepareEmail}
      onChange={() => { setDraft(null); setCopyStatus(""); setError(""); }}
      aria-labelledby="contact-form-title"
      className="rounded-3xl border border-(--site-line-strong) bg-(--site-card) p-5 sm:p-8"
    >
      <div className="mb-7">
        <h2 id="contact-form-title" className="font-heading text-2xl font-extrabold">{t.formTitle}</h2>
        <p className="mt-2 text-xs leading-relaxed text-(--site-muted)">{t.formRequired}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="relative">
          <input id="contact-name" name="name" autoComplete="name" placeholder=" " required maxLength={100} className={inputClass} />
          <label htmlFor="contact-name" className={labelClass}>{t.name}</label>
        </div>
        <div className="relative">
          <input id="contact-email" name="email" type="email" autoComplete="email" placeholder=" " required maxLength={254} className={inputClass} />
          <label htmlFor="contact-email" className={labelClass}>{t.email}</label>
        </div>
        <div className="relative sm:col-span-2">
          <select id="contact-subject" name="subject" required defaultValue="" className={inputClass}>
            <option value="" disabled>{t.subjectPlaceholder}</option>
            {t.subjects.map((sujet) => (
              <option key={sujet}>{sujet}</option>
            ))}
          </select>
          <label htmlFor="contact-subject" className={selectLabelClass}>{t.subject}</label>
        </div>
        <div className="relative sm:col-span-2">
          <textarea id="contact-message" name="message" placeholder=" " required maxLength={1500} rows={5} className={`${inputClass} min-h-36 resize-y`} />
          <label htmlFor="contact-message" className={textareaLabelClass}>{t.message}</label>
          <span className="mt-2 block text-xs font-normal text-(--site-muted)">{t.messageLimit}</span>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}

      <button type="submit" className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-(--site-accent) px-5 py-4 text-sm font-semibold text-black transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent)">
        {t.submit}
        <ArrowUpRightIcon className="size-5 rtl:-scale-x-100" aria-hidden />
      </button>
      <noscript><p className="mt-4 text-sm text-(--site-muted)">{t.noscript}</p></noscript>

      {draft && (
        <div className="mt-5 rounded-xl border border-(--site-accent)/30 bg-(--site-accent)/5 p-4">
          <p role="status" className="text-sm leading-relaxed">{t.ready}</p>
          <p className="mt-2 text-xs leading-relaxed text-(--site-muted)">{t.readyFallback}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-(--site-accent)">
            <a href={draft.href} className="hover:underline">{t.openMail}</a>
            <button type="button" onClick={copyMessage} className="inline-flex items-center gap-2 hover:underline"><CopyIcon className="size-3.5" aria-hidden />{t.copy}</button>
          </div>
          <p role="status" className="mt-2 text-xs leading-relaxed text-(--site-muted)">{copyStatus}</p>
        </div>
      )}
    </form>
  );
}
