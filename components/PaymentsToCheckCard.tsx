import React, { useSyncExternalStore } from 'react';
import { getInbox, openToCheck, subscribeInbox } from '../services/paymentInbox';

/**
 * Home: payments read from your apps that wait for a tap, and the way to
 * them (the "Add this?" sheet, components/PaymentIntake.tsx). Renders
 * nothing when none wait.
 */
const PaymentsToCheckCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { toCheck } = useSyncExternalStore(subscribeInbox, getInbox);
  if (toCheck.length === 0) return null;
  const n = toCheck.length;
  return (
    <div className={className}>
      <button
        onClick={() => openToCheck()}
        className="w-full flex items-center gap-3 bg-ocean-light rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-transform"
      >
        <span className="material-symbols-outlined text-ocean text-[20px] shrink-0" aria-hidden="true">bolt</span>
        <span className="flex-1 min-w-0 text-[12px] text-premium-charcoal leading-snug">
          <b>{n} {n === 1 ? 'payment' : 'payments'}</b> from your apps {n === 1 ? 'waits' : 'wait'} for you to check before {n === 1 ? "it's" : "they're"} added.
        </span>
        <span className="material-symbols-outlined text-muted-taupe text-[18px] shrink-0" aria-hidden="true">chevron_right</span>
      </button>
    </div>
  );
};

export default PaymentsToCheckCard;
