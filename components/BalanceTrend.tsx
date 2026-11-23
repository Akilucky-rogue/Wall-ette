import React, { useMemo, useState } from 'react';
import { TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { parseDay } from '../utils/dates';

interface BalanceTrendProps {
  /** Any day in the last month shown; the chart covers it and the 11 before. */
  endMonth: Date;
  className?: string;
}

/**
 * The balance at the end of each of 12 months, as a line; tap a month for
 * what came in and went out (Flow's Story). Counts every entry, moved money
 * included, as the balance does.
 */
const BalanceTrend: React.FC<BalanceTrendProps> = ({ endMonth, className = '' }) => {
  const { transactions, openingBalance, formatAmount, formatAmountCompact } = useWallet();
  const money = (n: number) => formatAmount(n).split('.')[0];

  // One pass: net flow per month in the window, then a running sum.
  const months = useMemo(() => {
    const endYear = endMonth.getFullYear();
    const endM = endMonth.getMonth();
    const lastKey = endYear * 12 + endM;
    const firstKey = lastKey - 11;
    const inc = new Array(12).fill(0);
    const exp = new Array(12).fill(0);
    let beforeWindow = 0;
    for (const t of transactions) {
      const d = parseDay(t.date);
      const k = d.getFullYear() * 12 + d.getMonth();
      const isIncome = t.type === TransactionType.INCOME;
      if (k < firstKey) beforeWindow += isIncome ? t.amount : -t.amount;
      else if (k <= lastKey) {
        if (isIncome) inc[k - firstKey] += t.amount;
        else exp[k - firstKey] += t.amount;
      }
    }
    let running = openingBalance + beforeWindow;
    return inc.map((_, i) => {
      running += inc[i] - exp[i];
      const d = new Date(endYear, endM - (11 - i), 1);
      return {
        label: d.toLocaleString('en-GB', { month: 'short' }),
        fullLabel: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        value: running,
        income: inc[i],
        expense: exp[i],
        net: inc[i] - exp[i],
      };
    });
  }, [transactions, openingBalance, endMonth]);

  // The newest month with activity, until one is tapped.
  const [picked, setPicked] = useState<number | null>(null);
  const latestActive = useMemo(() => {
    for (let i = months.length - 1; i >= 0; i--) if (months[i].income > 0 || months[i].expense > 0) return i;
    return months.length - 1;
  }, [months]);

  const vals = months.map(m => m.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const mid = (max + min) / 2;
  const range = max - min || 1;
  const w = 100 / (vals.length - 1);
  // y within 8..92% so points never clip at the edges
  const ys = vals.map(v => 92 - ((v - min) / range) * 84);
  const line = ys.map((y, i) => `${i * w},${y}`).join(' ');
  const selIdx = picked ?? latestActive;
  const sel = months[selIdx];
  const quiet = sel.income === 0 && sel.expense === 0;

  return (
    <div className={`bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] ${className}`}>
      <div className="flex justify-between items-baseline mb-3 gap-3">
        <p className="text-[13px] font-semibold text-premium-charcoal">Your balance, 12 months</p>
        <p className="text-[11px] text-muted-taupe">Tap a month</p>
      </div>
      <div className="flex gap-2">
        {/* Balance at the top, middle and bottom gridlines */}
        <div className="relative h-24 w-10 shrink-0" aria-hidden="true">
          <span className="absolute right-0 top-[8%] -translate-y-1/2 text-[9px] text-muted-taupe tabular-nums">{formatAmountCompact(max)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] text-muted-taupe/70 tabular-nums">{formatAmountCompact(mid)}</span>
          <span className="absolute right-0 top-[92%] -translate-y-1/2 text-[9px] text-muted-taupe tabular-nums">{formatAmountCompact(min)}</span>
        </div>
        <div className="relative h-24 flex-1">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
            <defs>
              <linearGradient id="balTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--sage)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--sage)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[8, 50, 92].map(y => (
              <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--line-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
            ))}
            <polygon points={`0,100 ${line} 100,100`} fill="url(#balTrendFill)" />
            <polyline points={line} fill="none" stroke="var(--sage)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Points as HTML so they stay round and get 28px tap targets */}
          {months.map((m, i) => (
            <button
              key={i}
              onClick={() => setPicked(picked === i ? null : i)}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center"
              style={{ left: `${i * w}%`, top: `${ys[i]}%` }}
              aria-label={`${m.fullLabel}: ${money(m.value)}`}
              aria-pressed={i === selIdx}
            >
              <span className={`rounded-full border-2 border-sage transition-all ${i === selIdx ? 'w-3.5 h-3.5 bg-sage shadow-sm' : 'w-2 h-2 bg-white'}`} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-between mt-1 ml-12 mr-1.5" aria-hidden="true">
        {months.filter((_, i) => i % 3 === 0 || i === months.length - 1).map((m, i) => (
          <span key={i} className="text-[10px] text-muted-taupe">{m.label}</span>
        ))}
      </div>
      {/* The month picked */}
      <div className="mt-3 pt-3 border-t border-premium-charcoal/[0.08] flex items-center justify-between gap-2">
        <div className="shrink-0">
          <p className="text-[11px] text-muted-taupe">End of {sel.fullLabel}</p>
          <p className="text-[15px] font-serif font-semibold text-premium-charcoal tabular-nums">{money(sel.value)}</p>
        </div>
        {quiet ? (
          <p className="text-[11px] text-muted-taupe text-right">Nothing came in or went out</p>
        ) : (
          <>
            <div className="text-right text-[11px] font-semibold tabular-nums">
              <p className="text-sage">+{money(sel.income)} in</p>
              <p className="text-rose">−{money(sel.expense)} out</p>
            </div>
            <div className={`text-[12px] font-semibold px-3 py-1.5 rounded-full shrink-0 tabular-nums ${sel.net >= 0 ? 'bg-sage-light text-sage' : 'bg-rose-light text-rose'}`}>
              {sel.net >= 0 ? '+' : '−'}{money(Math.abs(sel.net))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BalanceTrend;
