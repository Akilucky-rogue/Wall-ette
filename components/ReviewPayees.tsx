import React, { useMemo, useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { REVIEW_CHOICES, reviewPayees, type ReviewChoice } from '../services/review';
import { parseDay } from '../utils/dates';
import { tick } from '../utils/haptics';

interface ReviewPayeesProps {
  /** Only payees with a payment among these ids: the rows an import just added. */
  onlyIds?: ReadonlySet<string>;
  /** How many to show before "Show more". */
  first?: number;
  className?: string;
}

/**
 * Payments still to review (services/review.ts), one card per payee, largest
 * first: what each payee was, with Wall-ette's guess from the name marked.
 * A tap saves a Money moved rule, so every payment to that payee, past and
 * future, reads the same; the card then leaves the list.
 */
const ReviewPayees: React.FC<ReviewPayeesProps> = ({ onlyIds, first = 6, className = '' }) => {
  const { transactions, flowOf, savePayeeRule, formatAmountCompact } = useWallet();
  const [showAll, setShowAll] = useState(false);
  const [sorted, setSorted] = useState<{ name: string; label: string } | null>(null);
  const payees = useMemo(() => reviewPayees(transactions, flowOf, onlyIds), [transactions, flowOf, onlyIds]);
  const shown = showAll ? payees : payees.slice(0, first);
  const dayLabel = (day: string) => parseDay(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const choose = (name: string, choice: ReviewChoice) => {
    tick();
    savePayeeRule(name, choice.kind, choice.category);
    setSorted({ name, label: choice.label });
  };

  return (
    <div className={className}>
      {sorted && (
        <p className="mb-3 px-1 text-[12px] text-muted-taupe" role="status">
          Saved: payments to <span className="font-semibold text-premium-charcoal">{sorted.name}</span> are {sorted.label.toLowerCase()}. Change it any time in Money moved.
        </p>
      )}
      {payees.length === 0 ? (
        <p className="px-1 text-[13px] text-muted-taupe">Nothing left to review.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map(p => (
            <li key={p.match} className="bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-premium-charcoal font-semibold text-[15px] truncate" title={p.name}>{p.name}</p>
                <p className="text-premium-charcoal text-[13px] font-semibold tabular-nums shrink-0">{formatAmountCompact(p.out)} out</p>
              </div>
              <p className="text-muted-taupe text-[11px] mt-0.5">
                {p.count} {p.count === 1 ? 'payment' : 'payments'} · last {dayLabel(p.last)}
                {p.in > 0 && <> · {formatAmountCompact(p.in)} came back</>}
              </p>
              <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label={`What were the payments to ${p.name}?`}>
                {REVIEW_CHOICES.map(choice => {
                  const suggested = p.suggestion === choice.id;
                  return (
                    <button
                      key={choice.id}
                      onClick={() => choose(p.name, choice)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-transform active:scale-95 ${
                        suggested
                          ? 'bg-sage text-white shadow-soft'
                          : 'bg-zen-cream text-premium-charcoal border border-premium-charcoal/[0.08] hover:border-sage/40'
                      }`}
                      aria-describedby={suggested ? `suggested-${p.match.replace(/\s+/g, '-')}` : undefined}
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{choice.icon}</span>
                      {choice.label}
                    </button>
                  );
                })}
              </div>
              {p.suggestion && (
                <p id={`suggested-${p.match.replace(/\s+/g, '-')}`} className="mt-2 text-[11px] text-muted-taupe">
                  Wall-ette's guess from the name is highlighted. Nothing changes until you tap.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {payees.length > first && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full mt-3 text-[11px] font-semibold text-sage uppercase tracking-wider py-2"
        >
          {showAll ? 'Show fewer' : `Show ${payees.length - first} more`}
        </button>
      )}
    </div>
  );
};

export default ReviewPayees;
