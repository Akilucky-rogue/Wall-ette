import React from 'react';
import { AppScreen } from '../types';
import { tick } from '../utils/haptics';
import { BrandIcon, Wordmark } from './ui/Brand';

interface NavigationProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  /** The bottom dock on phones and tablets; the side rail on wide screens shows anyway. */
  showDock?: boolean;
}

// The four tabs, and the screens that belong to each, so a page opened from a
// tab keeps that tab lit.
const TABS: { screen: AppScreen; label: string; icon: string; owns: AppScreen[] }[] = [
  {
    screen: AppScreen.DASHBOARD, label: 'Home', icon: 'home',
    owns: [AppScreen.INCOME_INSIGHTS, AppScreen.EXPORT, AppScreen.REWIND, AppScreen.LEFT_TO_SPEND, AppScreen.NEW_ENTRY, AppScreen.IMPORT],
  },
  { screen: AppScreen.HISTORY, label: 'Vault', icon: 'wallet', owns: [] },
  {
    screen: AppScreen.ANALYSIS, label: 'Pulse', icon: 'query_stats',
    owns: [AppScreen.PULSE_TRENDS, AppScreen.PULSE_CATEGORIES, AppScreen.PULSE_RECURRING, AppScreen.PULSE_HEALTH, AppScreen.CATEGORY_SPLIT],
  },
  {
    screen: AppScreen.SELF, label: 'Self', icon: 'account_circle',
    owns: [AppScreen.SELF_ACCOUNT, AppScreen.SELF_ALERTS, AppScreen.SELF_DATA, AppScreen.SELF_APPEARANCE, AppScreen.SELF_ABOUT, AppScreen.MONEY_MOVED, AppScreen.BANK_ACCOUNTS, AppScreen.PAYMENT_APPS, AppScreen.SELF_PLAN],
  },
];

const isActive = (tab: typeof TABS[number], current: AppScreen) => current === tab.screen || tab.owns.includes(current);

/**
 * Getting around. Phones and tablets get a raised dock floating over the
 * bottom of the page; wide screens (lg, 1024px and up) get a rail down the
 * left with the same four tabs and the two things people do most, adding an
 * entry and importing a statement. App.tsx pads the content for the rail.
 */
const Navigation: React.FC<NavigationProps> = ({ currentScreen, onNavigate, showDock = true }) => {
  const go = (screen: AppScreen) => { if (currentScreen !== screen) tick(); onNavigate(screen); };
  return (
    <>
      {showDock && (
        <nav
          aria-label="Main"
          className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-6 pt-6 pb-[calc(1.5rem_+_var(--sab))] z-40 bg-gradient-to-t from-zen-bg via-zen-bg to-transparent pointer-events-none"
        >
          <div className="relative bg-white/95 backdrop-blur-xl border border-black/[0.05] rounded-[32px] shadow-soft px-8 py-3 flex justify-between items-center pointer-events-auto">
            {TABS.map(tab => {
              const active = isActive(tab, currentScreen);
              return (
                <button
                  key={tab.screen}
                  onClick={() => go(tab.screen)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-1 ${active ? 'text-sage' : 'text-muted-taupe opacity-60 hover:text-sage hover:opacity-100 transition-colors'}`}
                >
                  <span className={`material-symbols-outlined text-[26px] ${active ? 'icon-fill' : ''}`} aria-hidden="true">{tab.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Wide screens: a rail of lit paper down the left */}
      <nav
        aria-label="Main"
        className="hidden lg:flex fixed left-5 top-5 bottom-5 w-[220px] z-40 flex-col bg-white rounded-[32px] shadow-soft border border-black/[0.05] px-3 py-5"
      >
        <button onClick={() => go(AppScreen.DASHBOARD)} className="flex items-center gap-2.5 px-2.5 mb-7" aria-label="Wall·ette, Home">
          <BrandIcon size={34} />
          <Wordmark height={17} />
        </button>

        <ul className="space-y-1">
          {TABS.map(tab => {
            const active = isActive(tab, currentScreen);
            return (
              <li key={tab.screen}>
                <button
                  onClick={() => go(tab.screen)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    active ? 'bg-sage-light shadow-pressed text-premium-charcoal' : 'text-muted-taupe hover:bg-zen-bg hover:text-premium-charcoal'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[22px] ${active ? 'icon-fill text-sage' : ''}`} aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto space-y-2">
          <button
            onClick={() => go(AppScreen.NEW_ENTRY)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-sage text-white text-[13px] font-semibold shadow-raised"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
            Add an entry
          </button>
          <button
            onClick={() => go(AppScreen.IMPORT)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-premium-charcoal text-[13px] font-semibold shadow-soft border border-premium-charcoal/[0.08]"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">upload_file</span>
            Import a statement
          </button>
        </div>
      </nav>
    </>
  );
};

export default Navigation;
