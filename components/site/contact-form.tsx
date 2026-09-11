"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRightIcon, CopyIcon, MailIcon } from "lucide-react";

const fieldClass = "mt-2 w-full rounded-xl border border-(--site-line-strong) bg-black px-4 py-3.5 text-base text-white placeholder:text-white/35 transition-colors focus:border-(--site-accent) focus:outline-none focus:ring-1 focus:ring-(--site-accent)";

export function ContactForm() {
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
      setError("Merci de renseigner tous les champs obligatoires.");
      return;
    }

    const body = `${message}\n\n—\nNom : ${name}\nE-mail : ${email}`;
    const href = `mailto:contact@ifriqiyastar.com?subject=${encodeURIComponent(`[Contact Ifriqiya Star] ${subject}`)}&body=${encodeURIComponent(body)}`;
    setError("");
    setCopyStatus("");
    setDraft({ body, href });
    window.location.href = href;
  }

  async function copyMessage() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopyStatus("Message copié. Collez-le dans un e-mail à contact@ifriqiyastar.com.");
    } catch {
      setCopyStatus("La copie automatique est indisponible. Vous pouvez sélectionner votre message dans le formulaire.");
    }
  }

  return (
    <form
      onSubmit={prepareEmail}
      onChange={() => { setDraft(null); setCopyStatus(""); setError(""); }}
      aria-labelledby="contact-form-title"
      className="rounded-3xl border border-(--site-line-strong) bg-(--site-card) p-5 sm:p-8"
    >
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h2 id="contact-form-title" className="font-heading text-2xl font-extrabold">Parlons de votre projet</h2>
          <p className="mt-2 text-xs leading-relaxed text-(--site-muted)">Tous les champs sont obligatoires.</p>
        </div>
        <MailIcon className="mt-1 size-6 shrink-0 text-(--site-accent)" aria-hidden />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label htmlFor="contact-name" className="text-sm font-medium">
          Nom complet
          <input id="contact-name" name="name" autoComplete="name" placeholder="Votre nom" required maxLength={100} className={fieldClass} />
        </label>
        <label htmlFor="contact-email" className="text-sm font-medium">
          Adresse e-mail
          <input id="contact-email" name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" required maxLength={254} className={fieldClass} />
        </label>
        <label htmlFor="contact-subject" className="text-sm font-medium sm:col-span-2">
          Votre demande concerne
          <select id="contact-subject" name="subject" required defaultValue="" className={fieldClass}>
            <option value="" disabled>Choisissez un sujet</option>
            <option>L&apos;académie et la formation</option>
            <option>Les Scout Days et la détection</option>
            <option>Un partenariat</option>
            <option>L&apos;application et mon compte</option>
            <option>Une autre question</option>
          </select>
        </label>
        <label htmlFor="contact-message" className="text-sm font-medium sm:col-span-2">
          Votre message
          <textarea id="contact-message" name="message" placeholder="Présentez-nous votre projet ou posez-nous votre question…" required maxLength={1500} rows={5} className={`${fieldClass} min-h-36 resize-y`} />
          <span className="mt-2 block text-xs font-normal text-(--site-muted)">1 500 caractères maximum.</span>
        </label>
      </div>

      {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}

      <button type="submit" className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-(--site-accent) px-5 py-4 text-sm font-semibold text-black transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-accent)">
        Préparer mon e-mail
        <ArrowUpRightIcon className="size-5" aria-hidden />
      </button>
      <p className="mt-4 text-xs leading-relaxed text-(--site-muted)">
        Votre application de messagerie s&apos;ouvre avec votre message prérempli.
        Vous pourrez le vérifier puis l&apos;envoyer à notre équipe.
      </p>
      <noscript><p className="mt-4 text-sm text-(--site-muted)">Activez JavaScript pour préparer votre e-mail, ou écrivez directement à contact@ifriqiyastar.com.</p></noscript>

      {draft && (
        <div className="mt-5 rounded-xl border border-(--site-accent)/30 bg-(--site-accent)/5 p-4">
          <p role="status" className="text-sm leading-relaxed">Votre message est prêt. Finalisez l&apos;envoi dans votre messagerie.</p>
          <p className="mt-2 text-xs leading-relaxed text-(--site-muted)">Rien ne s&apos;est ouvert ? Copiez votre message et envoyez-le à contact@ifriqiyastar.com.</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-(--site-accent)">
            <a href={draft.href} className="hover:underline">Ouvrir la messagerie</a>
            <button type="button" onClick={copyMessage} className="inline-flex items-center gap-2 hover:underline"><CopyIcon className="size-3.5" aria-hidden />Copier le message</button>
          </div>
          <p role="status" className="mt-2 text-xs leading-relaxed text-(--site-muted)">{copyStatus}</p>
        </div>
      )}
    </form>
  );
}
