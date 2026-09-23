"use server";

import { Resend } from "resend";

export type ContactResult = { ok: boolean; reason?: "missing" | "unconfigured" | "send_failed" };

const FROM_ADDRESS = "contact@ifriqiya-soccer.com";

/**
 * `ifriqiya-soccer.com` est verifie sur Resend pour l'**envoi** (SPF/DKIM),
 * mais n'a pas d'enregistrement MX : personne ne peut recevoir de courrier a
 * `contact@ifriqiya-soccer.com` tant que le client n'y a pas branche une
 * messagerie. En attendant, la destination reelle est la boite Gmail deja
 * utilisee pour l'app mobile (confirmee vivante : les e-mails de
 * reinitialisation de mot de passe y arrivent). A remplacer par
 * `contact@ifriqiya-soccer.com` des que sa messagerie sera configuree.
 */
const DELIVERY_ADDRESS = "ifriqiya.star@gmail.com";

/**
 * Envoie reellement l'e-mail du formulaire de contact public, via Resend
 * (`RESEND_API_KEY`). Pas de garde d'authentification ici — contrairement aux
 * Server Actions du back-office (`lib/actions/*.ts`), celle-ci est appelee
 * depuis une page publique sans session.
 *
 * Le domaine d'envoi (`ifriqiya-soccer.com`) doit rester verifie dans le
 * tableau de bord Resend (enregistrements SPF/DKIM) : sans cela Resend refuse
 * l'envoi. Tant que `RESEND_API_KEY` est absente ou que l'envoi echoue, le
 * formulaire (`components/site/contact-form.tsx`) affiche une erreur au
 * visiteur plutot que de pretendre que le message est parti.
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
    from: `Ifriqiya Soccer Star <${FROM_ADDRESS}>`,
    to: DELIVERY_ADDRESS,
    replyTo: email,
    subject: `[Contact Ifriqiya Soccer Star] ${subject}`,
    text: `${message}\n\n—\nNom : ${name}\nE-mail : ${email}`,
  });

  if (error) {
    return { ok: false, reason: "send_failed" };
  }

  return { ok: true };
}
