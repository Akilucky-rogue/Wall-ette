import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useBackHandler } from '../utils/backStack';
import { billingSupported, buy, loadOffers, restore, type Offer } from '../services/billing';
import { applyEntitlement, setPreview, usePlan } from '../services/plan';
import { closePlans } from '../services/planSheet';
import { changeOf, PRICES, TRIAL_DAYS, yearlySaving, type Cycle, type PlanChange, type PlanId } from '../services/planRules';
import { lockTitle, type LockReason } from './PlanLock';

/** What each plan holds, as wall-ette.com/pricing lists it. */
const HOLDS: Record<PlanId, string[]> = {
  essential: [
    'Statement imports, Vault, Pulse and categories',
    'Transfers, Left to spend, budgets and your savings goal',
    '1 bank account · 12 months of history',
  ],
  plus: [
    'Everything in Essential',
    'Unlimited bank accounts · full history',
    'Flow\'s money story and Rewind',
    'Recurring bills and subscriptions',
    'Priority support and bank requests',
  ],
};
const NAME: Record<PlanId, string> = { essential: 'Essential', plus: 'Plus' };
const per = (c: Cycle) => (c === 'yearly' ? 'a year' : 'a month');
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null);
const today = () => new Date().toISOString().slice(0, 10);

type Status =
  | { kind: 'loading' } | { kind: 'ready' } | { kind: 'web' } | { kind: 'buying' } | { kind: 'restoring' }
  | { kind: 'pending' } | { kind: 'done'; text: string } | { kind: 'error'; text: string };

/**
 * Essential and Plus, monthly or yearly, with Google Play's prices and the
 * free month when Play still offers it to this person. With a plan already,
 * the button and the line under it say exactly what a change does
 * (planRules.ts changeOf): up now, down at the renewal, after the first year.
 */
const PlansSheet: React.FC<{ reason: LockReason | null }> = ({ reason }) => {
  const uid = useAuth().user?.uid ?? null;
  const { entitlement, preview } = usePlan();
  const native = billingSupported();
  const current = entitlement?.plan && entitlement.cycle ? { plan: entitlement.plan, cycle: entitlement.cycle, memberSince: entitlement.memberSince } : null;
  const [cycle, setCycle] = useState<Cycle>(current?.cycle ?? 'yearly');
  const [choice, setChoice] = useState<PlanId>(reason && reason !== 'add' && reason !== 'import' && reason !== 'payments-paused' ? 'plus' : current?.plan ?? 'plus');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [status, setStatus] = useState<Status>(preview ? { kind: 'ready' } : native ? { kind: 'loading' } : { kind: 'web' });

  useBackHandler(true, closePlans);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePlans(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!native || preview) return;
    let gone = false;
    loadOffers()
      .then(found => { if (!gone) { setOffers(found); setStatus(found.length ? { kind: 'ready' } : { kind: 'error', text: 'Google Play has no Wall·ette plans for this phone yet.' }); } })
      .catch(() => { if (!gone) setStatus({ kind: 'error', text: "Couldn't load prices from Google Play. Check your connection and try again." }); });
    return () => { gone = true; };
  }, [native, preview]);

  const offer = offers.find(o => o.plan === choice && o.cycle === cycle);
  const price = (p: PlanId) => offers.find(o => o.plan === p && o.cycle === cycle)?.priceString ?? rupees(PRICES[p][cycle]);
  const change: PlanChange = useMemo(() => changeOf(current, { plan: choice, cycle }, today()), [current, choice, cycle]);
  const trialDays = offer?.trialDays ?? 0;
  const busy = status.kind === 'buying' || status.kind === 'restoring';

  const terms = (): string => {
    const p = `${price(choice)} ${per(cycle)}`;
    switch (change.kind) {
      case 'start': return trialDays > 0
        ? `₹0 for ${trialDays} days, then ${p}. Google Play asks for a payment method; cancel before day ${trialDays + 1} and you pay nothing.`
        : `${p}, renewing until you cancel in Google Play.`;
      case 'same': return entitlement?.autoRenewing ? `Renews on ${day(entitlement.expiresAt) ?? 'its renewal day'}.` : `Ends on ${day(entitlement?.expiresAt) ?? 'its last day'}; it won't renew.`;
      case 'upgrade-now': return 'Plus starts now. Google Play charges the difference for the rest of this period; your renewal day stays the same.';
      case 'switch-now': return `Starts now at ${p}. The unused part of your current period is added on.`;
      case 'at-renewal': return `Starts at your next renewal${entitlement?.expiresAt ? `, on ${day(entitlement.expiresAt)}` : ''}. You keep ${NAME[current?.plan ?? 'plus']} ${current?.cycle === 'yearly' ? 'yearly' : 'monthly'} until then.`;
      case 'not-yet': return `Moving down to Essential opens after your first year, on ${day(change.opensOn) ?? 'its anniversary'}. Nothing is deleted when you do.`;
    }
  };
  const label = (): string => {
    if (status.kind === 'buying') return 'Opening Google Play…';
    switch (change.kind) {
      case 'start': return trialDays > 0 ? `Start ${trialDays} days at ₹0` : `Choose ${NAME[choice]}`;
      case 'same': return 'Your plan';
      case 'upgrade-now': return 'Move up to Plus now';
      case 'switch-now': return cycle === 'yearly' && current?.cycle === 'monthly' && choice === current?.plan ? 'Switch to yearly now' : `Switch to ${NAME[choice]} now`;
      case 'at-renewal': return 'Switch at renewal';
      case 'not-yet': return `Opens on ${day(change.opensOn) ?? 'your anniversary'}`;
    }
  };
  const disabled = busy || change.kind === 'same' || change.kind === 'not-yet' || (!preview && (!native || !offer || !uid));

  const choose = async () => {
    if (disabled) return;
    if (preview) {
      // Test builds: the preview follows the choice; nothing is bought.
      setPreview(choice === 'plus' ? 'plus' : current?.plan === 'plus' ? 'essential-after-plus' : 'essential');
      setStatus({ kind: 'done', text: `Preview: you're on ${NAME[choice]}. Nothing was bought.` });
      return;
    }
    if (!offer || !uid) return;
    setStatus({ kind: 'buying' });
    const result = await buy(offer, uid, entitlement);
    if (result.kind === 'done') {
      applyEntitlement(result.entitlement);
      setStatus({ kind: 'done', text: change.kind === 'at-renewal' ? `Done. ${NAME[choice]} ${cycle} starts at your next renewal.` : `You're on ${NAME[result.entitlement.plan ?? choice]}.` });
    } else if (result.kind === 'cancelled') setStatus({ kind: 'ready' });
    else if (result.kind === 'pending') setStatus({ kind: 'pending' });
    else if (result.kind === 'elsewhere') setStatus({ kind: 'error', text: "Your subscription is on another Google account. Change it in Google Play on that account, or sign this phone's Play Store into it." });
    else if (result.kind === 'unverified') setStatus({ kind: 'error', text: "Google Play took the purchase, but Wall·ette couldn't confirm it yet. Tap Restore purchases in a moment. If it isn't confirmed within 3 days, Google Play cancels it and refunds any payment." });
    else setStatus({ kind: 'error', text: "Google Play didn't complete it, and nothing was charged. Try again." });
  };

  const restorePurchases = async () => {
    if (busy) return;
    setStatus({ kind: 'restoring' });
    try {
      const found = await restore();
      applyEntitlement(found);
      setStatus(found?.plan ? { kind: 'done', text: `Restored: you're on ${NAME[found.plan]}.` } : { kind: 'error', text: 'No Wall·ette plan was found for the Google account on this phone.' });
    } catch {
      setStatus({ kind: 'error', text: "Couldn't reach Google Play. Check your connection and try again." });
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[110]" onClick={closePlans}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plans-title"
        className="bg-white w-full max-w-[460px] rounded-t-[32px] md:rounded-[32px] px-6 pt-6 pb-[calc(1.5rem_+_var(--sab))] animate-slide-up max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 id="plans-title" className="text-lg font-display font-bold text-premium-charcoal">Plans</h3>
            {reason && <p className="text-[13px] text-muted-taupe mt-0.5">{lockTitle(reason)}.</p>}
          </div>
          <button onClick={closePlans} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0" aria-label="Close">
            <span className="material-symbols-outlined text-muted-taupe" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="flex rounded-2xl bg-zen-bg p-1 shadow-pressed mb-4" role="radiogroup" aria-label="Billing period">
          {(['monthly', 'yearly'] as const).map(c => (
            <button
              key={c}
              role="radio"
              aria-checked={cycle === c}
              onClick={() => setCycle(c)}
              className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-colors ${cycle === c ? 'bg-white shadow-soft text-premium-charcoal' : 'text-muted-taupe'}`}
            >
              {c === 'monthly' ? 'Monthly' : `Yearly · save ${yearlySaving('plus')}%`}
            </button>
          ))}
        </div>

        <div className="space-y-3" role="radiogroup" aria-label="Plan">
          {(['essential', 'plus'] as const).map(p => {
            const mine = current?.plan === p;
            const picked = choice === p;
            return (
              <button
                key={p}
                role="radio"
                aria-checked={picked}
                onClick={() => setChoice(p)}
                className={`w-full text-left rounded-2xl border px-4 py-3.5 transition-all ${picked ? 'border-sage ring-2 ring-sage/30 bg-sage-light/30' : 'border-black/[0.08]'}`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-display font-bold text-premium-charcoal">
                    {NAME[p]}
                    {mine && <span className="ml-2 align-middle text-[10px] font-sans font-semibold uppercase tracking-wider text-sage bg-sage-light rounded-full px-2 py-0.5">Your plan</span>}
                  </span>
                  <span className="text-[14px] font-semibold text-premium-charcoal tabular-nums shrink-0">{price(p)} <span className="text-[11px] font-normal text-muted-taupe">{per(cycle)}</span></span>
                </span>
                <ul className="mt-2 space-y-1">
                  {HOLDS[p].map(h => (
                    <li key={h} className="flex items-start gap-2 text-[12px] text-muted-taupe leading-snug">
                      <span className="material-symbols-outlined text-sage text-[15px] mt-px" aria-hidden="true">check</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {status.kind === 'web' ? (
          <p className="mt-4 text-[13px] text-premium-charcoal leading-relaxed bg-sage-light/60 rounded-2xl p-4">
            Choose a plan in the Wall·ette Android app. Paying here on the web opens soon; your plan works in both once chosen.
          </p>
        ) : (
          <>
            <button
              onClick={() => { void choose(); }}
              disabled={disabled}
              className="mt-4 w-full bg-sage text-white py-3.5 rounded-2xl font-semibold shadow-soft active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {status.kind === 'loading' ? 'Loading prices from Google Play…' : label()}
            </button>
            <p className="mt-2 text-[12px] text-muted-taupe leading-relaxed text-center">{terms()}</p>
          </>
        )}

        {status.kind === 'pending' && <p role="status" className="mt-3 text-[13px] text-premium-charcoal bg-sand-light/70 rounded-2xl p-3">Google Play is waiting for the payment to go through. Your plan opens as soon as it does.</p>}
        {status.kind === 'done' && <p role="status" className="mt-3 text-[13px] text-sage font-semibold text-center">{status.text}</p>}
        {status.kind === 'error' && <p role="alert" className="mt-3 text-[13px] text-rose bg-rose-light/40 rounded-2xl p-3 leading-relaxed">{status.text}</p>}

        {native && !preview && (
          <button onClick={() => { void restorePurchases(); }} disabled={busy} className="mt-3 w-full text-[13px] font-semibold text-sage py-2 disabled:opacity-50">
            {status.kind === 'restoring' ? 'Checking Google Play…' : 'Restore purchases'}
          </button>
        )}
        <p className="mt-2 text-[11px] text-muted-taupe text-center leading-relaxed">
          New members get {TRIAL_DAYS} days at ₹0 on either plan. Moving down never deletes anything, and export and deletion stay open on every plan and after one ends.
        </p>
      </div>
    </div>,
    document.body,
  );
};

export default PlansSheet;
