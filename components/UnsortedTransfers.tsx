import React, { useMemo } from 'react';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { suggestPayees } from '../services/spend';

interface UnsortedTransfersProps {
  onNavigate: (screen: AppScreen) => void;
  className?: string;
}

/**
 * Transfers to payees no rule covers count as spending until sorted (audit
 * H3). This says how much, and opens the Money Moved screen to sort them.
 * Renders nothing once every transfer is sorted.
 */
const UnsortedTransfers: React.FC<UnsortedTransfersProps> = ({ onNavigate, className = '' }) => {
  const { transactions, flowOf, formatAmountCompact } = useWallet();
  const unsortedOut = useMemo(
    () => suggestPayees(transactions, flowOf).reduce((s, p) => s + p.out, 0),
    [transactions, flowOf]
  );
  if (unsortedOut <= 0) return null;

  return (
    <div className={className}>
      <button
        onClick={() => onNavigate(AppScreen.MONEY_MOVED)}
        className="w-full flex items-center gap-3 bg-lavender-light rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-transform"
      >
        <span className="material-symbols-outlined text-lavender text-[20px] shrink-0">swap_horiz</span>
        <span className="flex-1 min-w-0 text-[12px] text-premium-charcoal leading-snug">
          <b>{formatAmountCompact(unsortedOut)}</b> of transfers count as spending. Sort the ones to your own accounts, family or investments.
        </span>
        <span className="material-symbols-outlined text-muted-taupe text-[18px] shrink-0">chevron_right</span>
      </button>
    </div>
  );
};

export default UnsortedTransfers;
