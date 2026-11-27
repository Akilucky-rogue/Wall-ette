import React, { useMemo } from 'react';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { toReviewTotal } from '../services/review';

interface UnsortedTransfersProps {
  onNavigate: (screen: AppScreen) => void;
  className?: string;
}

/**
 * Transfers to payees no rule covers read "To review" and count as spending
 * until sorted (audit H3; services/review.ts). This says how much, and opens
 * Money moved, where each payee is reviewed. Renders nothing once every
 * transfer is sorted.
 */
const UnsortedTransfers: React.FC<UnsortedTransfersProps> = ({ onNavigate, className = '' }) => {
  const { transactions, formatAmountCompact } = useWallet();
  // Every payment out still under "To review" (the list shows each under the category it reads as).
  const unsortedOut = useMemo(() => toReviewTotal(transactions).amount, [transactions]);
  if (unsortedOut <= 0) return null;

  return (
    <div className={className}>
      <button
        onClick={() => onNavigate(AppScreen.MONEY_MOVED)}
        className="w-full flex items-center gap-3 bg-lavender-light rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-transform"
      >
        <span className="material-symbols-outlined text-lavender text-[20px] shrink-0">swap_horiz</span>
        <span className="flex-1 min-w-0 text-[12px] text-premium-charcoal leading-snug">
          <b>{formatAmountCompact(unsortedOut)}</b> of payments are still to review. Say which were investments, rent, family or your own accounts.
        </span>
        <span className="material-symbols-outlined text-muted-taupe text-[18px] shrink-0">chevron_right</span>
      </button>
    </div>
  );
};

export default UnsortedTransfers;
