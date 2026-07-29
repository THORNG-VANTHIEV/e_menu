export function createI18n(translations, initialLanguage = "km") {
  let language = initialLanguage in translations ? initialLanguage : "km";

  const t = (key, params = {}) => {
    const fallbackLanguage = language === "km" ? "en" : "km";
    const template = translations[language]?.[key] ?? translations[fallbackLanguage]?.[key] ?? key;
    return Object.entries(params).reduce(
      (output, [name, value]) => output.replaceAll(`{${name}}`, String(value)),
      template
    );
  };

  const localize = (value) => {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    const fallbackLanguage = language === "km" ? "en" : "km";
    return value[language] || value[fallbackLanguage] || "";
  };

  const applyDocumentTranslations = () => {
    document.documentElement.lang = language;
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
    });
  };

  return {
    t,
    localize,
    applyDocumentTranslations,
    get language() {
      return language;
    },
    setLanguage(nextLanguage) {
      if (nextLanguage in translations) language = nextLanguage;
      return language;
    }
  };
}
