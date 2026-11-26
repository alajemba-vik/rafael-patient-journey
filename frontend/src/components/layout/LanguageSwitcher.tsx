import { useId } from "react";
import { useTranslation } from "react-i18next";

import { changeLanguage, currentLanguage, LANGUAGES, type Language } from "../../i18n";

/** Picks the interface's language. Each language is named in itself, so anyone can find theirs. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="rf-language">
      <label className="rf-visually-hidden" htmlFor={id}>
        {t("shell.language")}
      </label>
      <select
        id={id}
        className="rf-input rf-language__select"
        value={currentLanguage()}
        onChange={(event) => changeLanguage(event.target.value as Language)}
      >
        {Object.entries(LANGUAGES).map(([code, { name }]) => (
          <option key={code} value={code} lang={code}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
