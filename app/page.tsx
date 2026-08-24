import { redirect } from "next/navigation";

/**
 * Ce depot ne sert pour l'instant que le back-office administrateur (§12) :
 * la racine y renvoie directement. `requireAdmin()` redirige vers /connexion
 * si la session n'est pas celle d'un admin.
 */
export default function Home() {
  redirect("/admin");
}
