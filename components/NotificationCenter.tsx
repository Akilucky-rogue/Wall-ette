import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { getUpdateState, restartToUpdate, subscribe } from '../services/appUpdates';
import { latestNotes, RELEASE_NOTES } from '../services/releaseNotes';
import { recentUnlocks } from '../services/securityLog';
import { openAt } from '../utils/screenSection';
import {
  arrange, buildNotifications, dismiss, emptyState, loadState, markSeen, prune, saveState,
  type AppNotification, type NotificationState, type NotificationTone, type UnlockEvent,
} from '../services/notifications';
import WhatsNewSheet from './WhatsNewSheet';

const TONE: Record<NotificationTone, string> = {
  alert: 'bg-rose-light text-rose',
  // The theme's sand is too faint for a thin glyph on its own tint.
  warn: 'bg-sand-light text-[#A8844F]',
  good: 'bg-sage-light text-sage',
  info: 'bg-ocean-light text-ocean',
};

const RELEASE = {
  versionCode: __APP_BUILD__,
  version: __APP_VERSION__,
  first: RELEASE_NOTES.find(n => n.versionCode === __APP_BUILD__)?.items[0] ?? null,
};

interface NotificationCenterProps {
  onNavigate: (screen: AppScreen) => void;
}

/**
 * The bell on Home and its panel: what needs a look, built on this phone
 * from the wallet (services/notifications.ts). The badge counts the ones not
 * seen yet; closing the panel marks them seen.
 */
const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNavigate }) => {
  const { transactions, counted, budgets, dailyLimit, savingsGoal, formatAmount } = useWallet();
  const uid = useAuth().user?.uid ?? null;
  const update = useSyncExternalStore(subscribe, getUpdateState);

  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [unlocks, setUnlocks] = useState<UnlockEvent[]>([]);
  const [state, setState] = useState<NotificationState>(() => (uid ? loadState(uid) : emptyState()));
  const [notesOpen, setNotesOpen] = useState(false);
  const [place, setPlace] = useState<React.CSSProperties>({});
  const bellRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { setState(uid ? loadState(uid) : emptyState()); }, [uid]);

  // The security log lives in the cloud; read the latest attempts once per
  // visit to Home and again when the panel opens. Offline, nothing changes.
  const readLog = useCallback(() => {
    if (!uid) return;
    recentUnlocks(uid).then(setUnlocks).catch(() => { /* offline, or no log yet */ });
  }, [uid]);
  useEffect(() => { readLog(); }, [readLog]);

  const money = useCallback((n: number) => formatAmount(n).split('.')[0], [formatAmount]);
  const all = useMemo(() => buildNotifications({
    now, transactions, counted, budgets, dailyLimit, savingsGoal, unlocks,
    updateReady: update.phase === 'ready',
    release: RELEASE,
    money,
  }), [now, transactions, counted, budgets, dailyLimit, savingsGoal, unlocks, update.phase, money]);
  const { fresh, earlier } = useMemo(() => arrange(all, state, now.getTime()), [all, state, now]);

  const commit = useCallback((next: NotificationState) => {
    setState(next);
    if (uid) saveState(uid, next);
  }, [uid]);

  const show = () => {
    const r = bellRef.current?.getBoundingClientRect();
    if (r) {
      const top = Math.round(r.bottom + 10);
      // Clear of the bottom of the screen; the navigation bar is under the scrim.
      const maxHeight = `calc(${Math.max(240, window.innerHeight - top - 16)}px - var(--sab))`;
      setPlace(window.innerWidth < 640
        ? { top, left: 16, right: 16, maxHeight }
        : { top, right: Math.max(16, Math.round(window.innerWidth - r.right)), width: 380, maxHeight });
    }
    setNow(new Date());
    readLog();
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    const at = Date.now();
    commit(prune(markSeen(state, fresh.map(n => n.id), at), all.map(n => n.id), at));
    bellRef.current?.focus();
  }, [commit, state, fresh, all]);

  useEffect(() => { if (open) titleRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const act = (n: AppNotification) => {
    close();
    if (n.action.kind === 'screen') {
      if (n.action.section) openAt(n.action.section);
      onNavigate(n.action.screen);
    } else if (n.action.kind === 'restart') {
      void restartToUpdate();
    } else {
      setNotesOpen(true);
    }
  };

  const count = fresh.length;
  const empty = fresh.length === 0 && earlier.length === 0;

  const row = (n: AppNotification) => (
    <li key={n.id} className="relative">
      <button
        type="button"
        onClick={() => act(n)}
        className="w-full flex items-start gap-3 pl-5 pr-12 py-3 text-left hover:bg-zen-cream active:bg-zen-cream transition-colors"
      >
        <span className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${TONE[n.tone]}`}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{n.icon}</span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-premium-charcoal leading-snug">{n.title}</span>
          <span className="block text-[12px] text-muted-taupe leading-snug mt-0.5">{n.body}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => commit(dismiss(state, n.id, Date.now()))}
        className="absolute top-2.5 right-3 w-8 h-8 rounded-full text-muted-taupe/50 hover:text-muted-taupe hover:bg-zen-cream flex items-center justify-center"
        aria-label={`Dismiss: ${n.title}`}
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
      </button>
    </li>
  );

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        onClick={() => (open ? close() : show())}
        aria-label={count > 0 ? `Notifications, ${count} new` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`relative flex items-center justify-center rounded-full h-10 w-10 border border-black/5 transition-colors cursor-pointer ${open ? 'bg-white text-sage shadow-sm' : 'bg-white/50 text-muted-taupe hover:bg-white'}`}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">notifications</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose text-white text-[10px] font-bold leading-[18px] text-center tabular-nums ring-2 ring-zen-bg">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[59] bg-black/20" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-title"
            style={place}
            className="fixed z-[60] flex flex-col bg-white rounded-3xl shadow-2xl border border-black/5 overflow-hidden motion-safe:animate-slide-down"
          >
            <div className="flex items-center justify-between pl-5 pr-3 pt-4 pb-1 shrink-0">
              <h2 id="notifications-title" ref={titleRef} tabIndex={-1} className="font-serif text-[18px] font-semibold text-premium-charcoal outline-none">
                Notifications
              </h2>
              <button type="button" onClick={close} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" aria-label="Close">
                <span className="material-symbols-outlined text-muted-taupe text-[18px]" aria-hidden="true">close</span>
              </button>
            </div>

            {empty ? (
              <div className="px-6 pt-4 pb-7 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-sage-light text-sage flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined" aria-hidden="true">done_all</span>
                </div>
                <p className="font-serif text-[16px] font-semibold text-premium-charcoal">You're all caught up</p>
                <p className="text-[12px] text-muted-taupe leading-relaxed mt-1 max-w-[280px] mx-auto">
                  Budgets running low, bills due soon, bank charges and failed unlock attempts show up here.
                </p>
                {Object.keys(budgets).length === 0 && (
                  <button
                    type="button"
                    onClick={() => { close(); onNavigate(AppScreen.INCOME_INSIGHTS); }}
                    className="mt-4 text-[12px] font-semibold text-sage hover:underline"
                  >
                    Set budgets in Flow
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-y-auto overscroll-contain pb-2">
                {fresh.length > 0 && (
                  <section aria-label="New">
                    <p className="px-5 pt-2 pb-1 text-[12px] font-semibold text-muted-taupe">New</p>
                    <ul>{fresh.map(row)}</ul>
                  </section>
                )}
                {earlier.length > 0 && (
                  <section aria-label="Earlier">
                    <p className="px-5 pt-3 pb-1 text-[12px] font-semibold text-muted-taupe">Earlier</p>
                    <ul>{earlier.map(row)}</ul>
                  </section>
                )}
              </div>
            )}
          </div>
        </>,
        document.body,
      )}

      {notesOpen && <WhatsNewSheet notes={latestNotes(__APP_BUILD__)} onClose={() => setNotesOpen(false)} />}
    </>
  );
};

export default NotificationCenter;
