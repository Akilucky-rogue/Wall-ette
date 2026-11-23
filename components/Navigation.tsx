import React from 'react';
import { AppScreen } from '../types';
import { tick } from '../utils/haptics';

interface NavigationProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
}

// The four tabs, and the screens that belong to each, so a page opened from a
// tab keeps that tab lit.
const TABS: { screen: AppScreen; label: string; icon: string; owns: AppScreen[] }[] = [
  { screen: AppScreen.DASHBOARD, label: 'Home', icon: 'home', owns: [AppScreen.INCOME_INSIGHTS, AppScreen.EXPORT, AppScreen.REWIND, AppScreen.LEFT_TO_SPEND] },
  { screen: AppScreen.HISTORY, label: 'Vault', icon: 'wallet', owns: [] },
  {
    screen: AppScreen.ANALYSIS, label: 'Pulse', icon: 'query_stats',
    owns: [AppScreen.PULSE_TRENDS, AppScreen.PULSE_CATEGORIES, AppScreen.PULSE_RECURRING, AppScreen.PULSE_HEALTH, AppScreen.CATEGORY_SPLIT],
  },
  {
    screen: AppScreen.SELF, label: 'Self', icon: 'account_circle',
    owns: [AppScreen.SELF_ACCOUNT, AppScreen.SELF_ALERTS, AppScreen.SELF_DATA, AppScreen.SELF_APPEARANCE, AppScreen.SELF_ABOUT, AppScreen.MONEY_MOVED],
  },
];

/** The bottom dock: a raised bar floating over the page. */
const Navigation: React.FC<NavigationProps> = ({ currentScreen, onNavigate }) => (
  <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 pt-6 pb-[calc(1.25rem_+_var(--sab))] z-40 bg-gradient-to-t from-zen-bg via-zen-bg/90 to-transparent pointer-events-none">
    <div className="relative bg-white/95 backdrop-blur-xl rounded-[30px] shadow-float px-3 py-2 flex justify-between items-center pointer-events-auto">
      {TABS.map(tab => {
        const active = currentScreen === tab.screen || tab.owns.includes(currentScreen);
        return (
          <button
            key={tab.screen}
            onClick={() => { if (currentScreen !== tab.screen) tick(); onNavigate(tab.screen); }}
            aria-current={active ? 'page' : undefined}
            className={`relative flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-2xl transition-colors ${active ? 'text-sage' : 'text-muted-taupe hover:text-sage'}`}
          >
            <span
              className={`flex items-center justify-center w-12 h-8 rounded-full transition-all ${active ? 'bg-sage-light shadow-pressed' : ''}`}
            >
              <span className={`material-symbols-outlined text-[24px] ${active ? 'icon-fill' : ''}`} aria-hidden="true">{tab.icon}</span>
            </span>
            <span className={`text-[10px] font-semibold ${active ? 'text-premium-charcoal' : 'opacity-80'}`}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);

export default Navigation;
