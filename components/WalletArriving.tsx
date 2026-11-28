import React, { useEffect, useState } from 'react';
import { Mascot } from './ui/Brand';

/**
 * Shown while the wallet is on its way from the cloud (WalletContext's
 * `walletLoaded`): signed in on this device for the first time, or after
 * signing out, which clears this device's copy. A returning user never sees
 * an empty wallet, or "Start your wallet", in the meantime.
 */
const WalletArriving: React.FC<{ isOnline: boolean; className?: string; onRetry?: () => void }> = ({ isOnline, className = '', onRetry }) => {
  // After a while, say why it can take longer.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center text-center ${className}`}>
      <Mascot pose="review" height={128} className="animate-pulse motion-reduce:animate-none" />
      <p className="mt-5 font-display text-lg font-bold text-premium-charcoal">Getting your wallet</p>
      <p className="mt-1 text-muted-taupe text-[13px] max-w-[300px] leading-relaxed">
        {!isOnline
          ? "You're offline. Your entries appear here once you're back online."
          : slow
            ? 'Still bringing your entries from your account. A slow connection takes a little longer.'
            : 'Bringing your entries from your account to this device. Next time, it opens straight away.'}
      </p>
      {isOnline && <div className="mt-5 h-6 w-6 rounded-full border-[3px] border-sage/20 border-t-sage animate-spin" aria-hidden="true" />}
      {isOnline && slow && onRetry && (
        <button onClick={onRetry} className="mt-4 text-[13px] font-semibold text-sage hover:underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
};

export default WalletArriving;
