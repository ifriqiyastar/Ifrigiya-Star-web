import type { Metadata } from "next";
import { LanguagesIcon } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { Panel, PanelHeader } from "@/components/admin/panel";
import { NoteCards } from "@/components/admin/note-cards";
import { LanguageChoice } from "@/components/admin/language-choice";
import { requireAdmin } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.settings.title };
}

/**
 * Les parametres personnels de la session d'administration.
 *
 * Une seule section pour l'instant, et c'est volontaire : la langue est le
 * seul reglage que le produit sait reellement stocker et appliquer. Le reste
 * des preferences qu'un ecran de parametres appelle d'habitude — theme,
 * densite, notifications par courriel — n'a aujourd'hui ni colonne ni
 * prestataire derriere lui, et les afficher desactivees ferait exactement ce
 * que le reste du back-office s'interdit : promettre une fonction qui
 * n'existe pas.
 *
 * `requireAdmin()` est appele ici comme sur toute page d'administration : la
 * mise en page le fait deja, mais chaque page reste lisible seule.
 */
export default async function ParametresPage() {
  await requireAdmin();
  const dict = await getDictionary();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={[{ label: dict.settings.breadcrumb }, { label: dict.settings.title }]}
        title={dict.settings.title}
        description={dict.settings.description}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <PanelHeader
            title={dict.settings.languagePanel}
            description={dict.settings.languagePanelDesc}
          />
          <div className="p-5">
            <LanguageChoice />
          </div>
        </Panel>
      </div>

      <NoteCards
        notes={[{ icon: LanguagesIcon, title: dict.language.label, body: dict.settings.scopeNote }]}
      />
    </div>
  );
}
