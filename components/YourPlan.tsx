import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { AppScreen } from '../types';
import { billingSupported, manageSubscription } from '../services/billing';
import { usePlan } from '../services/plan';
import { openPlans } from '../services/planSheet';
import { looksLikeCode, PRICES, showCode, TRIAL_DAYS, type Entitlement } from '../services/planRules';
import { myInviteCode, redeemCode, studentEmailConfirm, studentEmailStart, studentReview } from '../services/spread';
import { SPREAD_URL, SUPPORT_EMAIL } from '../utils/site';
import { Card } from './ui/Paper';
import Garden from './ui/Garden';

const NAME = { essential: 'Essential', plus: 'Plus' } as const;
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

/** One line on where the plan stands. */
function statusLine(e: Entitlement | null): string {
  if (!e?.plan) return e?.state === 'pending' ? 'Google Play is waiting for a payment to go through.' : 'No plan. Your records stay readable, and you can export or delete them any time.';
  const until = day(e.expiresAt);
  const from = e.source === 'gift' ? 'A gift' : e.source === 'student' ? 'Student access' : e.source === 'reward' ? 'A month from a friend\'s invite' : e.source === 'early' ? 'Early-member access' : null;
  if (from) return `${from}${until ? `, until ${until}` : ''}.`;
  if (e.state === 'grace') return 'Google Play is retrying your payment. Your plan stays on meanwhile.';
  if (e.state === 'on-hold') return "Google Play couldn't take your payment. Update your payment method in Google Play to get your plan back.";
  if (e.trial) {
    if (!e.autoRenewing) return `Free month${until ? ` until ${until}` : ''}. You've cancelled, so nothing will be charged.`;
    const price = e.cycle ? `₹${PRICES[e.plan][e.cycle].toLocaleString('en-IN')} a ${e.cycle === 'yearly' ? 'year' : 'month'}` : 'its price';
    return `Free month${until ? ` until ${until}` : ''}. Then Google Play charges ${price} unless you cancel before then.`;
  }
  const pending = e.pendingChange ? ` Moves to ${NAME[e.pendingChange.plan]}${e.pendingChange.cycle ? ` ${e.pendingChange.cycle}` : ''} at that renewal.` : '';
  return e.autoRenewing ? `Renews${until ? ` on ${until}` : ''}.${pending}` : `Ends${until ? ` on ${until}` : ''}; it won't renew.`;
}

const Section: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <Card>
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-2xl bg-sage-light flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined icon-fill text-sage text-[20px]" aria-hidden="true">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-display font-semibold text-premium-charcoal">{title}</h3>
        {children}
      </div>
    </div>
  </Card>
);

const field = 'w-full bg-zen-bg shadow-pressed border-none rounded-xl py-2.5 px-3 text-[14px] text-premium-charcoal outline-none focus:ring-1 focus:ring-sage';
const primary = 'px-4 py-2 rounded-full bg-sage text-white text-[13px] font-semibold shadow-soft disabled:opacity-50';
const secondary = 'px-4 py-2 rounded-full bg-sage-light text-sage text-[13px] font-semibold shadow-soft disabled:opacity-50';

const Note: React.FC<{ text: string | null; bad?: boolean }> = ({ text, bad }) =>
  text ? <p role={bad ? 'alert' : 'status'} className={`mt-2 text-[12px] leading-relaxed ${bad ? 'text-rose' : 'text-sage'}`}>{text}</p> : null;

const Header: React.FC<{ onNavigate: (screen: AppScreen) => void }> = ({ onNavigate }) => (
  <div className="flex items-center gap-2 bg-zen-bg/85 backdrop-blur-md px-5 pt-6 pb-3 sticky top-0 z-30">
    <button
      onClick={() => onNavigate(AppScreen.SELF)}
      className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
      aria-label="Back to Self"
    >
      <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
    </button>
    <h2 className="text-premium-charcoal text-[22px] font-display font-bold tracking-tight leading-tight">Membership</h2>
  </div>
);

const mail = (subject: string, body: string) => {
  window.open(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
};
const BANK_REQUEST = 'Bank:\nStatement format (PDF or Excel):\nCan you share a sample statement with the numbers and names removed? (yes/no)\n';

/** What opens with paid plans, said plainly while they're off. */
const SOON = [
  { icon: 'group_add', title: 'Invite a friend', text: 'Your own code. When a friend joins with it, you each get a month of your plan once their first paid month is done.' },
  { icon: 'redeem', title: 'Codes', text: 'Gift and institution codes. Keep any code you\'re sent: it will still work.' },
  { icon: 'school', title: 'Students', text: 'Essential at no cost until your course ends, for students aged 18 or older.' },
] as const;

/**
 * Self → Membership while paid plans are off (the web app and the app alike):
 * everything is free, what the plans will cost and when, what opens with
 * them, and help, which works now.
 */
const MembershipSoon: React.FC<{ onNavigate: (screen: AppScreen) => void }> = ({ onNavigate }) => (
  <div className="relative flex min-h-page w-full flex-col max-w-[430px] md:max-w-2xl lg:max-w-3xl mx-auto overflow-x-hidden pb-32 lg:pb-12 bg-zen-bg">
    <Garden />
    <Header onNavigate={onNavigate} />
    <div className="px-6 pt-2 space-y-4">
      <Section icon="workspace_premium" title="Free for now">
        <p className="text-[13px] text-muted-taupe leading-relaxed mt-0.5">
          Every part of Wall·ette is open while paid plans are set up, and nothing asks for a card.
          When they start, Essential is ₹{PRICES.essential.monthly} a month and Plus ₹{PRICES.plus.monthly}, and new members get
          their first {TRIAL_DAYS} days at ₹0. We'll tell you before anything changes.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => openPlans()} className={primary}>See the plans</button>
        </div>
      </Section>

      <Section icon="event_upcoming" title="Opens with paid plans">
        <ul className="mt-2 space-y-3">
          {SOON.map(item => (
            <li key={item.title} className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-sage text-[18px] mt-0.5" aria-hidden="true">{item.icon}</span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-premium-charcoal">{item.title}</span>
                <span className="block text-[12px] text-muted-taupe leading-relaxed">{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon="support_agent" title="Help">
        <p className="text-[13px] text-muted-taupe leading-relaxed mt-0.5">Questions, and banks you'd like Wall·ette to read.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => mail('Wall·ette question', '')} className={secondary}>Ask us</button>
          <button onClick={() => mail('Bank request', BANK_REQUEST)} className={secondary}>Ask for your bank</button>
        </div>
      </Section>

      <button onClick={() => onNavigate(AppScreen.EXPORT)} className="w-full text-[12px] text-muted-taupe py-2">
        Export or back up your data: always open, on every plan
      </button>
    </div>
  </div>
);

/**
 * Self → Membership once paid plans are switched on (or previewed in a test
 * build): the plan and what can change it, the member's invite code,
 * redeeming a code, student access, and help, which Plus gets first.
 */
const YourPlan: React.FC<{ onNavigate: (screen: AppScreen) => void }> = ({ onNavigate }) => {
  const { access, entitlement, preview, live } = usePlan();
  const native = billingSupported();
  const plus = access === 'plus';

  // Invite a friend
  const [invite, setInvite] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const showInvite = async () => {
    const r = await myInviteCode();
    if (r.ok) setInvite(r.code);
    else setInviteNote({ text: r.message, bad: true });
  };
  const shareInvite = async () => {
    if (!invite) return;
    const text = `Join me on Wall·ette with my invite code ${showCode(invite)}. Once your first paid month is done, we each get a month of our plan. ${SPREAD_URL}`;
    try {
      if (Capacitor.isNativePlatform()) await Share.share({ text });
      else if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setInviteNote({ text: 'Copied. Paste it to your friend.' }); }
    } catch { /* closed the share sheet */ }
  };

  // Redeem a code
  const [code, setCode] = useState('');
  const [adult, setAdult] = useState(false);
  const [codeNote, setCodeNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const redeem = async () => {
    if (!looksLikeCode(code)) { setCodeNote({ text: 'Codes are letters and numbers, like W7KQ-2M9P.', bad: true }); return; }
    setBusy(true);
    const r = await redeemCode(code, adult);
    setBusy(false);
    if (!r.ok) { setCodeNote({ text: r.message, bad: true }); return; }
    setCode('');
    setCodeNote({ text: r.kind === 'referral' ? (r.message ?? 'Invite code saved.') : `Done: ${NAME[r.plan ?? 'essential']}${r.until ? ` until ${day(r.until)}` : ''}.` });
  };

  // Student access
  const [student, setStudent] = useState<'closed' | 'email' | 'code' | 'review'>('closed');
  const [email, setEmail] = useState('');
  const [courseEnd, setCourseEnd] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [studentNote, setStudentNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const sendStudentCode = async () => {
    setBusy(true);
    const r = await studentEmailStart(email.trim(), courseEnd, adult);
    setBusy(false);
    if (!r.ok) { setStudentNote({ text: r.message, bad: true }); return; }
    setStudent('code');
    setStudentNote({ text: `A code is on its way to ${email.trim()}. It works for ${r.minutes} minutes.` });
  };
  const confirmStudentCode = async () => {
    setBusy(true);
    const r = await studentEmailConfirm(emailCode.trim());
    setBusy(false);
    if (!r.ok) { setStudentNote({ text: r.message, bad: true }); return; }
    setStudent('closed');
    setStudentNote({ text: `Student access: Essential until ${day(r.until)}.` });
  };
  const askReview = async () => {
    setBusy(true);
    const r = await studentReview(institution.trim(), course.trim(), courseEnd, adult);
    setBusy(false);
    if (!r.ok) { setStudentNote({ text: r.message, bad: true }); return; }
    setStudent('closed');
    setStudentNote({ text: "Asked. We'll check and reply by email, usually within a few days." });
  };

  const tag = plus ? '[Plus · priority] ' : '';

  if (!live && !preview) return <MembershipSoon onNavigate={onNavigate} />;

  return (
    <div className="relative flex min-h-page w-full flex-col max-w-[430px] md:max-w-2xl lg:max-w-3xl mx-auto overflow-x-hidden pb-32 lg:pb-12 bg-zen-bg">
      <Garden />
      <Header onNavigate={onNavigate} />

      <div className="px-6 pt-2 space-y-4">
        {preview && (
          <p className="text-[12px] text-sand-ink bg-sand-light/70 rounded-2xl px-4 py-3 leading-relaxed">
            Test build: previewing {preview === 'none' ? 'no plan' : preview.replace(/-/g, ' ')}. Change it in Self → About.
          </p>
        )}

        <Section icon="workspace_premium" title={entitlement?.plan ? `${NAME[entitlement.plan]}${entitlement.cycle ? ` · ${entitlement.cycle}` : ''}` : 'Plans'}>
          <p className="text-[13px] text-muted-taupe leading-relaxed mt-0.5">{statusLine(entitlement)}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => openPlans()} className={primary}>{entitlement?.plan ? 'Change plan' : 'See plans'}</button>
            {native && entitlement?.source === 'play' && !preview && (
              <button onClick={() => { void manageSubscription(); }} className={secondary}>Manage in Google Play</button>
            )}
          </div>
          {entitlement?.source === 'play' && (
            <p className="mt-2.5 text-[11px] text-muted-taupe leading-relaxed">Cancel any time in Google Play before a renewal: the next charge stops, your plan runs to the end of what you've paid, and nothing is deleted.</p>
          )}
        </Section>

        <Section icon="group_add" title="Invite a friend">
          <p className="text-[13px] text-muted-taupe leading-relaxed mt-0.5">
            When a friend joins with your code, you each get a month of your plan once their first paid month is done.
          </p>
          {invite ? (
            <div className="mt-3 flex items-center gap-2">
              <span className="font-mono text-[17px] font-semibold tracking-wider text-premium-charcoal bg-zen-bg shadow-pressed rounded-xl px-3 py-2">{showCode(invite)}</span>
              <button onClick={() => { void shareInvite(); }} className={primary}>Share</button>
            </div>
          ) : (
            <button onClick={() => { void showInvite(); }} className={`${secondary} mt-3`}>Show my code</button>
          )}
          <Note text={inviteNote?.text ?? null} bad={inviteNote?.bad} />
        </Section>

        <Section icon="redeem" title="Have a code?">
          <p className="text-[13px] text-muted-taupe leading-relaxed mt-0.5">A friend's invite code, a gift, or a code from your institution.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setCodeNote(null); }}
              placeholder="W7KQ-2M9P"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className={`${field} font-mono tracking-wider`}
              aria-label="Code"
            />
            <button onClick={() => { void redeem(); }} disabled={busy || !code.trim()} className={primary}>Use</button>
          </div>
          <label className="mt-2.5 flex items-center gap-2 text-[12px] text-muted-taupe">
            <input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} className="accent-sage" />
            I'm 18 or older (needed for student codes)
          </label>
          <Note text={codeNote?.text ?? null} bad={codeNote?.bad} />
        </Section>

        <Section icon="school" title="Students">
          <p className="text-[13px] text-muted-taupe leading-relaxed mt-0.5">
            Aged 18 or older and studying? Essential until your course ends, checked again each year, with no card needed.
          </p>
          {student === 'closed' && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => { setStudent('email'); setStudentNote(null); }} className={secondary}>Use my institution email</button>
              <button onClick={() => { setStudent('review'); setStudentNote(null); }} className={secondary}>Ask for a review</button>
            </div>
          )}
          {(student === 'email' || student === 'review') && (
            <div className="mt-3 space-y-2.5">
              {student === 'email' ? (
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" placeholder="you@college.ac.in" className={field} aria-label="Institution email" />
              ) : (
                <>
                  <input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Institution" className={field} aria-label="Institution" />
                  <input value={course} onChange={e => setCourse(e.target.value)} placeholder="Course" className={field} aria-label="Course" />
                </>
              )}
              <label className="block text-[12px] text-muted-taupe">
                Your course's last day
                <input value={courseEnd} onChange={e => setCourseEnd(e.target.value)} type="date" className={`${field} mt-1`} />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-muted-taupe">
                <input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} className="accent-sage" />
                I'm 18 or older
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => { void (student === 'email' ? sendStudentCode() : askReview()); }}
                  disabled={busy || !adult || !courseEnd || (student === 'email' ? !email.trim() : !institution.trim() || !course.trim())}
                  className={primary}
                >
                  {student === 'email' ? 'Send me a code' : 'Ask'}
                </button>
                <button onClick={() => setStudent('closed')} className={secondary}>Cancel</button>
              </div>
            </div>
          )}
          {student === 'code' && (
            <div className="mt-3 flex gap-2">
              <input value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className={`${field} tracking-widest`} aria-label="Code from the email" />
              <button onClick={() => { void confirmStudentCode(); }} disabled={busy || emailCode.length !== 6} className={primary}>Confirm</button>
            </div>
          )}
          <Note text={studentNote?.text ?? null} bad={studentNote?.bad} />
        </Section>

        <Section icon="support_agent" title={plus ? 'Help, first in line' : 'Help'}>
          <p className="text-[13px] text-muted-taupe leading-relaxed mt-0.5">
            {plus ? 'Plus members\' questions and bank requests are answered first.' : 'Questions, and banks you\'d like Wall·ette to read. Plus members are answered first.'}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => mail(`${tag}Wall·ette question`, '')} className={secondary}>Ask us</button>
            <button
              onClick={() => mail(`${tag}Bank request`, BANK_REQUEST)}
              className={secondary}
            >
              Ask for your bank
            </button>
          </div>
        </Section>

        <button onClick={() => onNavigate(AppScreen.EXPORT)} className="w-full text-[12px] text-muted-taupe py-2">
          Export or back up your data: always open, on every plan
        </button>
      </div>
    </div>
  );
};

export default YourPlan;
