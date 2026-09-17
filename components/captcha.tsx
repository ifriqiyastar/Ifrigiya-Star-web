"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

/**
 * Protection anti-robot de l'ecran de connexion — **Cloudflare Turnstile**, le
 * fournisseur que Supabase verifie cote serveur.
 *
 * ⚠️ **Ce n'est pas un controle cote client, et il ne faut pas le lire comme
 * tel.** Le jeton produit ici ne prouve rien par lui-meme : c'est GoTrue qui
 * l'echange contre la cle **secrete** (Authentication -> Attack Protection) et
 * refuse la requete si l'echange echoue. Retirer ce composant ne « debloque »
 * donc rien — cela rend simplement toute connexion impossible, avec
 * « captcha protection: request disallowed (no captcha_token found) ».
 *
 * ⚠️ **La protection est un reglage de projet, pas d'application.** Elle a ete
 * activee le 2026-09-17 pour l'app mobile (`~/ifriqiyastar/src/components/
 * captcha.tsx`) et s'applique du meme coup a *tous* les points d'entree GoTrue
 * du projet partage — ce back-office compris. Les deux depots utilisent donc la
 * meme cle de site ; seuls les noms d'hotes declares chez Cloudflare different.
 *
 * ⚠️ **Le nom d'hote doit etre declare sur la cle.** Turnstile compare
 * l'origine de la page hote aux hotes listes dans le tableau de bord (widget ->
 * Hostname Management) et refuse tout le reste par **`110200`** — un code qui
 * ne se corrige pas en JS. `localhost` et le domaine de production doivent y
 * figurer ; l'origine reellement declaree est journalisee a cote du code,
 * parce que c'est la seule question utile face a un `110200`.
 */

/** La cle **publique** du widget. Son absence desactive toute la protection. */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * Vrai quand une cle est configuree. **Tout le reste en depend** : sans cle, le
 * composant ne rend rien, aucun jeton n'est exige et la connexion part sans
 * `captchaToken` — c'est-a-dire exactement le comportement d'avant. Un poste de
 * developpement sans `.env` complet, et `next build`, continuent donc de
 * fonctionner.
 */
export const CAPTCHA_ENABLED = SITE_KEY.length > 0;

/** Le script de Cloudflare met parfois plus de temps qu'il n'echoue. */
const SCRIPT_TIMEOUT_MS = 15_000;

type TurnstileOptions = {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  language?: string;
  "refresh-expired"?: "auto" | "manual" | "never";
  retry?: "auto" | "never";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  "error-callback"?: (code?: string) => void;
};

type TurnstileApi = {
  render: (element: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
};

/**
 * Le nom du rappel de chargement. ⚠️ **Il doit etre global** : c'est le script
 * de Cloudflare qui le cherche sur `window`, par le nom passe dans `onload=`.
 */
const ONLOAD_CALLBACK = "__ifsTurnstileOnload";

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    [ONLOAD_CALLBACK]?: () => void;
  }
}

/**
 * Le script n'est charge qu'une fois par onglet, et la promesse est partagee :
 * un remontage du widget (cf. `reset()`) ne doit pas rajouter une balise.
 */
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    // ⚠️ **C'est `onload=` qui dit que l'API est prete, pas `script.onload` ni
    // `turnstile.ready()`.** La premiere version appelait `turnstile.ready()`
    // apres le chargement : ce rappel n'existe que pour la file d'attente
    // *avant* chargement, et une fois le script en place il journalise
    // « turnstile.ready() would break if called before the Turnstile api.js
    // script is loaded » puis leve — l'echec remontait donc en `script`, comme
    // si le reseau avait avale la requete. Le parametre `onload` est la seule
    // notification documentee.
    window[ONLOAD_CALLBACK] = () => resolve();

    const script = document.createElement("script");
    script.src =
      `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${ONLOAD_CALLBACK}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      // La promesse est oubliee pour qu'un « Reessayer » reparte du script et
      // non d'un echec memorise.
      scriptPromise = null;
      reject(new Error("script"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export type CaptchaState = {
  /** Faux quand aucune cle n'est configuree : ne rien exiger, ne rien rendre. */
  enabled: boolean;
  /** Le jeton a passer a `options.captchaToken`, ou `null` tant qu'il manque. */
  token: string | null;
  /** Le widget a echoue (reseau, cle refusee, hote non declare). */
  failed: boolean;
  /**
   * Le widget est dessine. Faux pendant le chargement du script : sans cet
   * etat, le cadre reste vide plusieurs secondes sur un reseau lent et
   * l'utilisateur se voit repondre « confirmez d'abord que vous n'etes pas un
   * robot » en designant du vide.
   */
  ready: boolean;
  /** Change a chaque `reset()` — sert de `key` au widget, qui repart a neuf. */
  nonce: number;
  onEvent: (event: CaptchaEvent) => void;
  /** A appeler **apres chaque envoi**, reussi ou non. Voir ci-dessous. */
  reset: () => void;
};

type CaptchaEvent =
  | { type: "ready" }
  | { type: "token"; token: string }
  | { type: "expired" }
  | { type: "error"; code?: string };

/**
 * L'etat d'un defi, a tenir par l'ecran qui porte le formulaire.
 *
 * ⚠️ **Un jeton ne sert qu'une fois.** Cloudflare le marque consomme des que
 * GoTrue l'a verifie : reutiliser le meme au second essai fait echouer *toutes*
 * les tentatives suivantes, ce qui se lit comme une panne de l'application
 * alors que le mot de passe etait simplement faux la premiere fois. D'ou
 * `reset()` appele dans **tous** les chemins de sortie d'un envoi, refus
 * compris.
 */
export function useCaptcha(): CaptchaState {
  const [token, setToken] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);

  const onEvent = React.useCallback((event: CaptchaEvent) => {
    if (event.type === "ready") {
      setReady(true);
      return;
    }
    if (event.type === "token") {
      // Un jeton vaut « dessine » : le mode gere peut resoudre le defi avant
      // meme que le rappel de rendu ne nous parvienne.
      setReady(true);
      setToken(event.token);
      setFailed(false);
      return;
    }
    // Un jeton expire (5 min) n'est pas un echec : Turnstile en redemande un
    // tout seul (`refresh-expired: auto`). On oublie seulement celui qu'on a.
    if (event.type === "expired") {
      setToken(null);
      return;
    }
    // ⚠️ L'origine est journalisee avec le code parce qu'un `110200` ne veut
    // dire qu'une chose — « ce nom d'hote n'est pas declare sur la cle » — et
    // que la seule question utile est alors *quel* nom d'hote a ete envoye.
    console.warn("[captcha] defi refuse", event.code ?? "", window.location.origin);
    setToken(null);
    setFailed(true);
    // Un echec met fin a l'attente : le cadre doit montrer la sortie, pas un
    // indicateur qui tourne indefiniment.
    setReady(true);
  }, []);

  const reset = React.useCallback(() => {
    setToken(null);
    setFailed(false);
    setReady(false);
    setNonce((value) => value + 1);
  }, []);

  return { enabled: CAPTCHA_ENABLED, token, failed, ready, nonce, onEvent, reset };
}

export type CaptchaLabels = {
  label: string;
  loading: string;
  failed: string;
  retry: string;
};

/**
 * Le defi lui-meme. A monter avec `key={captcha.nonce}` pour que `reset()` le
 * fasse repartir a neuf.
 *
 * Il est **visible** et non « invisible » : le mode gere de Turnstile peut
 * decider de presenter une case a cocher, et un widget cache attendrait alors
 * un geste que personne ne peut faire — l'envoi resterait bloque sans que rien
 * ne l'explique.
 */
export function Captcha({
  state,
  language,
  labels,
}: {
  state: CaptchaState;
  /** `fr` / `en` : la langue du back-office, pas celle du navigateur. */
  language: string;
  labels: CaptchaLabels;
}) {
  const host = React.useRef<HTMLDivElement>(null);
  const { onEvent } = state;

  React.useEffect(() => {
    if (!CAPTCHA_ENABLED) return;

    // ⚠️ Le montage est asynchrone (chargement du script) et React 19 rejoue
    // l'effet en developpement : sans ce drapeau, deux widgets se dessinent
    // l'un sur l'autre et le premier n'est jamais retire.
    let cancelled = false;
    let widgetId: string | null = null;

    // Chien de garde : si le script n'arrive jamais (reseau qui avale la
    // requete sans la rejeter, filtrage), `onerror` ne se declenche pas et
    // aucun rappel de Turnstile ne viendra le dire.
    const watchdog = window.setTimeout(() => {
      if (!cancelled) onEvent({ type: "error", code: "script_timeout" });
    }, SCRIPT_TIMEOUT_MS);

    loadTurnstile()
      .then(() => {
        const api = window.turnstile;
        if (cancelled || !host.current) return;
        window.clearTimeout(watchdog);
        if (!api) {
          onEvent({ type: "error", code: "no_api" });
          return;
        }
        widgetId = api.render(host.current, {
          sitekey: SITE_KEY,
          theme: "dark",
          language,
          "refresh-expired": "auto",
          retry: "auto",
          callback: (token) => onEvent({ type: "token", token }),
          "expired-callback": () => onEvent({ type: "expired" }),
          "timeout-callback": () => onEvent({ type: "error", code: "timeout" }),
          "error-callback": (code) => onEvent({ type: "error", code }),
        });
        onEvent({ type: "ready" });
      })
      .catch((error: unknown) => {
        // ⚠️ Ce `catch` couvre le chargement **et** le rendu : un `render()`
        // qui leve (cle absente, conteneur deja occupe) arriverait ici. D'ou
        // le message reel plutot qu'un code fige, qui avait deja fait passer
        // une erreur de rendu pour une panne reseau.
        if (!cancelled) {
          onEvent({ type: "error", code: String((error as Error)?.message ?? error) });
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [language, onEvent]);

  if (!state.enabled) return null;

  return (
    <div className="space-y-2">
      {/* La hauteur est **reservee** : le gabarit de Turnstile fait 65 px et
          s'inserait d'un coup au milieu du formulaire, poussant le bouton
          d'envoi vers le bas a l'instant ou le doigt s'y pose. */}
      <div className="relative min-h-[65px]" aria-label={labels.label}>
        <div ref={host} />
        {!state.ready ? (
          // L'attente est **posee par-dessus** et non a la place du widget :
          // le remplacer demonterait le conteneur que Turnstile vient de
          // recevoir, et le rendu repartirait de zero a chaque bascule.
          <div className="pointer-events-none absolute inset-0 flex items-center gap-2 text-xs text-white/55">
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            {labels.loading}
          </div>
        ) : null}
      </div>

      {/* ⚠️ Un echec doit porter sa sortie. `retry: 'auto'` relance tout seul
          une coupure reseau, mais **pas** une erreur de configuration
          (`110200`, cle refusee) ni un `script_timeout` : la page les signale
          une fois puis se tait, et sans ce bouton l'ecran devenait un
          cul-de-sac. `reset()` change le `nonce`, donc le composant remonte. */}
      {state.failed ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-destructive">
          {labels.failed}
          <button
            type="button"
            onClick={state.reset}
            className="rounded-full border border-brand/40 px-3 py-1 font-medium text-brand transition-colors hover:bg-brand/10"
          >
            {labels.retry}
          </button>
        </p>
      ) : null}
    </div>
  );
}
