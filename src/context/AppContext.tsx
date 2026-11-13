import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  INVESTOR_UI_DICT,
  TRANSLATIONS,
  type InvestorUiDict,
  type TranslationBundle,
} from '../i18n/translations.ts';
import { api, getAuthToken, setAuthToken } from '../services/api.ts';
import type { LanguageCode, PortalId, ThemeMode, UserProfile } from '../types/index.ts';

export interface AiContextPayload {
  title: string;
  symbol?: string;
  data: Record<string, unknown>;
  suggestedPrompt?: string;
}

interface AppContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: TranslationBundle;
  inv: InvestorUiDict;
  portal: PortalId;
  setPortal: (portal: PortalId) => void;
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  user: UserProfile | null;
  authChecking: boolean;
  completeAuthSession: (user: UserProfile, token: string) => void;
  logoutUser: () => Promise<void>;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (open: boolean) => void;
  aiContext: AiContextPayload | null;
  pendingAiPrompt: string | null;
  clearPendingAiPrompt: () => void;
  openAiWithContext: (ctx: AiContextPayload, prompt?: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('bullseye_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('bullseye_lang');
    return saved === 'hi' || saved === 'te' ? saved : 'en';
  });

  const [portal, setPortal] = useState<PortalId>(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('portal');
    if (p === 'investor' || p === 'broker' || p === 'practice') return p;
    if (params.get('autostart') === '1') return 'investor';
    return 'landing';
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (portal === 'landing') {
      url.searchParams.delete('portal');
    } else {
      url.searchParams.set('portal', portal);
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [portal]);

  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(() => Boolean(getAuthToken()));

  const [authOpen, setAuthOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AiContextPayload | null>(null);
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null);

  // Verify stored token against backend SQLite sessions on startup
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    api
      .getMe()
      .then((res) => {
        setUser(res.user);
        if (res.user.preferredLanguage) {
          setLanguageState(res.user.preferredLanguage);
          localStorage.setItem('bullseye_lang', res.user.preferredLanguage);
        }
      })
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('bullseye_theme', theme);
  }, [theme]);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('bullseye_lang', lang);
    if (user && getAuthToken()) {
      api
        .updatePreferences(lang)
        .then((res) => {
          setUser((prev) => (prev ? { ...prev, preferredLanguage: res.preferredLanguage } : prev));
        })
        .catch(() => {});
    }
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const completeAuthSession = (profile: UserProfile, token: string) => {
    setAuthToken(token);
    setUser(profile);
    if (profile.preferredLanguage) {
      setLanguageState(profile.preferredLanguage);
      localStorage.setItem('bullseye_lang', profile.preferredLanguage);
    }
    setAuthOpen(false);
  };

  const logoutUser = async () => {
    try {
      await api.logout();
    } catch {
      // ignore if session already expired
    }
    setAuthToken(null);
    setUser(null);
    setAuthOpen(false);
  };

  const openAiWithContext = (ctx: AiContextPayload, prompt?: string) => {
    setAiContext(ctx);
    if (prompt) setPendingAiPrompt(prompt);
    setAiOpen(true);
  };

  const clearPendingAiPrompt = () => setPendingAiPrompt(null);

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        language,
        setLanguage,
        t: TRANSLATIONS[language],
        inv: INVESTOR_UI_DICT[language],
        portal,
        setPortal,
        selectedSymbol,
        setSelectedSymbol,
        user,
        authChecking,
        completeAuthSession,
        logoutUser,
        authOpen,
        setAuthOpen,
        aiOpen,
        setAiOpen,
        aiContext,
        pendingAiPrompt,
        clearPendingAiPrompt,
        openAiWithContext,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}
