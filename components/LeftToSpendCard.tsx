import React, { useMemo } from 'react';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { leftToSpend, type LeftToSpend as Left } from '../services/leftToSpend';
import { parseDay } from '../utils/dates';

// Home's Left to spend card, and the pieces its page (components/LeftToSpend.tsx,
// loaded when opened) shares with it.

export const shortDay = (day: string) => parseDay(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** "until 1 Dec", "this month", or "until your pay arrives". */
export const periodLabel = (left: Left) =>
  left.payLate ? 'until your pay arrives' : left.basis === 'month' ? 'this month' : `until ${shortDay(left.until)}`;

/** The figure for now (services/leftToSpend.ts). */
export function useLeftToSpend(): Left | null {
  const { transactions, flowOf, savingsGoal } = useWallet();
  return useMemo(() => leftToSpend({ transactions, flowOf, savingsGoal }), [transactions, flowOf, savingsGoal]);
}

/**
 * Where the money that came in has gone (spent, sent or invested, bills still
 * to come, the savings goal) as one bar in a pressed-in track; the empty
 * part of the track is what's left.
 */
export const UsageBar: React.FC<{ left: Left; thin?: boolean }> = ({ left, thin }) => {
  const parts = [
    { value: left.spent, cls: 'bg-rose' },
    { value: left.moved, cls: 'bg-lavender' },
    { value: left.billsTotal, cls: 'bg-sand' },
    { value: left.toSetAside, cls: 'bg-sage' },
  ];
  const total = Math.max(left.cameIn, parts.reduce((s, p) => s + p.value, 0));
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-premium-charcoal/[0.07] shadow-pressed ${thin ? 'h-2' : 'h-3'}`} aria-hidden="true">
      {parts.map((p, i) => p.value > 0 && (
        <div key={i} className={`${p.cls} h-full`} style={{ width: `${(p.value / total) * 100}%` }} />
      ))}
    </div>
  );
};

/** Home's card: what's left and the daily amount; opens the page. */
const LeftToSpendCard: React.FC<{ onNavigate: (screen: AppScreen) => void; className?: string }> = ({ onNavigate, className = '' }) => {
  const { formatWhole } = useWallet();
  const left = useLeftToSpend();
  if (!left) return null;
  const over = left.left < 0;
  const money = formatWhole;
  return (
    <div className={className}>
      <button
        onClick={() => onNavigate(AppScreen.LEFT_TO_SPEND)}
        className="w-full bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] text-left"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">Left to spend · {periodLabel(left)}</span>
          <span className="material-symbols-outlined text-muted-taupe/60 text-[18px]" aria-hidden="true">chevron_right</span>
        </span>
        <span className="flex items-baseline justify-between gap-3 mt-1">
          <span className={`font-serif text-[30px] leading-tight tabular-nums ${over ? 'text-rose' : 'text-premium-charcoal'}`}>
            {over ? `${money(-left.left)} over` : money(left.left)}
          </span>
          {!over && (
            <span className="text-[12px] text-muted-taupe tabular-nums text-right">about {money(left.perDay)} a day</span>
          )}
        </span>
        <span className="block mt-3"><UsageBar left={left} thin /></span>
        {left.behind && (
          <span className="block mt-2 text-[11px] text-muted-taupe">From entries up to {shortDay(left.newest)}</span>
        )}
      </button>
    </div>
  );
};

export default LeftToSpendCard;
