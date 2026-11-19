import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { checkForUpdate, closeBanner, getUpdateState, restartToUpdate, subscribe, updateNow } from '../services/appUpdates';
import { markSeen, notesToShow, readSeenVersion, type ReleaseNote } from '../services/releaseNotes';
import WhatsNewSheet from './WhatsNewSheet';
import { FloatingLeaf, RangoliCorner, WallEEyes } from './SplashScreen';

/** Lets the unlocked screen settle before Google's update dialog can appear. */
const CHECK_DELAY_MS = 1500;

interface AppUpdatesProps {
  /** The user signed in during this run, rather than resuming a saved session. */
  signedInThisRun: boolean;
}

/**
 * Mounted with the main screen, so it runs at start-up and after every
 * unlock: shows "What's new" once after an update, checks Google Play for a
 * newer version (services/appUpdates.ts), and shows the "Restart" banner or
 * the blocking "Time to update" screen when needed. Native only.
 */
const AppUpdates: React.FC<AppUpdatesProps> = ({ signedInThisRun }) => {
  const update = useSyncExternalStore(subscribe, getUpdateState);
  const [notes, setNotes] = useState<ReleaseNote[]>([]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const pending = notesToShow(readSeenVersion(), __APP_BUILD__, signedInThisRun);
    if (pending.length) setNotes(pending);
    else markSeen(__APP_BUILD__);
    const timer = setTimeout(() => { void checkForUpdate(); }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
    // Once per mount: signedInThisRun only matters for the first decision.
  }, []);

  const closeNotes = () => {
    markSeen(__APP_BUILD__);
    setNotes([]);
  };

  if (update.phase === 'required') {
    return (
      <UpdateRequired
        downloaded={update.requiredVia === 'restart'}
        busy={update.busy}
        error={update.error}
        onUpdate={() => { void updateNow(); }}
      />
    );
  }

  return (
    <>
      {(update.phase === 'ready' || update.phase === 'installing') && !update.bannerClosed && (
        <UpdateReadyBanner
          installing={update.phase === 'installing'}
          error={update.error}
          onRestart={() => { void restartToUpdate(); }}
          onClose={closeBanner}
        />
      )}
      {notes.length > 0 && <WhatsNewSheet notes={notes} onClose={closeNotes} />}
    </>
  );
};

interface UpdateReadyBannerProps {
  installing: boolean;
  error: string | null;
  onRestart: () => void;
  onClose: () => void;
}

/** A downloaded update waits for a restart. Sits above the bottom bar, like the install banner. */
export const UpdateReadyBanner: React.FC<UpdateReadyBannerProps> = ({ installing, error, onRestart, onClose }) => (
  <div role="status" className="fixed bottom-[calc(6rem_+_var(--sab))] left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-32px)] max-w-[398px] animate-slide-up">
    <div className="bg-premium-charcoal rounded-3xl shadow-2xl p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-white text-[22px]">system_update</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-[13px] font-semibold leading-tight">Update ready</p>
        <p className={`text-[10px] leading-snug mt-0.5 ${error ? 'text-rose' : 'text-white/55'}`}>
          {error ?? 'Restart Wall-ette to finish installing'}
        </p>
      </div>
      <button
        onClick={onRestart}
        disabled={installing}
        className="bg-sage text-white text-[11px] font-bold uppercase tracking-wider px-3.5 py-2.5 rounded-2xl shrink-0 active:scale-95 transition-transform disabled:opacity-60"
      >
        {installing ? 'Restarting…' : 'Restart'}
      </button>
      <button
        onClick={onClose}
        disabled={installing}
        className="w-7 h-7 rounded-full bg-white/10 text-white/60 flex items-center justify-center shrink-0 hover:bg-white/20"
        aria-label="Not now"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  </div>
);

interface UpdateRequiredProps {
  /** The update has already downloaded; the button restarts to install it. */
  downloaded: boolean;
  busy: boolean;
  error: string | null;
  onUpdate: () => void;
}

/** Covers the whole app until a required update is installed. */
export const UpdateRequired: React.FC<UpdateRequiredProps> = ({ downloaded, busy, error, onUpdate }) => (
  <div
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="update-required-title"
    aria-describedby="update-required-text"
    className="fixed inset-0 z-[200] bg-zen-bg flex justify-center pt-[var(--sat)] pb-[var(--sab)]"
  >
    <div className="relative w-full max-w-[430px] flex flex-col items-center justify-center overflow-hidden px-8 text-center">
      <FloatingLeaf className="top-16 right-8 opacity-40" delay={0} />
      <FloatingLeaf className="bottom-24 left-6 opacity-30" delay={1} color="var(--sage-3)" />
      <RangoliCorner className="absolute top-8 left-4 opacity-25" color="var(--sage-2)" />
      <RangoliCorner className="absolute top-8 right-4 opacity-25" color="var(--sage-2)" mirror />

      <div className="relative inline-flex items-center justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center shadow-lg">
          <WallEEyes size="md" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center border-2 border-sage-light">
          <span className="material-symbols-outlined text-sage text-[16px]">system_update</span>
        </div>
      </div>
      <h1 id="update-required-title" className="text-premium-charcoal font-serif text-2xl font-semibold mb-2">Time to update</h1>
      <p id="update-required-text" className="text-muted-taupe text-[14px] leading-relaxed max-w-[280px] mx-auto mb-8">
        {downloaded
          ? 'This version of Wall-ette is out of date, and the update has downloaded. Restart to finish installing it. Your data stays safe in your account.'
          : 'This version of Wall-ette is out of date. Update it from Google Play to keep going. Your data stays safe in your account.'}
      </p>
      {error && <p className="mb-4 text-rose text-xs font-medium">{error}</p>}
      <button
        onClick={onUpdate}
        disabled={busy}
        className="w-full bg-sage text-white py-4 rounded-2xl font-serif text-lg font-medium shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {downloaded
          ? (busy ? 'Restarting…' : 'Restart to update')
          : (busy ? 'Opening Google Play…' : 'Update now')}
      </button>
    </div>
  </div>
);

export default AppUpdates;
