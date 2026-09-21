import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";

// Memes extensions que l'editeur (`components/admin/blog/post-editor.tsx`) :
// le document Tiptap stocke en base doit se relire avec le meme jeu de
// noeuds/marques que celui qui l'a produit, sous peine de contenu tronque.
const EXTENSIONS = [StarterKit, TiptapImage, TiptapLink];

/**
 * Rend un article de blog. Premiere utilisation de `dangerouslySetInnerHTML`
 * dans ce depot — jamais fait sur une entree utilisateur non filtree
 * ailleurs, et ce n'est pas le cas ici : `content` vient de `blog_posts`,
 * ecrit uniquement par un administrateur authentifie via l'editeur Tiptap
 * (RLS `blog_posts_admin_all`), pas d'une soumission publique.
 */
export function BlogContent({ content }: { content: object }) {
  const html = generateHTML(content, EXTENSIONS);
  return (
    <div className="site-prose" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
