/**
 * Codes members type in Self → Your plan (wall-ette.com/spread): a friend's
 * referral code, a gift, or an institution's student code. Pure apart from
 * the random source handed in, so scripts/check-plan-server.mjs can test it.
 *
 * codes/{CODE} holds each one (server only):
 *   referral     { owner } — one per member, reusable by friends
 *   gift         { plan, months, batch } — single use
 *   institution  { institution, courseEnd, batch } — single use, Essential
 */
import { CODE_ALPHABET, DAY_MS, REFERRAL_WINDOW_DAYS, isPlanId, type PlanId } from './plans.js';

export type CodeKind = 'referral' | 'gift' | 'institution';

export interface CodeDoc {
  kind: CodeKind;
  /** referral: the member whose code it is. */
  owner?: string;
  /** gift: the plan and how many months. */
  plan?: PlanId;
  months?: number;
  /** institution: its name, and the course's last day (YYYY-MM-DD). */
  institution?: string;
  courseEnd?: string;
  /** gift and institution codes: who used it, and when. */
  usedBy?: string | null;
  usedAt?: string | null;
  /** The code stops working after this (ISO 8601), if set. */
  expiresAt?: string | null;
  batch?: string;
}

/** "w-7kq2 m9px" → "W7KQ2M9PX". */
export const normalizeCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** A new code of `length` characters; `random(n)` returns an integer in [0, n). */
export function newCode(length: number, random: (n: number) => number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return out;
}

export const REFERRAL_CODE_LENGTH = 8;
export const GIFT_CODE_LENGTH = 12;

export type RedeemRefusal =
  | 'not-found' | 'used' | 'expired' | 'own-code' | 'not-new' | 'already-referred' | 'not-adult' | 'course-ended' | 'malformed';

export interface RedeemContext {
  uid: string;
  now: Date;
  /** When this member's account was created. */
  joinedAt: Date;
  /** A referral code is already on this account. */
  referred: boolean;
  /** This member has paid for a plan before. */
  everPaid: boolean;
  /** They confirmed they're 18 or older (student codes). */
  adult: boolean;
}

/** Whether `code` can be redeemed now; the reason when it can't. */
export function checkRedeem(code: CodeDoc | null, c: RedeemContext): { ok: true } | { ok: false; reason: RedeemRefusal } {
  if (!code) return { ok: false, reason: 'not-found' };
  if (code.expiresAt && Date.parse(code.expiresAt) <= c.now.getTime()) return { ok: false, reason: 'expired' };
  switch (code.kind) {
    case 'referral':
      if (!code.owner) return { ok: false, reason: 'malformed' };
      if (code.owner === c.uid) return { ok: false, reason: 'own-code' };
      if (c.referred) return { ok: false, reason: 'already-referred' };
      // A referral is for new members: joined recently and never paid.
      if (c.everPaid || c.now.getTime() - c.joinedAt.getTime() > REFERRAL_WINDOW_DAYS * DAY_MS) return { ok: false, reason: 'not-new' };
      return { ok: true };
    case 'gift':
      if (!isPlanId(code.plan) || !code.months || code.months < 1) return { ok: false, reason: 'malformed' };
      if (code.usedBy) return { ok: false, reason: 'used' };
      return { ok: true };
    case 'institution': {
      if (!code.courseEnd || !/^\d{4}-\d{2}-\d{2}$/.test(code.courseEnd)) return { ok: false, reason: 'malformed' };
      if (code.usedBy) return { ok: false, reason: 'used' };
      if (!c.adult) return { ok: false, reason: 'not-adult' };
      if (Date.parse(`${code.courseEnd}T23:59:59Z`) <= c.now.getTime()) return { ok: false, reason: 'course-ended' };
      return { ok: true };
    }
    default:
      return { ok: false, reason: 'malformed' };
  }
}

/** What the app says when a code can't be used. */
export const REFUSALS: Readonly<Record<RedeemRefusal, string>> = {
  'not-found': "That code isn't one Wall-ette knows. Check it and try again.",
  used: 'That code has been used already.',
  expired: 'That code has expired.',
  'own-code': "That's your own invite code. Share it with a friend instead.",
  'not-new': 'Invite codes are for new members, within their first 30 days and before their first payment.',
  'already-referred': 'This account already has a friend\'s code.',
  'not-adult': 'Student access is for people aged 18 or older.',
  'course-ended': 'The course this code is for has ended.',
  malformed: "That code can't be used. Ask whoever gave it to you to check it.",
};

/** The last moment of a course day, the end of student access through it. */
export const courseEndsAt = (courseEnd: string): Date => new Date(`${courseEnd}T23:59:59Z`);

/** A course's last day: a real date, in the future, at most six years away. */
export function validCourseEnd(courseEnd: unknown, now: Date): courseEnd is string {
  if (typeof courseEnd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(courseEnd)) return false;
  const t = Date.parse(`${courseEnd}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== courseEnd) return false;
  return t > now.getTime() && t < now.getTime() + 6 * 366 * DAY_MS;
}

/**
 * An institution email address: a domain that only institutions get
 * (.ac.in, .edu.in, .edu, and those in config/students.domains).
 */
export function institutionEmail(email: unknown, extraDomains: readonly string[] = []): email is string {
  if (typeof email !== 'string' || email.length > 254) return false;
  const m = /^[^\s@]+@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(email.trim());
  if (!m) return false;
  const domain = m[1].toLowerCase();
  if (/\.(ac\.in|edu\.in|edu)$/.test(domain)) return true;
  return extraDomains.some(d => domain === d.toLowerCase() || domain.endsWith(`.${d.toLowerCase()}`));
}
