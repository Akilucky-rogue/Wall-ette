import React from 'react';
import StatementDemo from './landing/StatementDemo';
import { WallEEyes, RangoliCorner } from './SplashScreen';
import { PLAY_LISTING_PUBLIC, PLAY_STORE_URL, PRIVACY_URL, TERMS_URL } from '../utils/site';

/**
 * wall-ette.com for visitors who aren't signed in (web only; App.tsx).
 * "Open the web app" and "Sign in" lead to the existing sign-in screen.
 * Screenshots in public/landing/ show the Play reviewer account's sample data.
 */
interface LandingProps {
  onOpenApp: () => void;
}

const CONTACT_EMAIL = 'akshatbvora@gmail.com';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sage-deep)]';

const Mark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-sage to-sage/80 ${className}`} aria-hidden="true">
    <WallEEyes size="sm" />
  </span>
);

const Wordmark: React.FC = () => (
  <span className="font-serif text-[26px] font-semibold tracking-tight text-premium-charcoal">
    Wall<span className="text-sage">·</span>ette
  </span>
);

const PrimaryButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center justify-center rounded-full bg-premium-charcoal px-6 py-3.5 text-[15px] font-semibold text-zen-bg shadow-[0_10px_24px_-12px_rgba(40,40,40,0.6)] transition-transform active:scale-[0.98] ${focusRing}`}
  >
    {children}
  </button>
);

const PlayButton: React.FC = () =>
  PLAY_LISTING_PUBLIC ? (
    <a
      href={PLAY_STORE_URL}
      className={`inline-flex items-center justify-center rounded-full border border-sage-border bg-white px-6 py-3.5 text-[15px] font-semibold text-premium-charcoal transition-colors hover:border-sage ${focusRing}`}
    >
      Get it on Google Play
    </a>
  ) : (
    <span
      aria-disabled="true"
      className="inline-flex items-center justify-center rounded-full border border-dashed border-sage-border px-6 py-3.5 text-[15px] font-medium text-zen-charcoal/80"
    >
      Coming soon to Google Play
    </span>
  );

const Phone: React.FC<{ src: string; alt: string; className?: string; eager?: boolean }> = ({ src, alt, className = '', eager }) => (
  <div className={`rounded-[2.4rem] bg-premium-charcoal/90 p-[7px] shadow-[0_40px_70px_-35px_rgba(50,60,45,0.55)] ${className}`}>
    <img
      src={src}
      alt={alt}
      width={640}
      height={1138}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className="block h-auto w-full rounded-[2rem] bg-zen-bg"
    />
  </div>
);

const STEPS = [
  {
    title: 'Download your statement',
    text: 'From your bank’s app or net banking, as a PDF or an Excel file.',
  },
  {
    title: 'Import it',
    text: 'Wall·ette reads the file on your phone and shows whether your balance will match the statement before anything is saved.',
  },
  {
    title: 'Sort your transfers once',
    text: 'Tell it which payees are your own accounts or family. Every total after that counts only real spending.',
  },
];

const PRIVACY_POINTS = [
  'Your statement file never leaves your phone. Only the transactions are saved, to your own account.',
  'Each account is walled off by the database rules, so only you can read your data.',
  'Insights are worked out on your phone. None of your money data goes to an AI service or an analytics company.',
  'No ads, and your data is never sold.',
  'Delete your account and everything in it from Profile, whenever you like.',
];

const FAQS = [
  {
    q: 'Which banks does it work with?',
    a: 'Wall·ette knows the statements of IDFC FIRST, HDFC, SBI, Kotak, Union Bank and Saraswat Bank, and checks every line against the running balance. Statements from other banks go through a general importer that follows the running balance. It handles many banks, but it isn’t checked as closely.',
  },
  {
    q: 'Do I give Wall·ette my bank login?',
    a: 'No. Wall·ette never connects to your bank. You download your statement yourself and import the file.',
  },
  {
    q: 'Is it free?',
    a: 'Yes, Wall·ette is free to use, with no ads.',
  },
  {
    q: 'Does it work offline?',
    a: 'Yes. Your wallet is kept on your phone, and changes sync to your account when you’re back online.',
  },
  {
    q: 'Is there an iPhone app?',
    a: 'Not yet. On an iPhone, use the web app here at wall-ette.com with the same account.',
  },
  {
    q: 'How do I delete my data?',
    a: `In the app, open Profile and choose Delete account & all data. Your transactions, settings, security log and account are erased at once. You can also email ${CONTACT_EMAIL}.`,
  },
];

const Landing: React.FC<LandingProps> = ({ onOpenApp }) => (
  <div className="wl-landing min-h-screen bg-zen-bg font-sans text-premium-charcoal antialiased">
    <style>{`
      .wl-landing { scroll-behavior: smooth; }
      @media (prefers-reduced-motion: no-preference) {
        .wl-demo .wl-read { animation: wl-read 560ms cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(450ms + var(--i) * 260ms); }
        .wl-demo .wl-sum { animation: wl-fade 700ms ease-out both; animation-delay: 1900ms; }
      }
      @media (prefers-reduced-motion: reduce) { .wl-landing { scroll-behavior: auto; } }
      @keyframes wl-read { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      @keyframes wl-fade { from { opacity: 0; } to { opacity: 1; } }
      .wl-faq summary::-webkit-details-marker { display: none; }
      .wl-faq details[open] .wl-plus { transform: rotate(45deg); }
    `}</style>

    {/* Header */}
    <header className="sticky top-0 z-40 border-b border-sage-border/70 bg-zen-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1160px] items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
        <a href="#top" className={`flex items-center gap-2.5 rounded-full ${focusRing}`} aria-label="Wall·ette home">
          <Mark className="h-10 w-10" />
          <Wordmark />
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-7 text-[14.5px] text-zen-charcoal md:flex">
          <a href="#how" className={`rounded hover:text-premium-charcoal ${focusRing}`}>How it works</a>
          <a href="#features" className={`rounded hover:text-premium-charcoal ${focusRing}`}>Features</a>
          <a href="#privacy" className={`rounded hover:text-premium-charcoal ${focusRing}`}>Privacy</a>
          <a href="#faq" className={`rounded hover:text-premium-charcoal ${focusRing}`}>FAQ</a>
        </nav>
        <button
          type="button"
          onClick={onOpenApp}
          className={`rounded-full border border-sage-border bg-white px-5 py-2 text-[14.5px] font-semibold text-premium-charcoal transition-colors hover:border-sage ${focusRing}`}
        >
          Sign in
        </button>
      </div>
    </header>

    <main id="top">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <RangoliCorner className="pointer-events-none absolute -right-6 top-6 hidden h-40 w-40 opacity-20 lg:block" color="var(--sage-2)" mirror />
        <div className="mx-auto grid max-w-[1160px] grid-cols-[minmax(0,1fr)] items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-14 lg:pb-28 lg:pt-20">
          <div className="min-w-0">
            <h1 className="font-serif text-[44px] font-medium leading-[1.02] tracking-[-0.015em] text-premium-charcoal sm:text-[58px] lg:text-[66px]">
              Your bank statement, made readable.
            </h1>
            <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-zen-charcoal sm:text-[18px]">
              Import a bank statement and Wall·ette sorts every line into spending, income and money you only
              moved between your own accounts. The file is read on your phone and never uploaded.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <PrimaryButton onClick={onOpenApp}>Open the web app</PrimaryButton>
              <PlayButton />
            </div>
            <p className="mt-5 text-[14px] text-zen-charcoal/80">Free, with no ads. Your data stays in your account.</p>
          </div>
          <StatementDemo />
        </div>
      </section>

      {/* Facts */}
      <section aria-label="Why you can trust the numbers" className="border-y border-sage-border bg-white/60">
        <div className="mx-auto grid max-w-[1160px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-sage-border">
          {[
            ['Checked against 17 real statements', 'Every one matches the bank’s own totals, to the paisa.'],
            ['Read on your phone', 'Statement files are opened on the device and never uploaded anywhere.'],
            ['No ads, no AI', 'No advertiser or AI service ever sees your money. Crash reports carry none of it, and you can turn them off.'],
          ].map(([title, text]) => (
            <div key={title} className="md:px-8 first:md:pl-0 last:md:pr-0">
              <p className="font-serif text-[22px] leading-snug text-premium-charcoal">{title}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-zen-charcoal/80">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20">
        <div className="mx-auto max-w-[1160px] px-5 py-20 sm:px-8 lg:py-28">
          <h2 className="font-serif text-[36px] font-medium leading-tight tracking-[-0.01em] sm:text-[44px]">Three steps, once a month</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative md:pr-6">
                <span className="font-serif text-[64px] leading-none text-sage" aria-hidden="true">{i + 1}</span>
                <h3 className="mt-3 text-[18px] font-semibold text-premium-charcoal">{s.title}</h3>
                <p className="mt-2 max-w-[22rem] text-[15.5px] leading-relaxed text-zen-charcoal">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* The app */}
      <section aria-labelledby="calm" className="overflow-hidden bg-sage-light/70">
        <div className="mx-auto max-w-[1160px] px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-[40rem]">
            <h2 id="calm" className="font-serif text-[36px] font-medium leading-tight tracking-[-0.01em] sm:text-[44px]">Everything in one calm place</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-zen-charcoal">
              The same wallet on your phone and on the web, synced through your account.
            </p>
          </div>
          <div className="-mx-5 mt-14 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-4 sm:mx-0 sm:px-0 md:grid md:grid-cols-3 md:items-end md:gap-10 md:overflow-visible">
            {[
              { src: '/landing/pulse.webp', alt: 'Pulse screen with sample data: ₹59,594 spent this month, 21% less than October', caption: 'Pulse: this month’s spending, against last month' },
              { src: '/landing/home.webp', alt: 'Home screen with sample data: a balance of ₹1,81,238', caption: 'Home: your balance and today’s numbers', lift: true },
              { src: '/landing/flow.webp', alt: 'Flow screen with sample data: the November story of what came in, went out and was kept', caption: 'Flow: your month as a short story' },
            ].map(p => (
              <figure key={p.src} className={`w-[68%] shrink-0 snap-center sm:w-[44%] md:w-auto ${p.lift ? 'md:-translate-y-8' : ''}`}>
                <Phone src={p.src} alt={p.alt} />
                <figcaption className="mt-4 text-center text-[14.5px] text-zen-charcoal">{p.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20">
        <div className="mx-auto max-w-[1160px] px-5 py-20 sm:px-8 lg:py-28">
          <h2 className="font-serif text-[36px] font-medium leading-tight tracking-[-0.01em] sm:text-[44px]">Made for how money really moves</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-12">
            {/* Money moved */}
            <article className="rounded-[28px] border border-sage-border bg-white p-7 md:col-span-7">
              <h3 className="font-serif text-[26px] leading-tight">Transfers aren&rsquo;t spending</h3>
              <p className="mt-2 max-w-[30rem] text-[15.5px] leading-relaxed text-zen-charcoal">
                Mark payees once as your own accounts, family or investments, and Wall·ette keeps that money out of your
                spending from then on.
              </p>
              <ul className="mt-6 divide-y divide-sage-border rounded-2xl border border-sage-border">
                {[
                  ['AARAV SHARMA', 'My accounts'],
                  ['SUNITA SHARMA', 'Family'],
                  ['ZERODHA BROKING', 'Investments'],
                ].map(([payee, kind]) => (
                  <li key={payee} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="truncate text-[14px] font-semibold">{payee}</span>
                    <span className="shrink-0 rounded-full bg-sage-light px-3 py-1 text-[12.5px] font-medium text-[color:var(--sage-deep)]">{kind}</span>
                  </li>
                ))}
              </ul>
            </article>

            {/* Left to spend */}
            <article className="flex flex-col rounded-[28px] bg-premium-charcoal p-7 text-zen-bg md:col-span-5">
              <h3 className="font-serif text-[26px] leading-tight">Left to spend</h3>
              <p className="mt-2 text-[15.5px] leading-relaxed opacity-85">
                What you can still spend before your next pay, once the bills still to come and your savings goal are set aside.
              </p>
              <dl className="mt-auto pt-6 text-[14px]" aria-label="An example, with sample numbers">
                {[
                  ['Came in since 1 Nov', '+₹85,000'],
                  ['Spent and invested', '−₹50,616'],
                  ['Bills still to come', '−₹649'],
                  ['Savings goal', '−₹15,000'],
                ].map(([what, amount]) => (
                  <div key={what} className="flex items-baseline justify-between gap-4 border-t border-zen-bg/15 py-2.5">
                    <dt className="opacity-90">{what}</dt>
                    <dd className="shrink-0 tabular-nums">{amount}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-zen-bg/40 pt-3 font-semibold">
                  <dt>Left to spend</dt>
                  <dd className="shrink-0 tabular-nums">₹18,735</dd>
                </div>
              </dl>
            </article>

            {/* History */}
            <article className="overflow-hidden rounded-[28px] border border-sage-border bg-white md:col-span-4">
              <div className="p-7 pb-0">
                <h3 className="font-serif text-[24px] leading-tight">Every entry, findable</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-zen-charcoal">Search by merchant, category or note, and export what you need.</p>
              </div>
              <img src="/landing/history.webp" alt="History screen with sample data" width={640} height={1138} loading="lazy" decoding="async"
                className="mx-auto mt-6 block h-[230px] w-[78%] rounded-t-[22px] border border-b-0 border-sage-border object-cover object-top" />
            </article>

            {/* Rewind */}
            <article className="overflow-hidden rounded-[28px] border border-sage-border bg-white md:col-span-4">
              <div className="p-7 pb-0">
                <h3 className="font-serif text-[24px] leading-tight">Rewind</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-zen-charcoal">Your year at a glance, with records and streaks, ready to share.</p>
              </div>
              <img src="/landing/rewind.webp" alt="Rewind screen with sample data" width={640} height={1138} loading="lazy" decoding="async"
                className="mx-auto mt-6 block h-[230px] w-[78%] rounded-t-[22px] border border-b-0 border-sage-border object-cover object-top" />
            </article>

            {/* Lock */}
            <article className="flex flex-col rounded-[28px] border border-sage-border bg-zen-cream p-7 md:col-span-4">
              <h3 className="font-serif text-[24px] leading-tight">Locked when you leave</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-zen-charcoal">
                Fingerprint unlock on Android, and the app locks itself whenever you switch away.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-zen-charcoal">
                It keeps working offline and syncs when you&rsquo;re back.
              </p>
              <span className="mt-auto inline-flex h-20 w-20 items-center justify-center self-center rounded-full bg-gradient-to-br from-sage to-sage/80 shadow-soft md:mt-8" aria-hidden="true">
                <WallEEyes size="md" expression="sleepy" />
              </span>
            </article>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="scroll-mt-20 border-y border-sage-border bg-white/60">
        <div className="mx-auto grid max-w-[1160px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-28">
          <div>
            <h2 className="font-serif text-[36px] font-medium leading-tight tracking-[-0.01em] sm:text-[44px]">Private by design</h2>
            <p className="mt-4 max-w-[28rem] text-[17px] leading-relaxed text-zen-charcoal">
              A money app sees more of your life than almost anything else on your phone. Wall·ette is built to keep that to you.
            </p>
            <a href={PRIVACY_URL} className={`mt-6 inline-block rounded text-[15.5px] font-semibold text-premium-charcoal underline decoration-sage decoration-2 underline-offset-4 ${focusRing}`}>
              Read the privacy policy
            </a>
          </div>
          <ul className="space-y-5">
            {PRIVACY_POINTS.map(p => (
              <li key={p} className="flex gap-4 text-[16px] leading-relaxed text-zen-charcoal">
                <span className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-sage" aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20">
        <div className="mx-auto grid max-w-[1160px] grid-cols-[minmax(0,1fr)] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-28">
          <div>
            <h2 className="font-serif text-[36px] font-medium leading-tight tracking-[-0.01em] sm:text-[44px]">Questions</h2>
            <p className="mt-4 max-w-[26rem] text-[17px] leading-relaxed text-zen-charcoal">
              Anything else? Write to{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className={`rounded font-semibold text-premium-charcoal underline decoration-sage decoration-2 underline-offset-4 ${focusRing}`}>{CONTACT_EMAIL}</a>.
            </p>
          </div>
          <div className="wl-faq divide-y divide-sage-border border-y border-sage-border">
            {FAQS.map(f => (
              <details key={f.q} className="group">
                <summary className={`flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-semibold text-premium-charcoal ${focusRing}`}>
                  {f.q}
                  <span className="wl-plus shrink-0 text-[24px] font-light leading-none text-[color:var(--sage-deep)] transition-transform" aria-hidden="true">+</span>
                </summary>
                <p className="max-w-[40rem] pb-6 text-[16px] leading-relaxed text-zen-charcoal">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-[1160px] px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="relative overflow-hidden rounded-[32px] bg-sage-light/70 px-7 py-14 sm:px-12 lg:min-h-[340px] lg:py-20">
          <RangoliCorner className="pointer-events-none absolute -left-4 -top-4 h-32 w-32 opacity-25" color="var(--sage-2)" />
          <div className="relative lg:max-w-[52%]">
            <h2 className="font-serif text-[36px] font-medium leading-tight tracking-[-0.01em] sm:text-[46px]">
              Start with last month&rsquo;s statement.
            </h2>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryButton onClick={onOpenApp}>Open the web app</PrimaryButton>
              <PlayButton />
            </div>
          </div>
          <Phone
            src="/landing/import.webp"
            alt="Import screen with sample data: the balance check matches the statement's closing balance"
            className="absolute right-14 top-12 hidden w-[250px] lg:block"
          />
        </div>
      </section>
    </main>

    <footer className="border-t border-sage-border">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Mark className="h-9 w-9" />
          <div>
            <Wordmark />
            <p className="text-[13.5px] text-zen-charcoal/80">Your mindful money companion</p>
          </div>
        </div>
        <nav aria-label="Legal and contact" className="flex flex-wrap gap-x-6 gap-y-2 text-[14.5px] text-zen-charcoal">
          <a href={PRIVACY_URL} className={`rounded hover:text-premium-charcoal ${focusRing}`}>Privacy policy</a>
          <a href={TERMS_URL} className={`rounded hover:text-premium-charcoal ${focusRing}`}>Terms</a>
          <a href={`mailto:${CONTACT_EMAIL}`} className={`rounded hover:text-premium-charcoal ${focusRing}`}>Contact</a>
        </nav>
        <p className="text-[13.5px] text-zen-charcoal/80">&copy; 2026 Wall·ette. Made in Mumbai.</p>
      </div>
    </footer>
  </div>
);

export default Landing;
