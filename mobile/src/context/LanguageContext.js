import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, languageLabels } from '../i18n/translations';

const STORAGE_KEY = '@mykbs:language';

const LanguageContext = createContext({
  language: 'tr',
  setLanguage: () => {},
  t: (key) => key,
  languageLabels: { tr: 'Türkçe', en: 'English', de: 'Deutsch', ru: 'Русский', ar: 'العربية (سوريا)' },
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('tr');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && translations[stored]) setLanguageState(stored);
    });
  }, []);

  const setLanguage = useCallback((lang) => {
    if (!translations[lang]) return;
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const t = useCallback((key) => {
    const parts = key.split('.');
    let obj = translations[language] || translations.tr;
    for (const p of parts) {
      obj = obj?.[p];
    }
    return typeof obj === 'string' ? obj : key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languageLabels }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
