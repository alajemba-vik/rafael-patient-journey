// Translations for the interface. French is the Institute's language and the fallback: a text
// missing in another language shows in French. Adding a language means adding its file in
// `locales/` and an entry in LANGUAGES; the key set is checked against French by a test.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fr from "./locales/fr.json";

/** Each language's own name (shown in the switcher) and the locale used for dates and numbers. */
export const LANGUAGES = {
  fr: { name: "Français", intlLocale: "fr-FR" },
  en: { name: "English", intlLocale: "en-GB" },
} as const;

export type Language = keyof typeof LANGUAGES;

export const DEFAULT_LANGUAGE: Language = "fr";

// The choice is kept per browser in localStorage: unlike the session token it is not personal.
const STORAGE_KEY = "rafael.language";

function isLanguage(value: string | null | undefined): value is Language {
  return value != null && value in LANGUAGES;
}

/** The saved choice, else the browser's language when we have it, else French. */
function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Storage blocked: fall through to the browser's language.
  }
  const browser = navigator.languages?.map((tag) => tag.slice(0, 2).toLowerCase()).find(isLanguage);
  return browser ?? DEFAULT_LANGUAGE;
}

export const resources = { fr: { translation: fr }, en: { translation: en } } as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: Object.keys(LANGUAGES),
  // Resources are bundled, so the first render already has its texts.
  initAsync: false,
  // React escapes what it renders.
  interpolation: { escapeValue: false },
});

function applyToDocument(language: string): void {
  document.documentElement.lang = language;
}
applyToDocument(i18n.language);
i18n.on("languageChanged", applyToDocument);

/** The language the interface is in now. */
export function currentLanguage(): Language {
  return isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE;
}

/** Switch the interface's language and remember it for this browser. */
export function changeLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage blocked: the choice lasts until the page reloads.
  }
  void i18n.changeLanguage(language);
}

export { i18n };
