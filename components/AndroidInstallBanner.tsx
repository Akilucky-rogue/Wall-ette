import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PLAY_LISTING_PUBLIC, PLAY_STORE_URL } from '../utils/site';

/**
 * "Get the Android app" banner — web only, Android browsers only.
 *  - Hidden until the Google Play listing is public (PLAY_LISTING_PUBLIC);
 *    the old self-hosted APK is retired.
 *  - Hidden inside the native app (same bundle runs there).
 *  - Hidden for iOS/desktop visitors (no app for them yet).
 *  - Dismissal is remembered per device. The key changed with the move to
 *    Play, so people who closed the APK banner see this one once.
 */
const DISMISS_KEY = 'playBannerDismissed_v1';

const shouldShow = (): boolean => {
  try {
    if (!PLAY_LISTING_PUBLIC) return false;
    if (Capacitor.isNativePlatform()) return false;
    if (!/android/i.test(navigator.userAgent)) return false;
    if (localStorage.getItem(DISMISS_KEY) === '1') return false;
    return true;
  } catch {
    return false;
  }
};

const AndroidInstallBanner: React.FC = () => {
  const [visible, setVisible] = useState(shouldShow);
  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
  };

  return (
    <div className="fixed bottom-[calc(6rem_+_var(--sab))] left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-32px)] max-w-[398px] animate-slide-up">
      <div className="bg-premium-charcoal rounded-3xl shadow-2xl p-4 flex items-center gap-3">
        {/* Mini Wall-ette mark */}
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center shrink-0">
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3.5 bg-premium-charcoal/90 rounded-[3px] flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-sage-light rounded-full" />
            </div>
            <div className="w-3 h-3.5 bg-premium-charcoal/90 rounded-[3px] flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-sage-light rounded-full" />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white text-[13px] font-semibold leading-tight">Get the Android app</p>
          <p className="text-white/60 text-[10px] leading-tight mt-0.5 truncate">
            Faster · offline · fingerprint unlock
          </p>
        </div>

        <a
          href={PLAY_STORE_URL}
          className="bg-sage text-white text-[11px] font-bold uppercase tracking-wider px-3.5 py-2.5 rounded-2xl shrink-0 active:scale-95 transition-transform"
        >
          Get it
        </a>
        <button
          onClick={dismiss}
          className="w-7 h-7 rounded-full bg-white/10 text-white/60 flex items-center justify-center shrink-0 hover:bg-white/20"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};

export default AndroidInstallBanner;
