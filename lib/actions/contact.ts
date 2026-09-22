"use server";

import { Resend } from "resend";

export type ContactResult = { ok: boolean; reason?: "missing" | "unconfigured" | "send_failed" };

const CONTACT_ADDRESS = "contact@ifriqiya-soccer-star.com";

/**
 * Envoie reellement l'e-mail du formulaire de contact public, via Resend
 * (`RESEND_API_KEY`). Pas de garde d'authentification ici — contrairement aux
 * Server Actions du back-office (`lib/actions/*.ts`), celle-ci est appelee
 * depuis une page publique sans session.
 *
 * Le domaine d'envoi (`ifriqiya-soccer-star.com`) doit etre verifie dans le
 * tableau de bord Resend (enregistrements SPF/DKIM) : sans cela Resend refuse
 * l'envoi ou le fait atterrir en spam. Tant que `RESEND_API_KEY` est absente
 * ou que l'envoi echoue, le formulaire (`components/site/contact-form.tsx`)
 * se rabat sur un brouillon `mailto:` plutot que de bloquer le visiteur.
 */
export async function sendContactEmail(formData: FormData): Promise<ContactResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !subject || !message) {
    return { ok: false, reason: "missing" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "unconfigured" };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: `Ifriqiya Soccer Star <${CONTACT_ADDRESS}>`,
    to: CONTACT_ADDRESS,
    replyTo: email,
    subject: `[Contact Ifriqiya Soccer Star] ${subject}`,
    text: `${message}\n\n—\nNom : ${name}\nE-mail : ${email}`,
  });

  if (error) {
    return { ok: false, reason: "send_failed" };
  }

  return { ok: true };
}
