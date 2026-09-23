"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import TiptapPlaceholder from "@tiptap/extension-placeholder";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { EditorToolbar } from "@/components/admin/blog/editor-toolbar";
import { ImageUploadButton } from "@/components/admin/blog/image-upload-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveBlogPost } from "@/lib/actions/blog";
import type { ActionResult } from "@/lib/actions/result";
import type { BlogPostStatus } from "@/lib/labels";
import { useAdminTranslations } from "@/lib/i18n/admin-client";
import { publicStorageUrl } from "@/lib/supabase/config";
import { slugify } from "@/lib/slugify";

const EXTENSIONS = [
  StarterKit,
  TiptapImage,
  TiptapLink.configure({ openOnClick: false }),
  // Le texte du repere reste en francais meme si le back-office est en
  // anglais : c'est la langue dans laquelle l'article lui-meme sera ecrit
  // (decision produit — le blog n'est pas encore multilingue).
  TiptapPlaceholder.configure({ placeholder: "Commencez a ecrire votre article…" }),
];
const INITIAL: ActionResult = { ok: true, message: "" };

/**
 * ISO 8601 -> valeur d'un `<input type="datetime-local">` ("AAAA-MM-JJTHH:mm"),
 * dans le fuseau du navigateur. L'aller-retour se fait entierement cote
 * client (voir `scheduledAtIso` plus bas) : le serveur ne connait jamais que
 * le fuseau de l'administrateur qui l'a saisi, jamais le sien.
 */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type EditablePost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  cover_image_path: string | null;
  content: object;
  status: BlogPostStatus;
  author_name: string | null;
  category: string | null;
  scheduled_at: string | null;
};

/**
 * Formulaire de creation/modification, partage par `/admin/blog/nouveau` et
 * `/admin/blog/[id]` — `post` absent = creation. Un seul formulaire, deux
 * destinations : les deux boutons de bas de page portent le meme
 * `name="intent"` et des valeurs differentes, lues par `saveBlogPost()`
 * cote serveur pour decider du statut ecrit, exactement comme
 * `saveScoutDay()` gere creation et modification via la presence de `id`.
 *
 * `defaultAuthorName` (creation uniquement) pre-remplit le champ Auteur avec
 * le nom de l'administrateur connecte — un point de depart, pas une valeur
 * figee : le champ reste modifiable, la personne qui redige n'est pas
 * toujours celle a qui l'article doit etre attribue.
 */
export function PostEditor({
  post,
  defaultAuthorName,
}: {
  post?: EditablePost;
  defaultAuthorName?: string | null;
}) {
  const i18n = useAdminTranslations();
  const router = useRouter();

  const [slug, setSlug] = React.useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(Boolean(post));
  const [coverPath, setCoverPath] = React.useState<string | null>(post?.cover_image_path ?? null);
  // Controle (comme `slug`), pas `defaultValue` : un `defaultValue` sur ce
  // champ se faisait effacer entre le rendu serveur (verifiable, la valeur
  // etait bien dans le HTML initial) et ce que l'administrateur voyait a
  // l'ecran une fois l'hydratation passee.
  // `||`, pas `??` : un article enregistre avant le repli cote serveur peut
  // avoir `author_name = ""` en base (chaine vide, pas `null`), auquel cas
  // `??` ne serait jamais declenche et le champ resterait visible-vide.
  const [authorName, setAuthorName] = React.useState(post?.author_name || defaultAuthorName || "");
  const [contentJson, setContentJson] = React.useState(() => JSON.stringify(post?.content ?? {}));
  const [scheduledAtLocal, setScheduledAtLocal] = React.useState(() => toDatetimeLocalValue(post?.scheduled_at ?? null));
  const nowLocal = React.useMemo(() => toDatetimeLocalValue(new Date().toISOString()), []);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: post?.content ?? "",
    // Requis cote Next.js : sans cette option, le premier rendu client de
    // Tiptap peut differer du HTML rendu au serveur et declencher un
    // avertissement d'hydratation.
    immediatelyRender: false,
    // `contentJson` demarre a `post?.content ?? {}` (etat initial paresseux,
    // avant que Tiptap n'existe) : un `{}` n'est pas un document ProseMirror
    // valide. `onCreate` le resynchronise sur le document reellement cree par
    // Tiptap (deja normalise, y compris pour un article vide) des que
    // l'editeur existe — sans attendre une premiere frappe qui n'arrivera
    // peut-etre jamais si l'administrateur publie sans rien ecrire.
    onCreate: ({ editor }) => setContentJson(JSON.stringify(editor.getJSON())),
    onUpdate: ({ editor }) => setContentJson(JSON.stringify(editor.getJSON())),
  });

  // Capture au moment de la soumission, pas via un `onClick` sur chaque
  // bouton : ainsi valider avec Entree (qui declenche le bouton "Publier",
  // premier du formulaire) est suivi tout aussi correctement.
  const lastIntentRef = React.useRef<string | null>(null);
  const [state, formAction, pending] = useActionState(
    async (_previous: ActionResult, formData: FormData) => {
      lastIntentRef.current = String(formData.get("intent") ?? "");
      return saveBlogPost(formData);
    },
    INITIAL,
  );

  React.useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      // Une creation reussie n'a pas encore d'URL d'edition a offrir : la
      // Server Action ne renvoie pas l'id cree, `ActionResult` restant
      // volontairement le meme type partout dans le back-office — d'ou la
      // redirection systematique. Une modification publiee redirige aussi,
      // a la demande du client ; un brouillon enregistre reste sur place,
      // pour continuer a le modifier.
      if (!post || lastIntentRef.current === "publie") {
        router.push(i18n.path("/admin/blog"));
      }
    } else {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const coverUrl = publicStorageUrl("blog-media", coverPath);

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      <input type="hidden" name="content" value={contentJson} />
      <input type="hidden" name="cover_image_path" value={coverPath ?? ""} />
      <input type="hidden" name="slug" value={slug} />
      {/* Converti en ISO ici, cote navigateur : voir `toDatetimeLocalValue()`. */}
      <input
        type="hidden"
        name="scheduled_at"
        value={scheduledAtLocal && !Number.isNaN(new Date(scheduledAtLocal).getTime()) ? new Date(scheduledAtLocal).toISOString() : ""}
      />

      <div className="min-w-0 space-y-5">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <label htmlFor="blog-title" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {i18n.t("Titre")}
          </label>
          <Input
            id="blog-title"
            name="title"
            defaultValue={post?.title}
            onChange={(event) => {
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            placeholder={i18n.t("Titre de l'article")}
            className="text-base font-semibold sm:text-lg"
            required
          />

          <label htmlFor="blog-slug" className="mt-4 mb-1.5 block text-xs font-medium text-muted-foreground">
            {i18n.t("Adresse (slug)")}
          </label>
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs text-muted-foreground">/blog/</span>
            <Input
              id="blog-slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <EditorToolbar editor={editor} />
          <EditorContent
            editor={editor}
            className="admin-editor-prose min-h-[420px] px-4 py-4 focus:outline-none sm:px-5"
          />
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{i18n.t("Image de couverture")}</p>
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- previsualisation d'une image fraichement deposee, pas un asset optimisable par next/image
            <img src={coverUrl} alt="" className="mb-3 aspect-video w-full rounded-lg object-cover" />
          ) : null}
          <ImageUploadButton
            label={coverUrl ? i18n.t("Changer l'image") : i18n.t("Choisir une image")}
            onUploaded={(_url, path) => setCoverPath(path)}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <label htmlFor="blog-author" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {i18n.t("Auteur")}
          </label>
          <Input
            id="blog-author"
            name="author_name"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder={i18n.t("Nom affiche sur l'article")}
          />

          <label htmlFor="blog-category" className="mt-4 mb-1.5 block text-xs font-medium text-muted-foreground">
            {i18n.t("Categorie")}
          </label>
          <Input
            id="blog-category"
            name="category"
            defaultValue={post?.category ?? ""}
            placeholder={i18n.t("Ex : Actualites, Coulisses, Transferts…")}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {i18n.t("Texte libre, affiche comme filtre sur la page publique du blog. Laisse vide, l'article n'apparait dans aucun filtre de categorie.")}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <label htmlFor="blog-excerpt" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {i18n.t("Resume")}
          </label>
          <textarea
            id="blog-excerpt"
            name="excerpt"
            defaultValue={post?.excerpt ?? ""}
            rows={4}
            placeholder={i18n.t("Court resume affiche dans la liste des articles.")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <p className="mb-3 text-xs font-medium text-muted-foreground">{i18n.t("Referencement (SEO)")}</p>

          <label htmlFor="blog-meta-title" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {i18n.t("Titre meta")}
          </label>
          <Input
            id="blog-meta-title"
            name="meta_title"
            defaultValue={post?.meta_title ?? ""}
            placeholder={i18n.t("Repli : le titre de l'article")}
          />

          <label htmlFor="blog-meta-description" className="mt-4 mb-1.5 block text-xs font-medium text-muted-foreground">
            {i18n.t("Description meta")}
          </label>
          <textarea
            id="blog-meta-description"
            name="meta_description"
            defaultValue={post?.meta_description ?? ""}
            rows={3}
            placeholder={i18n.t("Repli : le resume ci-dessus")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {i18n.t("Utilises par les moteurs de recherche et les apercus partages. Laisses vides, le titre et le resume de l'article ci-dessus s'appliquent.")}
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:p-5">
          <label htmlFor="blog-scheduled-at" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {i18n.t("Publication programmee")}
          </label>
          <Input
            id="blog-scheduled-at"
            type="datetime-local"
            min={nowLocal}
            value={scheduledAtLocal}
            onChange={(event) => setScheduledAtLocal(event.target.value)}
            className="mb-1"
          />
          <p className="mb-3 text-xs text-muted-foreground">
            {i18n.t("Laissez vide pour publier immediatement. Une date future rend l'article visible sur le site tout seul a l'heure choisie — inutile de revenir cliquer Publier ce jour-la.")}
          </p>

          <Button type="submit" name="intent" value="publie" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {scheduledAtLocal && scheduledAtLocal > nowLocal ? i18n.t("Programmer la publication") : i18n.t("Publier")}
          </Button>
          <Button type="submit" name="intent" value="brouillon" variant="outline" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {i18n.t("Enregistrer le brouillon")}
          </Button>
        </div>
      </div>
    </form>
  );
}
