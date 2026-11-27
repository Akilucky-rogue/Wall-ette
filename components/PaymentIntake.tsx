import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { TransactionType, type Transaction } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { planIntake, sharedToCheck, type ToCheck } from '../services/captured';
import { viaName } from '../services/paymentAlerts';
import { acknowledgeNotices, onReaderEvent, pendingNotices, readerSupported, takeSharedText } from '../services/paymentAlertsBridge';
import {
  askFirst, closeToCheck, getInbox, loadInbox, loadSeen, openToCheck, removeToCheck, saveSeen, setToCheck, showAdded, subscribeInbox,
} from '../services/paymentInbox';
import { prettyMerchant } from '../services/analyticsService';
import { useBackHandler } from '../utils/backStack';
import { parseDay } from '../utils/dates';
import { log } from '../utils/log';

const count = (n: number, one: string, many: string) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
const listText = (parts: string[]) =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

/** "Google Pay", "Google Pay and PhonePe": the apps payments came from. */
const appsText = (apps: string[]): string => listText([...new Set(apps)].map(a => viaName(a) ?? 'your apps'));

const REASON: Record<ToCheck['reason'], string> = {
  unsure: "The notification's wording wasn't clear enough to add it by itself.",
  'ask-first': 'Ask me first is on.',
  'maybe-twice': 'The same app sent the same amount moments before. Maybe you paid twice?',
  'in-wallet': 'Something like it is already in your wallet. Check it isn\'t the same payment.',
  shared: 'You shared this. Add it if it\'s a payment you want in your wallet.',
};

const whenText = (w: ToCheck): string => {
  const at = new Date(w.at);
  const day = parseDay(w.entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const time = at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
};

/**
 * Payments from your apps (Android): reads what the phone kept since the
 * last time (services/captured.ts planIntake), adds the sure ones with an
 * Undo, keeps the rest for "Add this?", and takes text shared to
 * Wall-ette. Runs while the app is open and unlocked: on start, and each
 * time a payment notification is kept or text shared. Renders the Undo
 * toast and the "Add this?" sheet.
 */
const PaymentIntake: React.FC = () => {
  const { user } = useAuth();
  const { storedTransactions, walletLoaded, addTransactions } = useWallet();
  const inbox = useSyncExternalStore(subscribeInbox, getInbox);
  const listRef = useRef(storedTransactions);
  listRef.current = storedTransactions;
  const running = useRef(false);
  const again = useRef(false);
  const uid = user?.uid ?? null;

  useEffect(() => { loadInbox(uid); }, [uid]);

  const run = useCallback(async () => {
    if (!uid || !walletLoaded || !readerSupported()) return;
    if (running.current) { again.current = true; return; }
    running.current = true;
    try {
      do {
        again.current = false;
        const notices = await pendingNotices();
        const shared = await takeSharedText();
        const now = Date.now();
        const waiting = getInbox().toCheck;
        const seen = loadSeen(uid);
        const plan = planIntake(notices, listRef.current, waiting, seen, { askFirst: askFirst() });
        const added = plan.add.length > 0 ? addTransactions(plan.add) : 0;
        let note: string | null = null;
        const fromShare = shared ? sharedToCheck(shared, new Date(now)) : null;
        if (shared && !fromShare) note = "The shared text doesn't show a payment Wall-ette can read, so nothing was added.";
        else if (fromShare && listRef.current.some(t => t.id === fromShare.entry.id)) {
          note = 'That payment is already in your wallet.';
        }
        const fresh = [...plan.check, ...(fromShare && !note ? [fromShare] : [])];
        if (fresh.length > 0) setToCheck([...fresh, ...waiting]);
        saveSeen(uid, [...seen, ...plan.seen]);
        await acknowledgeNotices(plan.read);
        if (added > 0) showAdded({ ids: plan.add.map(t => t.id), apps: plan.add.map(t => t.via ?? ''), at: now });
        if (shared) openToCheck(note);
        if (plan.read.length > 0) log.debug(`Payments from apps: read ${plan.read.length}, added ${added}, to check ${plan.check.length}`);
      } while (again.current);
    } catch (e) {
      log.warn('Payments from apps: could not read', e);
    } finally {
      running.current = false;
    }
  }, [uid, walletLoaded, addTransactions]);

  useEffect(() => { void run(); }, [run]);
  useEffect(() => onReaderEvent(() => { void run(); }), [run]);

  return (
    <>
      {inbox.added && <AddedToast />}
      {inbox.open && <ToCheckSheet />}
    </>
  );
};

/** "Added 2 payments from Google Pay" with Undo, for a few seconds. */
const AddedToast: React.FC = () => {
  const { deleteTransactions } = useWallet();
  const { added } = useSyncExternalStore(subscribeInbox, getInbox);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => showAdded(null), 8000);
    return () => clearTimeout(t);
  }, [added]);
  if (!added) return null;
  const undo = () => {
    deleteTransactions(added.ids);
    showAdded(null);
  };
  return (
    <div role="status" className="fixed bottom-[calc(6rem_+_var(--sab))] left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-32px)] max-w-[398px] animate-slide-up">
      <div className="bg-premium-charcoal text-white rounded-3xl shadow-2xl pl-4 pr-2 py-2.5 flex items-center gap-3">
        <span className="material-symbols-outlined text-[20px] text-sage-light shrink-0" aria-hidden="true">bolt</span>
        <p className="flex-1 min-w-0 text-[13px] leading-snug">
          Added {count(added.ids.length, 'payment', 'payments')} from {appsText(added.apps)}
        </p>
        <button onClick={undo} className="shrink-0 px-3 py-2 rounded-2xl text-[13px] font-semibold text-sage-light active:bg-white/10">
          Undo
        </button>
      </div>
    </div>
  );
};

/** "Add this?": each payment waiting for a tap, with Add and Not a payment. */
const ToCheckSheet: React.FC = () => {
  const { formatEntry, addTransactions } = useWallet();
  const { toCheck, note } = useSyncExternalStore(subscribeInbox, getInbox);
  useBackHandler(true, closeToCheck);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeToCheck(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const add = (list: Transaction[]) => {
    addTransactions(list);
    removeToCheck(list.map(t => t.id));
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[100]" onClick={closeToCheck}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="to-check-title"
        className="bg-white w-full max-w-[430px] rounded-t-[32px] md:rounded-[32px] px-6 pt-6 pb-[calc(1.5rem_+_var(--sab))] animate-slide-up max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sage-light flex items-center justify-center">
              <span className="material-symbols-outlined text-sage text-[22px]" aria-hidden="true">bolt</span>
            </div>
            <h3 id="to-check-title" className="text-lg font-display font-bold text-premium-charcoal">
              {toCheck.length === 1 ? 'Add this payment?' : 'Payments to check'}
            </h3>
          </div>
          <button onClick={closeToCheck} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" aria-label="Close">
            <span className="material-symbols-outlined text-muted-taupe" aria-hidden="true">close</span>
          </button>
        </div>

        {note && <p className="mb-3 rounded-2xl bg-zen-cream px-4 py-3 text-[13px] text-premium-charcoal leading-relaxed" role="status">{note}</p>}

        {toCheck.length === 0 ? (
          <p className="text-[13px] text-muted-taupe leading-relaxed">Nothing to check. Payments Wall-ette isn't sure about wait here for you.</p>
        ) : (
          <ul className="space-y-3">
            {toCheck.map(w => {
              const out = w.entry.type === TransactionType.EXPENSE;
              const name = w.entry.merchant ? prettyMerchant(w.entry.merchant) : w.entry.category;
              return (
                <li key={w.entry.id} className="rounded-2xl border border-black/[0.06] px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-premium-charcoal break-words">{name}</p>
                      <p className="text-[12px] text-muted-taupe">{[viaName(w.entry.via), whenText(w), name === w.entry.category ? null : w.entry.category].filter(Boolean).join(' · ')}</p>
                    </div>
                    <p className={`shrink-0 text-[15px] font-semibold tabular-nums ${out ? 'text-premium-charcoal' : 'text-sage'}`}>
                      {out ? '−' : '+'}{formatEntry(w.entry)}
                    </p>
                  </div>
                  <p className="mt-2 text-[12px] text-muted-taupe leading-snug line-clamp-3 break-words">“{w.text}”</p>
                  <p className="mt-1.5 text-[11px] text-muted-taupe leading-snug">{REASON[w.reason]}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => add([w.entry])} className="flex-1 py-2.5 rounded-xl bg-sage text-white text-[13px] font-semibold active:scale-[0.98] transition-transform">
                      Add
                    </button>
                    <button onClick={() => removeToCheck([w.entry.id])} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-premium-charcoal text-[13px] font-semibold active:scale-[0.98] transition-transform">
                      Not a payment
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {toCheck.length > 1 && (
          <button onClick={() => add(toCheck.map(w => w.entry))} className="mt-4 w-full bg-sage text-white py-3.5 rounded-2xl font-semibold shadow-soft active:scale-[0.98] transition-all">
            Add all {toCheck.length}
          </button>
        )}
        <p className="text-center text-[11px] text-muted-taupe mt-3">Processed on this device. Change anything later in Vault.</p>
      </div>
    </div>,
    document.body,
  );
};

export default PaymentIntake;
