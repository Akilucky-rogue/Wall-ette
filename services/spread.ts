/**
 * Spread in the app (wall-ette.com/spread): a member's invite code,
 * redeeming a code (a friend's invite, a gift, an institution's student
 * code), and student access by institution email or review. The server
 * (functions/src/index.ts) decides everything; its refusals are written for
 * people and shown as they are.
 */
import { callFunction } from './billing';
import { applyEntitlement } from './plan';
import type { Entitlement, PlanId } from './planRules';

const messageOf = (e: unknown): string => {
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  const m = e instanceof Error ? e.message : String(e);
  // Offline, or the functions aren't deployed yet: Firebase's own words, not the server's.
  const bare = /^(internal|unavailable|not-found|not_found|deadline-exceeded)$/i.test(m.trim());
  if (bare || /failed to fetch|network/i.test(m) || code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
    return "Couldn't reach Wall-ette just now. Check your connection and try again.";
  }
  return m;
};

export type Outcome<T = object> = ({ ok: true } & T) | { ok: false; message: string };

async function call<T extends object>(name: string, data?: unknown): Promise<Outcome<T>> {
  try {
    const r = await callFunction<({ ok?: boolean; message?: string; summary?: Entitlement } & T)>(name, data);
    if (r && r.ok === false) return { ok: false, message: r.message ?? 'That didn\'t work.' };
    if (r?.summary) applyEntitlement(r.summary);
    return { ok: true, ...r } as Outcome<T>;
  } catch (e) {
    return { ok: false, message: messageOf(e) };
  }
}

/** The member's own invite code, made the first time. */
export const myInviteCode = () => call<{ code: string }>('myInviteCode');

export interface Redeemed {
  kind: 'referral' | 'gift' | 'institution';
  message?: string;
  plan?: PlanId;
  /** When the plan from a gift or student code ends, ISO 8601. */
  until?: string;
}
/** A friend's invite code, a gift code or a student code. `adult`: they confirmed they're 18 or older. */
export const redeemCode = (code: string, adult: boolean) => call<Redeemed>('redeemCode', { code, adult });

/** Sends a 6-digit code to an institution email address. */
export const studentEmailStart = (email: string, courseEnd: string, adult: boolean) =>
  call<{ sent: boolean; minutes: number }>('studentEmailStart', { email, courseEnd, adult });

/** The code from that email: student access when it matches. */
export const studentEmailConfirm = (code: string) => call<{ plan: PlanId; until: string }>('studentEmailConfirm', { code });

/** Asks for student access to be checked by a person. */
export const studentReview = (institution: string, course: string, courseEnd: string, adult: boolean) =>
  call<object>('studentReview', { institution, course, courseEnd, adult });
