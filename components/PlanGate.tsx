import React from 'react';
import { AppScreen } from '../types';
import { usePlan } from '../services/plan';
import { canAdd, opens, type PlusFeature } from '../services/planRules';
import PlanLock, { type LockReason } from './PlanLock';
import PageHeader from './ui/PageHeader';
import Garden from './ui/Garden';

const REASON: Partial<Record<PlusFeature, LockReason>> = { rewind: 'rewind', recurring: 'recurring', 'flow-story': 'flow-story' };
/** Where Back goes, as the other pages name it. */
const BACK_LABEL: Partial<Record<AppScreen, string>> = { [AppScreen.ANALYSIS]: 'Back to Pulse', [AppScreen.DASHBOARD]: 'Back to Home' };

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
      <Garden />
      <PageHeader title={title} onBack={() => onNavigate(back)} backLabel={BACK_LABEL[back] ?? 'Back'} />
      <div className="px-6 pt-2">
        <PlanLock reason={reason} />
      </div>
    </div>
  );
};

export default PlanGate;
