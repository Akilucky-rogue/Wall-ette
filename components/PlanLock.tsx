import React from 'react';
import { openPlans } from '../services/planSheet';
import { Card } from './ui/Paper';

/** Why something is locked: a Plus page, or what Essential or no plan doesn't do. */
export type LockReason =
  | 'flow-story' | 'rewind' | 'recurring'
  | 'add' | 'import' | 'second-account' | 'history' | 'read-only' | 'payments-paused';

const WHAT: Record<LockReason, { icon: string; title: string; line: string; plus: boolean }> = {
  'flow-story': {
    icon: 'auto_stories', plus: true,
    title: 'Your money story is in Plus',
    line: 'Where your money came from, what you kept and your balance over 12 months. Budgets and your savings goal stay here, on Goals.',
  },
  rewind: {
    icon: 'history', plus: true,
    title: 'Rewind is in Plus',
    line: 'Your whole recorded history by year: records, streaks and where it went.',
  },
  recurring: {
    icon: 'event_repeat', plus: true,
    title: 'Recurring is in Plus',
    line: 'Bills and subscriptions found in your entries, what they cost a year, and price rises.',
  },
  add: {
    icon: 'add_card', plus: false,
    title: 'Choose a plan to keep adding',
    line: 'Your records stay here. You can read, export or delete them any time.',
  },
  import: {
    icon: 'upload_file', plus: false,
    title: 'Choose a plan to import statements',
    line: 'Your records stay here. You can read, export or delete them any time.',
  },
  'second-account': {
    icon: 'account_balance', plus: true,
    title: 'Essential holds one bank account',
    line: 'This statement is from another account. Plus holds as many as you have.',
  },
  history: {
    icon: 'calendar_month', plus: true,
    title: 'Essential keeps 12 months',
    line: 'Older months stay saved, read-only. Plus shows and edits your full history.',
  },
  'read-only': {
    icon: 'lock', plus: true,
    title: 'Read-only on Essential',
    line: "It's from before Essential's 12 months, or from a second bank account. It stays saved; Plus makes it editable again.",
  },
  'payments-paused': {
    icon: 'bolt', plus: false,
    title: 'Payments from your apps are paused',
    line: 'Choose a plan and the payments read since are added. Nothing is lost meanwhile.',
  },
};

/**
 * Shown in place of what a plan doesn't open, once paid plans are switched
 * on. "See plans" opens the shared sheet (services/planSheet.ts).
 */
const PlanLock: React.FC<{ reason: LockReason; compact?: boolean; className?: string }> = ({ reason, compact = false, className = '' }) => {
  const w = WHAT[reason];
  return (
    <Card flush className={`${compact ? 'p-4' : 'p-6 text-center'} ${className}`}>
      <div className={compact ? 'flex items-start gap-3' : 'flex flex-col items-center'}>
        <div className={`${compact ? 'w-9 h-9' : 'w-12 h-12 mb-3'} rounded-2xl bg-sage-light flex items-center justify-center shrink-0`}>
          <span className="material-symbols-outlined text-sage text-[22px]" aria-hidden="true">{w.icon}</span>
        </div>
        <div className={compact ? 'flex-1 min-w-0' : ''}>
          <p className="text-[15px] font-display font-semibold text-premium-charcoal">{w.title}</p>
          <p className="text-[13px] text-muted-taupe leading-relaxed mt-1">{w.line}</p>
          <button
            onClick={() => openPlans(reason)}
            className={`${compact ? 'mt-3' : 'mt-4'} px-5 py-2.5 rounded-full bg-sage text-white text-[13px] font-semibold shadow-soft`}
          >
            {w.plus ? 'See Plus' : 'See plans'}
          </button>
        </div>
      </div>
    </Card>
  );
};

export default PlanLock;

/** What the plans sheet says on top when a lock opened it. */
export const lockTitle = (reason: LockReason): string => WHAT[reason].title;
