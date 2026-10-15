import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { LanguageCode } from '../../i18n/translations';
import styles from './LanguageSwitcher.module.css';

const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  zh: '中文',
  pt: 'Português',
  ar: 'العربية',
  ko: '한국어',
  es: 'Español',
};

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.square}
        onClick={() => setOpen((o) => !o)}
        aria-label="Change language"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {language.toUpperCase()}
      </button>

      {open && (
        <ul className={styles.menu} role="listbox">
          {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === language}
                className={`${styles.option} ${code === language ? styles.optionActive : ''}`}
                onClick={() => {
                  setLanguage(code as LanguageCode);
                  setOpen(false);
                }}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
