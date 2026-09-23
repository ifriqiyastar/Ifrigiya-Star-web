"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRightIcon } from "lucide-react";

import { useI18n } from "@/lib/i18n/client";
import { sendContactEmail } from "@/lib/actions/contact";

const fieldClass = "mt-2 w-full rounded-xl border border-(--site-line-strong) bg-black px-4 py-3.5 text-base text-white placeholder:text-white/35 transition-colors focus:border-(--site-accent) focus:outline-none focus:ring-1 focus:ring-(--site-accent)";

export function ContactForm() {
  const { dict } = useI18n();
  const t = dict.contactPage;
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const subject = String(data.get("subject") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    if (!name || !email || !subject || !message) {
      setError(t.missing);
      return;
    }

    setError("");
    setSent(false);
    setPending(true);
    const result = await sendContactEmail(data);
    setPending(false);

    if (result.ok) {
      setSent(true);
      form.reset();
      return;
    }

    // Envoi direct uniquement : aucune redirection vers une application de
    // messagerie. Un echec cote serveur (cle Resend absente, domaine pas
    // encore verifie, panne du service...) affiche une erreur au visiteur,
    // qui peut reessayer ou ecrire directement a l'adresse affichee plus haut
    // sur la page.
    setError(t.sendError);
  }

  return (
    <form
      onSubmit={submitEmail}
      onChange={() => { setError(""); setSent(false); }}
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

      <button
        type="submit"
        disabled={pending}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-(--site-accent) px-5 py-4 text-sm font-semibold text-black transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent) disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? t.sending : t.submit}
        {!pending && <ArrowUpRightIcon className="size-5 rtl:-scale-x-100" aria-hidden />}
      </button>
      <noscript><p className="mt-4 text-sm text-(--site-muted)">{t.noscript}</p></noscript>

      {sent && (
        <p role="status" className="mt-5 rounded-xl border border-(--site-accent)/30 bg-(--site-accent)/5 p-4 text-sm leading-relaxed">
          {t.sent}
        </p>
      )}
    </form>
  );
}
