import React, { useMemo, useRef, useEffect, useState } from 'react';
import styles from './IncomeInsights.module.css';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { WallEMascot, FloatingLeaf, LotusFlower, RangoliCorner, Diya, MandalaDots } from './SplashScreen';

interface IncomeInsightsProps {
  onNavigate: (screen: AppScreen) => void;
}

const IncomeInsights: React.FC<IncomeInsightsProps> = ({ onNavigate }) => {

  // ...existing code...
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-6 opacity-40" delay={0.4} />
      <FloatingLeaf className="top-56 left-4 opacity-30" delay={1.5} color="#A8B89E" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="#8B9E82" />
      <LotusFlower className="absolute top-40 right-4 opacity-35" size="sm" color="#D4B896" />
      <MandalaDots className="absolute bottom-44 left-6 opacity-20" />
      <Diya className="absolute bottom-36 right-8 opacity-40" />
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        <button 
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="flex w-10 items-center justify-start text-muted-taupe hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </button>
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">Income Insights</h2>
        <div className="relative flex w-10 items-center justify-end text-muted-taupe"></div>
      </div>
      <div className="flex flex-col items-center py-16 px-6">
        <h1 className="text-premium-charcoal font-serif text-[32px] leading-tight text-center mb-4">Income Insights</h1>
        <p className="text-muted-taupe text-[13px] text-center max-w-xs">All advanced analytics and visualizations are now available in the Pulse tab.</p>
      </div>
    </div>
  );
};

export default IncomeInsights;