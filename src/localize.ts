import en from "./translations/en.json";
import ptBR from "./translations/pt-BR.json";

export type TranslationKey = keyof typeof en;

// To add a language, copy translations/en.json, translate it and list it here.
// The type check fails if a file is missing a key.
const translations: Record<string, Record<TranslationKey, string>> = {
  en,
  "pt-BR": ptBR,
};

// Returns the string for the user's Home Assistant language, or English.
// Without a hass object, the one on the root element is used.
export function localize(
  key: TranslationKey,
  hass?: any,
  values: Record<string, string | number> = {}
): string {
  const currentHass =
    hass ??
    (document.querySelector("home-assistant") as any)?.hass ??
    (document.querySelector("hc-main") as any)?.hass;
  const language = currentHass?.locale?.language ?? currentHass?.language;
  const strings = translations[language] ?? en;

  // One pass over the translation, so inserted values are never re-read.
  return strings[key].replace(/\{(\w+)\}/g, (match, name) =>
    name in values ? String(values[name]) : match
  );
}

// For the localizeValue property of ha-form, which selectors use to translate
// their own options
export const localizer = (hass: any) => (key: string) =>
  localize(key as TranslationKey, hass) ?? "";
