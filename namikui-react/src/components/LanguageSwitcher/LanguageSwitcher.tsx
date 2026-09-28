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

  return (
    <select
      className={styles.select}
      value={language}
      onChange={(e) => setLanguage(e.target.value as LanguageCode)}
      aria-label="Change language"
    >
      {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
