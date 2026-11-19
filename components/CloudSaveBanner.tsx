import React, { useSyncExternalStore } from 'react';
import { dismissUnsaved, getUnsaved, retryUnsaved, subscribeUnsaved } from '../services/cloudSaves';
import { useWallet } from '../context/WalletContext';

/**
 * Shown on every screen when the cloud refused changes (audit M4): how many,
 * what happened to them, and Try again. Firestore has already undone them on
 * this phone, unless the wallet is showing this phone's own copy. Sits at the
 * top, clear of the update banner and the toasts above the bottom bar.
 */
const CloudSaveBanner: React.FC = () => {
  const unsaved = useSyncExternalStore(subscribeUnsaved, getUnsaved);
  const { isCloudSyncing } = useWallet();
  if (unsaved.count === 0) return null;

  const n = unsaved.count;
  const one = n === 1;
  const detail = unsaved.code === 'resource-exhausted'
    ? "Today's cloud limit is used up. Try again later."
    : isCloudSyncing
      ? `Your account didn't accept ${one ? 'it, so it was' : 'them, so they were'} undone on this phone.`
      : `Your account didn't accept ${one ? "it. It's" : "them. They're"} on this phone only for now.`;

  return (
    <div className="fixed inset-x-0 top-[calc(var(--sat)_+_12px)] z-[70] flex justify-center px-4 pointer-events-none">
      <div
        role="alert"
        className="pointer-events-auto w-full max-w-[398px] bg-premium-charcoal rounded-3xl shadow-2xl p-4 flex items-center gap-3 motion-safe:animate-slide-down"
      >
        <div className="w-11 h-11 rounded-2xl bg-rose flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white text-[22px]">cloud_off</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[13px] font-semibold leading-tight">
            {n} change{n === 1 ? '' : 's'} didn't save
          </p>
          <p className="text-white/60 text-[10px] leading-snug mt-0.5">{detail}</p>
        </div>
        <button
          onClick={retryUnsaved}
          disabled={unsaved.retrying}
          className="bg-sage text-white text-[11px] font-bold uppercase tracking-wider px-3.5 py-2.5 rounded-2xl shrink-0 active:scale-95 transition-transform disabled:opacity-60"
        >
          {unsaved.retrying ? 'Sending…' : 'Try again'}
        </button>
        <button
          onClick={dismissUnsaved}
          className="w-7 h-7 rounded-full bg-white/10 text-white/60 flex items-center justify-center shrink-0 hover:bg-white/20"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};

export default CloudSaveBanner;
