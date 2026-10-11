"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  SupportedLanguage,
  translateKey,
  translateCategory,
  translateSubcategory,
  translateStatus,
} from "./dictionaries";

const LANG_COOKIE_NAME = "nagarsetu_lang";

interface I18nContextValue {
  lang: SupportedLanguage;
  setLang: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
  tCat: (name: string) => string;
  tCategory: (name: string) => string;
  tSub: (name: string) => string;
  tSubcategory: (name: string) => string;
  tStatus: (status: string) => { label: string; explanation: string };
}

const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  setLang: () => {},
  t: (k) => translateKey("en", k),
  tCat: (n) => translateCategory("en", n),
  tCategory: (n) => translateCategory("en", n),
  tSub: (n) => translateSubcategory("en", n),
  tSubcategory: (n) => translateSubcategory("en", n),
  tStatus: (s) => translateStatus("en", s),
});

function readCookieLang(): SupportedLanguage {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LANG_COOKIE_NAME}=([^;]*)`)
  );
  const val = match ? decodeURIComponent(match[1]) : "";
  if (val === "en" || val === "mr" || val === "hi") return val;
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<SupportedLanguage>("en");

  useEffect(() => {
    setLangState(readCookieLang());
  }, []);

  const setLang = (next: SupportedLanguage) => {
    setLangState(next);
    if (typeof document !== "undefined") {
      document.cookie = `${LANG_COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    }
  };

  return (
    <I18nContext.Provider
      value={{
        lang,
        setLang,
        t: (key: string) => translateKey(lang, key),
        tCat: (name: string) => translateCategory(lang, name),
        tCategory: (name: string) => translateCategory(lang, name),
        tSub: (name: string) => translateSubcategory(lang, name),
        tSubcategory: (name: string) => translateSubcategory(lang, name),
        tStatus: (status: string) => translateStatus(lang, status),
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
