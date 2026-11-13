import React, { useState } from 'react';
import { Menu, Moon, Sun, User, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext.tsx';
import type { LanguageCode, PortalId } from '../types/index.ts';

export const Navbar: React.FC = () => {
  const {
    theme,
    toggleTheme,
    language,
    setLanguage,
    t,
    portal,
    setPortal,
    user,
    setAuthOpen,
  } = useAppContext();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{ id: PortalId; label: string }> = [
    { id: 'landing', label: t.navHome },
    { id: 'investor', label: t.navInvestor },
    { id: 'broker', label: t.navBroker },
    { id: 'practice', label: t.navPractice },
  ];

  const handleNav = (id: PortalId) => {
    setPortal(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#F8F6F0]/95 backdrop-blur-md dark:border-slate-800 dark:bg-[#111827]/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('landing')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#087F5B]"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle
              cx="14"
              cy="14"
              r="12"
              className="stroke-[#087F5B] dark:stroke-[#34D399]"
              strokeWidth="2"
            />
            <circle
              cx="14"
              cy="14"
              r="7"
              className="stroke-[#782F46] dark:stroke-[#B76E85]"
              strokeWidth="1.8"
            />
            <circle cx="14" cy="14" r="2.6" className="fill-[#087F5B] dark:fill-[#34D399]" />
          </svg>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
            BULLSEYE AI
          </span>
        </button>

        {/* Zone 2: Concise Portal Navigation Links */}
        <nav aria-label="Primary Portals" className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const active = portal === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`whitespace-nowrap shrink-0 border-b-2 py-1 text-sm font-medium transition-colors ${
                  active
                    ? 'border-[#087F5B] text-[#087F5B] dark:border-[#34D399] dark:text-[#34D399]'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Language, Theme, Auth Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <label htmlFor="language-select" className="sr-only">
            Language
          </label>
          <select
            id="language-select"
            aria-label="Select interface language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            <option value="en">EN</option>
            <option value="hi">हिन्दी</option>
            <option value="te">తెలుగు</option>
          </select>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200 dark:hover:bg-slate-800 shrink-0"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#087F5B] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#06684A] dark:bg-[#34D399] dark:text-slate-950 dark:hover:bg-[#2bb986] whitespace-nowrap shrink-0"
          >
            <User className="h-3.5 w-3.5" />
            <span>{user ? user.name.split(' ')[0] : t.signIn}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 md:hidden dark:border-slate-700 dark:bg-[#1F2937] dark:text-slate-200"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-[#1F2937]">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
                  portal === item.id
                    ? 'bg-[#087F5B]/10 text-[#087F5B] dark:bg-[#34D399]/15 dark:text-[#34D399]'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setAuthOpen(true);
              }}
              className="mt-2 rounded-lg bg-[#087F5B] px-3 py-2.5 text-center text-sm font-semibold text-white dark:bg-[#34D399] dark:text-slate-950"
            >
              {user ? `${user.name} (${user.role})` : t.signIn}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
