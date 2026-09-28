import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { translations } from '../i18n/translations';
import type { LanguageCode, TranslationKey } from '../i18n/translations';

const RTL_LANGUAGES: LanguageCode[] = ['ar'];
const STORAGE_KEY = 'namikui_lang';
const VALID_LANGUAGES: LanguageCode[] = ['en', 'vi', 'zh', 'pt', 'ar', 'ko', 'es'];

interface LanguageState {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  dir: 'ltr' | 'rtl';
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageState | null>(null);

function getInitialLanguage(): LanguageCode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && VALID_LANGUAGES.includes(stored as LanguageCode)) {
    return stored as LanguageCode;
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);
  const dir: 'ltr' | 'rtl' = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  const setLanguage = (lang: LanguageCode) => {
    localStorage.setItem(STORAGE_KEY, lang);
    setLanguageState(lang);
  };

  const t = (key: TranslationKey): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[language] ?? entry.en;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, dir, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
