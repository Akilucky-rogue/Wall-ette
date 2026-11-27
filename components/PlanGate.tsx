import React from 'react';
import { AppScreen } from '../types';
import { usePlan } from '../services/plan';
import { canAdd, opens, type PlusFeature } from '../services/planRules';
import PlanLock, { type LockReason } from './PlanLock';

const REASON: Partial<Record<PlusFeature, LockReason>> = { rewind: 'rewind', recurring: 'recurring', 'flow-story': 'flow-story' };

/**
 * A page that needs Plus (`feature`) or any plan (`adds`: new entries and
 * imports), in App.tsx: the page itself when the plan has it, or while paid
 * plans are switched off; otherwise its title and what a plan adds.
 */
const PlanGate: React.FC<{
  feature?: PlusFeature;
  adds?: 'add' | 'import';
  title: string;
  back: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  children: React.ReactNode;
}> = ({ feature, adds, title, back, onNavigate, children }) => {
  const { access } = usePlan();
  if (feature ? opens(access, feature) : canAdd(access)) return <>{children}</>;
  const reason: LockReason = feature ? REASON[feature] ?? 'rewind' : adds ?? 'add';
  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] md:max-w-2xl lg:max-w-3xl mx-auto pb-32 lg:pb-12 bg-zen-bg">
      <div className="flex items-center gap-2 px-5 pt-6 pb-3">
        <button
          onClick={() => onNavigate(back)}
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
          aria-label="Back"
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
        </button>
        <h2 className="text-premium-charcoal text-[22px] font-display font-bold tracking-tight leading-tight">{title}</h2>
      </div>
      <div className="px-6 pt-2">
        <PlanLock reason={reason} />
      </div>
    </div>
  );
};

export default PlanGate;
