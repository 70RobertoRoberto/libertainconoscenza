// Simple i18n system for Conoscenza Aperta (Italian + English)
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export type Lang = "it" | "en";

const LANG_KEY = "ca_lang";

const listeners = new Set<(l: Lang) => void>();
let currentLang: Lang = "it";
let initialized = false;
let initPromise: Promise<void> | null = null;

async function getStored(): Promise<Lang | null> {
  try {
    if (Platform.OS === "web") return (window.localStorage.getItem(LANG_KEY) as Lang) || null;
    return (await SecureStore.getItemAsync(LANG_KEY)) as Lang | null;
  } catch {
    return null;
  }
}

// Runs only once for the whole app lifetime.
export async function initLang(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const s = await getStored();
    if (s === "it" || s === "en") currentLang = s;
    initialized = true;
    listeners.forEach((f) => f(currentLang));
  })();
  return initPromise;
}

export async function setLang(l: Lang) {
  // Mark as initialised immediately so a late initLang() cannot overwrite the user choice.
  initialized = true;
  currentLang = l;
  // Notify listeners synchronously so UI updates instantly.
  listeners.forEach((f) => f(l));
  // Persist to storage (fire and forget, but await for callers that want to know when it's persisted).
  try {
    if (Platform.OS === "web") {
      window.localStorage.setItem(LANG_KEY, l);
    } else {
      await SecureStore.setItemAsync(LANG_KEY, l);
    }
  } catch {}
}

export function useLang() {
  const [lang, setStateLang] = useState<Lang>(currentLang);
  useEffect(() => {
    // Only actually reads storage once for the whole app.
    if (!initialized) {
      initLang().then(() => setStateLang(currentLang));
    } else {
      // Ensure local state matches global if it drifted before mount.
      setStateLang(currentLang);
    }
    const cb = (l: Lang) => setStateLang(l);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);
  return { lang, setLang, t: (k: keyof typeof STRINGS.it) => STRINGS[lang][k] || STRINGS.it[k] || String(k) };
}

// Category translations (backend stores Italian names as canonical)
export const CATEGORY_LABELS: Record<string, { it: string; en: string }> = {
  "Crescita personale": { it: "Crescita personale", en: "Personal Growth" },
  "Spirituale": { it: "Spirituale", en: "Spiritual" },
  "Fisica quantistica": { it: "Fisica quantistica", en: "Quantum Physics" },
  "Meditazione": { it: "Meditazione", en: "Meditation" },
  "Discipline orientali": { it: "Discipline orientali", en: "Eastern Disciplines" },
  "Naturopatia": { it: "Naturopatia", en: "Naturopathy" },
  "Psicologia": { it: "Psicologia", en: "Psychology" },
  "Medicina Integrata": { it: "Medicina Integrata", en: "Integrative Medicine" },
  "Filosofia": { it: "Filosofia", en: "Philosophy" },
  "Nutrizione": { it: "Nutrizione", en: "Nutrition" },
  "Somatognostica": { it: "Somatognostica", en: "Somatognostics" },
  "Coscienza": { it: "Coscienza", en: "Consciousness" },
  "Tradizioni Esoteriche": { it: "Tradizioni Esoteriche", en: "Esoteric Traditions" },
  "Guarigione Energetica": { it: "Guarigione Energetica", en: "Energy Healing" },
  "Video": { it: "Video", en: "Video" },
};

export function catLabel(cat: string, lang: Lang) {
  return CATEGORY_LABELS[cat]?.[lang] || cat;
}

export const STRINGS = {
  it: {
    // Auth
    tagline: "Sapienza per crescere",
    login_title: "Conoscenza Aperta",
    login_subtitle: "Accedi alla tua comunità di conoscenza",
    phone: "Numero di telefono",
    password: "Password",
    login: "Accedi",
    register: "Registrati",
    no_account: "Non hai un account?",
    have_account: "Hai già un account?",
    register_title: "Crea il tuo account",
    register_subtitle: "Entra nella community di conoscenza",
    name_required: "Nome",
    name_placeholder: "Il tuo nome",
    password_hint: "Password (min 6 caratteri)",
    language: "Lingua",
    referral_optional: "Codice referral (facoltativo)",
    // Tabs
    tab_home: "Home",
    tab_library: "Biblioteca",
    tab_media: "Media",
    tab_messages: "Messaggi",
    tab_profile: "Profilo",
    // Content
    latest_articles: "Ultimi articoli",
    all: "Tutte",
    all_media: "Tutti",
    meditations: "Meditazioni",
    videos: "Video",
    reads: "letture",
    views: "visualizzazioni",
    minutes: "min",
    premium: "Premium",
    free: "Gratuito",
    community_messages: "Comunicazioni dalla community",
    no_content: "Nessun contenuto disponibile",
    no_messages: "Nessun messaggio",
    search_placeholder: "Cerca articoli, meditazioni…",
    results_for: "Risultati per",
    no_results: "Nessun risultato",
    library_title: "Biblioteca",
    media_title: "Meditazioni & Video",
    messages_title: "Messaggi",
    // Media
    listen_now: "▶  Ascolta ora",
    watch_now: "▶  Guarda ora",
    premium_required: "Questo contenuto è riservato agli abbonati.",
    unlock_premium: "Sblocca Premium",
    download_cert: "🏅  Scarica attestato di completamento",
    // Article
    source: "Fonte",
    editorial: "Articolo di Redazione",
    comments: "Commenti",
    write_comment: "Lascia un pensiero…",
    send: "Invia",
    // Profile
    seeker: "Cercatore",
    admin: "Admin",
    unlock_advanced: "Sblocca la Conoscenza Avanzata",
    unlock_desc: "Corsi, meditazioni e contenuti esclusivi da 3, 6 o 12 mesi.",
    see_plans: "Vedi i piani",
    admin_panel: "Pannello Admin",
    logout: "Esci",
    favorites: "Preferiti",
    favorites_see: "Vedi i miei preferiti",
    my_path: "📊  Il tuo percorso",
    articles_read: "Articoli letti",
    min_meditated: "Min. meditati",
    streak_days: "Giorni di fila",
    keep_exploring: "Continua ad esplorare per sbloccare badge di continuità.",
    invite: "🎁  Invita e guadagna",
    invite_desc: "Condividi il tuo codice: quando un amico si iscrive con il tuo codice ricevi un mese Premium in regalo.",
    invited: "invitati",
    share_code: "Condividi il codice",
    // Favorites screen
    favorites_title: "Preferiti",
    no_favorites: "Non hai ancora salvato preferiti.",
    no_favorites_hint: "Tocca il cuore su un articolo o meditazione.",
    articles: "Articoli",
    meditations_and_videos: "Meditazioni & Video",
    // Paywall
    paywall_title: "Sblocca la Conoscenza Avanzata",
    paywall_desc: "Accesso completo a corsi, meditazioni e contenuti premium.",
    continue_subscription: "Continua con l'abbonamento",
    best_value: "MIGLIOR VALORE",
    have_coupon: "Hai un codice sconto?",
    apply: "Applica",
    coupon_applied: "Codice {code} applicato",
    // Share
    share_from: "— da Conoscenza Aperta",
    // Errors
    err_creds: "Inserisci telefono e password",
    err_min: "Password minimo 6 caratteri",
    err_required: "Numero e password richiesti",
  },
  en: {
    tagline: "Wisdom to grow",
    login_title: "Conoscenza Aperta",
    login_subtitle: "Sign in to your community of knowledge",
    phone: "Phone number",
    password: "Password",
    login: "Sign in",
    register: "Sign up",
    no_account: "No account yet?",
    have_account: "Already have an account?",
    register_title: "Create your account",
    register_subtitle: "Join the knowledge community",
    name_required: "Name",
    name_placeholder: "Your name",
    password_hint: "Password (min 6 characters)",
    language: "Language",
    referral_optional: "Referral code (optional)",
    tab_home: "Home",
    tab_library: "Library",
    tab_media: "Media",
    tab_messages: "Messages",
    tab_profile: "Profile",
    latest_articles: "Latest articles",
    all: "All",
    all_media: "All",
    meditations: "Meditations",
    videos: "Videos",
    reads: "reads",
    views: "views",
    minutes: "min",
    premium: "Premium",
    free: "Free",
    community_messages: "Community updates",
    no_content: "No content available",
    no_messages: "No messages",
    search_placeholder: "Search articles, meditations…",
    results_for: "Results for",
    no_results: "No results",
    library_title: "Library",
    media_title: "Meditations & Videos",
    messages_title: "Messages",
    listen_now: "▶  Listen now",
    watch_now: "▶  Watch now",
    premium_required: "This content is reserved for subscribers.",
    unlock_premium: "Unlock Premium",
    download_cert: "🏅  Download completion certificate",
    source: "Source",
    editorial: "Editorial article",
    comments: "Comments",
    write_comment: "Leave a thought…",
    send: "Send",
    seeker: "Seeker",
    admin: "Admin",
    unlock_advanced: "Unlock Advanced Knowledge",
    unlock_desc: "Courses, meditations and exclusive content for 3, 6 or 12 months.",
    see_plans: "See plans",
    admin_panel: "Admin Panel",
    logout: "Sign out",
    favorites: "Favorites",
    favorites_see: "See my favorites",
    my_path: "📊  Your journey",
    articles_read: "Articles read",
    min_meditated: "Min. meditated",
    streak_days: "Day streak",
    keep_exploring: "Keep exploring to unlock continuity badges.",
    invite: "🎁  Invite & earn",
    invite_desc: "Share your code: when a friend signs up with it, you get one free Premium month.",
    invited: "invited",
    share_code: "Share the code",
    favorites_title: "Favorites",
    no_favorites: "You haven't saved any favorites yet.",
    no_favorites_hint: "Tap the heart on any article or meditation.",
    articles: "Articles",
    meditations_and_videos: "Meditations & Videos",
    paywall_title: "Unlock Advanced Knowledge",
    paywall_desc: "Full access to courses, meditations, and premium content.",
    continue_subscription: "Continue with subscription",
    best_value: "BEST VALUE",
    have_coupon: "Have a discount code?",
    apply: "Apply",
    coupon_applied: "Code {code} applied",
    share_from: "— from Conoscenza Aperta",
    err_creds: "Enter phone and password",
    err_min: "Password min 6 characters",
    err_required: "Phone and password required",
  },
} as const;
