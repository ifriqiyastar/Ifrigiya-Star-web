"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRightIcon, CopyIcon } from "lucide-react";

import { useI18n } from "@/lib/i18n/client";

const fieldClass = "mt-2 w-full rounded-xl border border-(--site-line-strong) bg-black px-4 py-3.5 text-base text-white placeholder:text-white/35 transition-colors focus:border-(--site-accent) focus:outline-none focus:ring-1 focus:ring-(--site-accent)";

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
    const href = `mailto:contact@ifriqiyastar.com?subject=${encodeURIComponent(`[Contact Ifriqiya Soccer Star] ${subject}`)}&body=${encodeURIComponent(body)}`;
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
        <label htmlFor="contact-name" className="text-sm font-medium">
          {t.name}
          <input id="contact-name" name="name" autoComplete="name" placeholder={t.namePlaceholder} required maxLength={100} className={fieldClass} />
        </label>
        <label htmlFor="contact-email" className="text-sm font-medium">
          {t.email}
          <input id="contact-email" name="email" type="email" autoComplete="email" placeholder={t.emailPlaceholder} required maxLength={254} className={fieldClass} />
        </label>
        <label htmlFor="contact-subject" className="text-sm font-medium sm:col-span-2">
          {t.subject}
          <select id="contact-subject" name="subject" required defaultValue="" className={fieldClass}>
            <option value="" disabled>{t.subjectPlaceholder}</option>
            {t.subjects.map((sujet) => (
              <option key={sujet}>{sujet}</option>
            ))}
          </select>
        </label>
        <label htmlFor="contact-message" className="text-sm font-medium sm:col-span-2">
          {t.message}
          <textarea id="contact-message" name="message" placeholder={t.messagePlaceholder} required maxLength={1500} rows={5} className={`${fieldClass} min-h-36 resize-y`} />
          <span className="mt-2 block text-xs font-normal text-(--site-muted)">{t.messageLimit}</span>
        </label>
      </div>

      {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}

      <button type="submit" className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-(--site-accent) px-5 py-4 text-sm font-semibold text-black transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent)">
        {t.submit}
        <ArrowUpRightIcon className="size-5 rtl:-scale-x-100" aria-hidden />
      </button>
      <p className="mt-4 text-xs leading-relaxed text-(--site-muted)">
        {t.submitHint}
      </p>
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
