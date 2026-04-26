'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type Lang, type TranslationKey, getTranslations } from './i18n';

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'de',
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de');

  useEffect(() => {
    const stored = localStorage.getItem('jfr-lang') as Lang | null;
    if (stored === 'de' || stored === 'en') setLangState(stored);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem('jfr-lang', l);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: getTranslations(lang) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
