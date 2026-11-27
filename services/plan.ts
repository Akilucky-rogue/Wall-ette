/**
 * Which plan this member is on, for the screens (docs/PLAN_1.6.0.md).
 *
 * Two inputs: the switch `plansLive` in config/app (off until the
 * production release, and then everything stays open as before; a tester
 * listed in planTesters/{uid} gets plans on early), and entitlements/{uid},
 * which only the server writes (functions/src). The rules are in
 * planRules.ts.
 *
 * Test builds (__QA_BUILD__) can preview a plan without the server:
 * Self → About → Preview a plan, kept on this device only.
 *
 * App.tsx calls watchPlan() when the signed-in user changes; screens use
 * usePlan() and useLimits().
 */
import { useMemo, useSyncExternalStore } from 'react';
import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { log } from '../utils/log';
import {
  accessOf, essentialAccount, historyStart, needsRefresh,
  type Access, type Entitlement, type Limits, type PlanId,
} from './planRules';

export interface PlanState {
  uid: string | null;
  /** config/app.plansLive, or this member is a plan tester. */
  live: boolean;
  entitlement: Entitlement | null;
  /** The entitlement has been read (or failed to). */
  loaded: boolean;
}

let state: PlanState = { uid: null, live: false, entitlement: null, loaded: false };
const subscribers = new Set<() => void>();

function set(patch: Partial<PlanState>): void {
  state = { ...state, ...patch };
  subscribers.forEach(fn => fn());
}

export function subscribePlan(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}
export const getPlanState = (): PlanState => state;

// ── Test builds: preview a plan ──────────────────────────────────────────────

/**
 * What a test build can pretend: paid plans on with no plan, Essential,
 * Essential after Plus, Plus, or Essential's free month 5 days from its end.
 */
export type Preview = 'none' | 'essential' | 'essential-after-plus' | 'plus' | 'free-month';
export const PREVIEWS: readonly Preview[] = ['none', 'essential', 'essential-after-plus', 'plus', 'free-month'];
const PREVIEW_KEY = 'wallette.planPreview';

export function getPreview(): Preview | null {
  if (!__QA_BUILD__) return null;
  try {
    const v = localStorage.getItem(PREVIEW_KEY);
    return (PREVIEWS as readonly string[]).includes(v ?? '') ? (v as Preview) : null;
  } catch {
    return null;
  }
}

export function setPreview(p: Preview | null): void {
  if (!__QA_BUILD__) return;
  try {
    if (p) localStorage.setItem(PREVIEW_KEY, p);
    else localStorage.removeItem(PREVIEW_KEY);
  } catch { /* storage unavailable: nothing to keep */ }
  set({});
}

function previewEntitlement(p: Preview, now: Date): Entitlement {
  const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000).toISOString();
  const plan: PlanId | null = p === 'none' ? null : p === 'plus' ? 'plus' : 'essential';
  return {
    plan,
    cycle: plan ? 'monthly' : null,
    source: plan ? 'play' : null,
    state: plan ? 'active' : 'expired',
    expiresAt: plan ? day(p === 'free-month' ? 5 : 20) : day(-10),
    trial: p === 'free-month',
    autoRenewing: Boolean(plan),
    // Essential after Plus: joined well over a year ago.
    memberSince: plan ? day(p === 'essential-after-plus' ? -500 : p === 'free-month' ? -25 : -40) : null,
    pendingChange: null,
    test: true,
  };
}

// ── Following the member's plan ──────────────────────────────────────────────

let stopWatching: Unsubscribe | null = null;
/** Asked Play/the server once this session already. */
let checkedThisSession = false;

/** Follow the signed-in member's entitlement and the switch. */
export function watchPlan(uid: string | null): void {
  if (uid === state.uid) return;
  stopWatching?.();
  stopWatching = null;
  checkedThisSession = false;
  set({ uid, live: false, entitlement: null, loaded: false });
  if (!uid) return;
  void readSwitch(uid);
  stopWatching = onSnapshot(
    doc(db, 'entitlements', uid),
    snap => {
      set({ entitlement: snap.exists() ? (snap.data() as Entitlement) : null, loaded: true });
      void followUp();
    },
    e => {
      // Rules not deployed yet, or offline: no plan known, which with the
      // switch off changes nothing.
      log.debug('Plan unavailable', e);
      set({ loaded: true });
    },
  );
}

async function readSwitch(uid: string): Promise<void> {
  try {
    const [app, tester] = await Promise.all([
      getDoc(doc(db, 'config', 'app')),
      // Before the rules that allow it are deployed, this is refused: not a tester.
      getDoc(doc(db, 'planTesters', uid)).catch(() => null),
    ]);
    if (state.uid === uid) set({ live: app.get('plansLive') === true || tester?.exists() === true });
    void followUp();
  } catch (e) {
    log.debug('App config unavailable', e);
  }
}

/**
 * Once per session, with paid plans on: if the plan's period has passed,
 * ask the server to read it from Play again; with no plan on Android, send
 * this phone's Play subscriptions through the server (a payment that went
 * through later, or a purchase made before signing in).
 */
async function followUp(): Promise<void> {
  if (checkedThisSession || !state.live || !state.loaded || !state.uid || getPreview()) return;
  checkedThisSession = true;
  try {
    const billing = await import('./billing');
    if (needsRefresh({ live: state.live, entitlement: state.entitlement, now: Date.now() })) {
      await billing.refresh();
    } else if (!state.entitlement?.plan && billing.billingSupported()) {
      await billing.restore();
    }
  } catch (e) {
    log.debug('Plan check skipped', e);
  }
}

/** The server's answer after a purchase, a code or a restore, before the listener catches up. */
export function applyEntitlement(entitlement: Entitlement | null): void {
  if (entitlement) set({ entitlement, loaded: true });
}

export interface PlanView {
  access: Access;
  /** Paid plans are switched on (or previewed). */
  live: boolean;
  entitlement: Entitlement | null;
  /** A test build's preview is showing. */
  preview: Preview | null;
}

export function usePlan(): PlanView {
  const s = useSyncExternalStore(subscribePlan, getPlanState);
  const preview = getPreview();
  if (preview) {
    const entitlement = previewEntitlement(preview, new Date());
    return { access: accessOf({ live: true, entitlement, now: Date.now() }), live: true, entitlement, preview };
  }
  // Until the plan is read, don't lock anything for people who've paid.
  const access = !s.live ? 'open' : !s.loaded ? 'plus' : accessOf({ live: s.live, entitlement: s.entitlement, now: Date.now() });
  return { access, live: s.live, entitlement: s.entitlement, preview: null };
}

/** Today in this device's time zone, YYYY-MM-DD. */
const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Essential's limits for this wallet (planRules.ts editable, takesAccount). */
export function useLimits(accounts: Readonly<Record<string, { asOf: string | null }>>): Limits {
  const { access } = usePlan();
  return useMemo(() => ({ access, from: historyStart(today()), account: essentialAccount(accounts) }), [access, accounts]);
}
