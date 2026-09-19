// Simple i18n system for Conoscenza Aperta (Italian + English)
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export type Lang = "it" | "en";

const LANG_KEY = "ca_lang";

const listeners = new Set<(l: Lang) => void>();
let currentLang: Lang = "it";

async function getStored(): Promise<Lang | null> {
  try {
    if (Platform.OS === "web") return (window.localStorage.getItem(LANG_KEY) as Lang) || null;
    return (await SecureStore.getItemAsync(LANG_KEY)) as Lang | null;
  } catch {
    return null;
  }
}

export async function initLang() {
  const s = await getStored();
  if (s === "it" || s === "en") currentLang = s;
  listeners.forEach((f) => f(currentLang));
}

export async function setLang(l: Lang) {
  currentLang = l;
  if (Platform.OS === "web") {
    try { window.localStorage.setItem(LANG_KEY, l); } catch {}
  } else {
    await SecureStore.setItemAsync(LANG_KEY, l);
  }
  listeners.forEach((f) => f(l));
}

export function useLang() {
  const [lang, setStateLang] = useState<Lang>(currentLang);
  useEffect(() => {
    initLang().then(() => setStateLang(currentLang));
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
    name_optional: "Nome (facoltativo)",
    password_hint: "Password (min 6 caratteri)",
    language: "Lingua",
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
    // Media
    listen_now: "▶  Ascolta ora",
    watch_now: "▶  Guarda ora",
    premium_required: "Questo contenuto è riservato agli abbonati.",
    unlock_premium: "Sblocca Premium",
    // Profile
    seeker: "Cercatore",
    admin: "Admin",
    unlock_advanced: "Sblocca la Conoscenza Avanzata",
    unlock_desc: "Corsi, meditazioni e contenuti esclusivi da 3, 6 o 12 mesi.",
    see_plans: "Vedi i piani",
    admin_panel: "Pannello Admin",
    logout: "Esci",
    // Paywall
    paywall_title: "Sblocca la Conoscenza Avanzata",
    paywall_desc: "Accesso completo a corsi, meditazioni e contenuti premium.",
    continue_subscription: "Continua con l'abbonamento",
    best_value: "MIGLIOR VALORE",
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
    name_optional: "Name (optional)",
    password_hint: "Password (min 6 characters)",
    language: "Language",
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
    listen_now: "▶  Listen now",
    watch_now: "▶  Watch now",
    premium_required: "This content is reserved for subscribers.",
    unlock_premium: "Unlock Premium",
    seeker: "Seeker",
    admin: "Admin",
    unlock_advanced: "Unlock Advanced Knowledge",
    unlock_desc: "Courses, meditations and exclusive content for 3, 6 or 12 months.",
    see_plans: "See plans",
    admin_panel: "Admin Panel",
    logout: "Sign out",
    paywall_title: "Unlock Advanced Knowledge",
    paywall_desc: "Full access to courses, meditations, and premium content.",
    continue_subscription: "Continue with subscription",
    best_value: "BEST VALUE",
    share_from: "— from Conoscenza Aperta",
    err_creds: "Enter phone and password",
    err_min: "Password min 6 characters",
    err_required: "Phone and password required",
  },
} as const;
