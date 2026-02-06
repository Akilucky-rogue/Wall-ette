import React from 'react';
import { AppScreen } from '../types';
import { Sprout, LotusFlower } from './SplashScreen';

interface NavigationProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentScreen, onNavigate }) => {
  const getIconStyle = (screen: AppScreen) => {
    const isActive = currentScreen === screen || 
                     (screen === AppScreen.HISTORY && currentScreen === AppScreen.HISTORY) || // Grouping
                     (screen === AppScreen.ANALYSIS && (currentScreen === AppScreen.ANALYSIS || currentScreen === AppScreen.CATEGORY_SPLIT)) ||
                     (screen === AppScreen.DASHBOARD && (currentScreen === AppScreen.DASHBOARD || currentScreen === AppScreen.INCOME_INSIGHTS));

    return isActive ? 'text-sage' : 'text-muted-taupe opacity-60 hover:text-sage hover:opacity-100 transition-colors';
  };

  const getTextStyle = (screen: AppScreen) => {
    const isActive = currentScreen === screen;
    return isActive ? 'text-sage' : 'text-muted-taupe opacity-60';
  };

  const getIconFill = (screen: AppScreen) => {
    return currentScreen === screen ? 1 : 0;
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-6 py-6 z-40 bg-gradient-to-t from-zen-bg via-zen-bg to-transparent pointer-events-none">
      <div className="relative bg-white/95 backdrop-blur-xl border border-black/[0.05] rounded-[32px] shadow-soft px-8 py-3 flex justify-between items-center pointer-events-auto">
        {/* Mini eco decorations */}
        <div className="absolute -top-3 left-8 opacity-60">
          <Sprout size="sm" />
        </div>
        <div className="absolute -top-2 right-12 opacity-50">
          <LotusFlower size="sm" color="#E8A5A5" />
        </div>
        
        <button 
            onClick={() => onNavigate(AppScreen.DASHBOARD)}
            className={`flex flex-col items-center gap-1 ${getIconStyle(AppScreen.DASHBOARD)}`}
        >
          <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: `'FILL' ${getIconFill(AppScreen.DASHBOARD)}` }}>home</span>
          <span className={`text-[9px] font-bold uppercase tracking-widest ${getTextStyle(AppScreen.DASHBOARD)}`}>Home</span>
        </button>

        <button 
            onClick={() => onNavigate(AppScreen.HISTORY)}
            className={`flex flex-col items-center gap-1 ${getIconStyle(AppScreen.HISTORY)}`}
        >
          <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: `'FILL' ${getIconFill(AppScreen.HISTORY)}` }}>wallet</span>
          <span className={`text-[9px] font-bold uppercase tracking-widest ${getTextStyle(AppScreen.HISTORY)}`}>Vault</span>
        </button>

        <button 
            onClick={() => onNavigate(AppScreen.ANALYSIS)}
            className={`flex flex-col items-center gap-1 ${getIconStyle(AppScreen.ANALYSIS)}`}
        >
          <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: `'FILL' ${getIconFill(AppScreen.ANALYSIS)}` }}>query_stats</span>
          <span className={`text-[9px] font-bold uppercase tracking-widest ${getTextStyle(AppScreen.ANALYSIS)}`}>Pulse</span>
        </button>

        <button 
            onClick={() => onNavigate(AppScreen.SELF)}
            className={`flex flex-col items-center gap-1 ${getIconStyle(AppScreen.SELF)}`}
        >
          <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: `'FILL' ${getIconFill(AppScreen.SELF)}` }}>account_circle</span>
          <span className={`text-[9px] font-bold uppercase tracking-widest ${getTextStyle(AppScreen.SELF)}`}>Self</span>
        </button>

      </div>
    </nav>
  );
};

export default Navigation;
