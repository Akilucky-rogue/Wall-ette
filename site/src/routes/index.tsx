import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, FileCheck2, Lock, ShieldCheck, Smartphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Reveal } from "@/components/site/Reveal";
import { DeviceTrio } from "@/components/site/DeviceTrio";
import { PhoneShot } from "@/components/site/PhoneShot";
import { CountUp } from "@/components/site/CountUp";
import { CtaBand } from "@/components/site/CtaBand";
import { ProductProof } from "@/components/site/ProductProof";
import { Doodle, Mark, Shape, ShapeStage } from "@/components/site/Decor";
import { BANKS, COMPANY } from "@/lib/site";
import { BANK_LOGOS } from "@/lib/bank-logos";
import { inr } from "@/lib/money";
import { cn } from "@/lib/utils";
import pulse from "@/assets/screen-pulse.webp.asset.json";
import home from "@/assets/screen-home.webp.asset.json";
import flow from "@/assets/screen-flow.webp.asset.json";
import vault from "@/assets/screen-history.webp.asset.json";
import rewind from "@/assets/screen-rewind.webp.asset.json";
import think from "@/assets/mascot-think-cutout.png.asset.json";

const FAQ = [
  { q: "Is my bank statement uploaded anywhere?", a: "No. The original statement is processed on your device. Extracted transaction records are stored in your private account to support synchronisation." },
  { q: "Which banks does Wall·ette support?", a: "IDFC FIRST (PDF and Excel), HDFC (Excel), SBI, Kotak Mahindra, Union Bank of India and Saraswat Bank (PDF). PDFs from other banks often work too, and any row Wall·ette can't read is named on the review screen." },
  { q: "What does “checked to the paisa” actually mean?", a: "Every row is checked against the statement's running balance, and against the bank's own totals where they're printed. That proves the numbers add up. Categories are a separate step: you review and correct them before anything is saved." },
  { q: "How much does it cost?", a: "Your first month is free on either plan. After that it's ₹49 or ₹99 a month, or ₹449 or ₹899 a year. Cancel before day 31 and you pay nothing. Upgrade anytime; downgrade after your first year. The free month is for new members only." },
  { q: "Does Wall·ette give financial advice?", a: "No. Wall·ette is a tracking tool that helps you read your own banking data. It isn't an investment adviser or research analyst, and it never tells you what to buy or sell." },
  { q: "Are there ads or AI reading my money?", a: "No ads, ever. No advertiser or AI service sees your transactions, and crash reports carry none of your money data." },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wall·ette — Money Tracking & Budgeting for Indian bank statements" },
      { name: "description", content: "Import your bank statement and Wall·ette sorts every line into spending, income and transfers, checked to the paisa. Statements are processed on your device. First month ₹0, card required." },
      { property: "og:title", content: "Wall·ette — Money Tracking & Budgeting" },
      { property: "og:description", content: "Import your statement, check the numbers and understand your spending, transfers and commitments - all in one place. Backed by SERNET." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: COMPANY.siteUrl },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: COMPANY.siteUrl }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Wall·ette",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          offers: [
            { "@type": "Offer", name: "Monthly", price: "49", priceCurrency: "INR" },
            { "@type": "Offer", name: "Monthly", price: "99", priceCurrency: "INR" },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }),
      },
    ],
  }),
  component: Index,
});

function Hero() {
  return (
    <section className="edge edge-wave z-[8] bg-hero overflow-hidden">
      <div className="container-site pb-2 pt-[calc(var(--header-height)+2rem)] text-center">
        <div className="hero-enter mx-auto max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-sm font-medium text-forest">
            <span className="size-2 rounded-full bg-sage" aria-hidden /> Your Personal Finance Companion
          </p>
          <h1 className="text-hero mt-5">Your bank statement, <span className="text-forest">made readable.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Import your statement, check the numbers and understand your spending, transfers and commitments - all in one place.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero" size="xl" className="plan-glow"><Link to="/signup">Start your free month <ArrowRight /></Link></Button>
            <Button asChild variant="soft" size="xl"><Link to="/features">See features</Link></Button>
          </div>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <span>First Month <span className="ml-1 rounded-md bg-mark/60 px-1.5 py-0.5 font-display text-base font-bold text-foreground">₹0</span></span>
            <span className="text-sage" aria-hidden>·</span>
            <span>Card Required</span>
            <span className="text-sage" aria-hidden>·</span>
            <span className="font-semibold text-forest underline decoration-sage decoration-wavy decoration-2 underline-offset-4">Cancel Anytime</span>
          </p>
        </div>
        <div className="hero-enter hero-aside mt-7"><DeviceTrio /></div>
      </div>
    </section>
  );
}

function Introduction() {
  return <section className="bg-background !pt-[calc(var(--edge-h)+0.25rem)] pb-10 sm:pb-12">
    <div className="container-site">
      <ProductProof compact />
      <div className="mx-auto mt-7 max-w-3xl border-t border-dashed border-border pt-6 text-center">
        <h2 className="font-display text-xl font-bold">What is Wall·ette?</h2>
        <p className="mt-3 text-base text-muted-foreground">A personal money tracker for the <Link to="/features" hash="import" className="font-semibold text-forest underline decoration-sage decoration-wavy decoration-2 underline-offset-4 transition-colors hover:decoration-gold">Indian bank statements</Link> you already have. Import, review and understand your money without sharing your statement file — or <Link to="/compare" className="font-semibold text-forest underline decoration-sage decoration-wavy decoration-2 underline-offset-4 transition-colors hover:decoration-gold">compare it with other apps</Link>.</p>
      </div>
    </div>
  </section>;
}

function Steps() {
  const steps = [
    { tint: "tint-sage", shape: "pebble", tone: "--sage-soft", t: "Upload your statement", b: "PDF or Excel from your bank's app. Password-locked PDFs are fine.", ex: <div className="flex items-center gap-2"><FileCheck2 className="size-5 text-forest" /><span className="font-semibold">HDFC_Nov.pdf</span><span className="ml-auto rounded-full bg-sage/30 px-2 text-xs">PDF · CSV</span></div> },
    { tint: "tint-sand", shape: "cloud", tone: "--shape-sun", t: "We sort it for you", b: "Read on your device and checked against your balance before anything is saved.", ex: <div><p className="text-xs text-muted-foreground line-through">UPI/SWIGGY8812/OK</p><p className="flex justify-between font-semibold"><span>Swiggy · Food</span><span>{inr(486)}</span></p></div> },
    { tint: "tint-peach", shape: "arch", tone: "--shape-clay", t: "See where it went", b: "Mark your own accounts once, and every total counts only real spending.", ex: <div><p className="text-xs text-muted-foreground">Left before payday</p><p className="font-display text-xl font-bold text-forest">{inr(21384)}</p></div> },
  ] as const;
  return (
    <section className="edge edge-arc z-[7] section-fit bg-card py-16 sm:py-24">
      <div className="container-site">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-eyebrow">How it works</p>
          <h2 className="text-section mt-3">Three steps, about <Mark>ten minutes</Mark> a month</h2>
        </Reveal>
        <ol className="relative mt-12 grid gap-6 md:grid-cols-3">
          <svg className="pointer-events-none absolute left-[10%] right-[10%] top-8 hidden h-6 w-[80%] text-sage md:block" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden><path d="M0 5 Q25 0 50 5 T100 5" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" /></svg>
          {steps.map((s, i) => (
            <Reveal as="li" key={s.t} delay={i * 120} className={cn(s.tint, "relative overflow-hidden rounded-[2rem_1.25rem_2rem_1rem] border border-border p-6 shadow-soft", i === 1 && "md:translate-y-6")}>
              <div className="relative grid size-16 place-items-center">
                <Shape kind={s.shape} tone={s.tone} className="inset-0 size-16" />
                <span className="relative font-display text-2xl font-bold text-forest">{i + 1}</span>
              </div>
              <h3 className="mt-4 text-xl">{s.t}</h3>
              <p className="mt-2 text-muted-foreground">{s.b}</p>
              <div className="mt-5 rounded-2xl border border-border bg-popover p-3 text-sm">{s.ex}</div>
            </Reveal>
          ))}
        </ol>
        <div className="mt-14 flex flex-wrap items-center justify-center gap-4"><Button asChild variant="hero" size="xl"><Link to="/signup">Start with your first statement <ArrowRight /></Link></Button><p className="text-sm text-muted-foreground">First month free for new members · card required</p></div>
      </div>
    </section>
  );
}

const SCREENS = [
  { key: "pulse", shape: "cloud", tone: "--shape-sun", label: "Pulse", img: pulse.url, title: "Where this month is heading", body: "Your spending pace against the same day last month, where the month is likely to land, and what stands out.", alt: "Pulse screen with sample data: ₹45,616 spent in November so far" },
  { key: "home", shape: "wallet", tone: "--shape-clay", label: "Home", img: home.url, title: "Your balance and today's numbers", body: "Money in and out this month, how much of your income is still left, top spending, budgets and recent entries.", alt: "Home screen with sample data: a balance of ₹2,77,023" },
  { key: "flow", shape: "leaf", tone: "--sage-soft", label: "Flow", img: flow.url, title: "Your month as a short story", body: "Where money came from, what you spent and kept, and your balance over 12 months. It spots your pay day too.", alt: "Flow screen with sample data showing the November money story" },
] as const;

function Showcase() {
  const [active, setActive] = useState(0);
  const s = SCREENS[active] ?? SCREENS[0];
  return (
    <section className="edge edge-wave relative z-[6] bg-background"><div className="section-fit container-site overflow-x-clip py-16 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="text-eyebrow">The app</p>
          <h2 className="text-section mt-3">Everything in one <Mark>calm</Mark> place</h2>
          <p className="mt-4 max-w-lg text-muted-foreground">The same wallet on your phone and on the web, synced through your account. It keeps working offline.</p>
          <div role="tablist" aria-label="App screens" className="mt-8 inline-flex rounded-full border border-border bg-card p-1">
            {SCREENS.map((sc, i) => (
              <button key={sc.key} role="tab" aria-selected={i === active} onClick={() => setActive(i)} className={cn("rounded-full px-5 py-2 text-sm font-semibold transition", i === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {sc.label}
              </button>
            ))}
          </div>
          <div key={s.key} className="row-in mt-6">
            <h3 className="text-xl">{s.title}</h3>
            <p className="mt-2 max-w-md text-muted-foreground">{s.body}</p>
          </div>
        </Reveal>
        <div className="relative flex justify-center">
          <Doodle kind="spark" className="right-[8%] top-0 size-9" />
          <ShapeStage key={s.key} kind={s.shape} tone={s.tone} className="row-in">
            <PhoneShot src={s.img} alt={s.alt} />
          </ShapeStage>
        </div>
      </div>
    </div>
    </section>
  );
}

function Bento() {
  return (
    <section className="edge edge-scallop z-[5] tint-sage relative overflow-hidden py-16 sm:py-24">
      <Shape kind="burst" tone="--shape-sun" spin className="-right-16 top-10 size-48 opacity-60" />
      <Shape kind="leaf" tone="--sage-soft" className="-left-24 bottom-10 size-72 opacity-70" />
      <Doodle kind="rupee" className="right-[12%] top-24 hidden size-10 text-forest/40 md:block" />
      <div className="container-site relative">
        <Reveal className="max-w-2xl">
          <p className="text-eyebrow">Made for how money really moves</p>
          <h2 className="text-section mt-3">Real <Mark>spending</Mark>, not just transactions</h2>
        </Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-6">
          <Reveal className="relative rounded-[2.5rem_1.25rem_2.5rem_1.25rem] bg-card p-6 shadow-lift sm:p-8 lg:col-span-3 lg:-rotate-1">
            <span className="relative grid size-14 place-items-center"><Shape kind="cloud" tone="--shape-sun" className="inset-0 size-full" /><Users className="relative size-6 text-forest" aria-hidden /></span>
            <h3 className="mt-4 text-xl">Transfers aren't spending</h3>
            <p className="mt-2 text-muted-foreground">Mark a payee once as your own account or investment, and Wall·ette keeps that money out of your spending. Money sent to family? You choose how it counts.</p>
            <ul className="mt-6 space-y-2">
              {[["Aarav Sharma", "My accounts", -1], ["Zerodha Broking", "Investments", 1], ["Sunita Sharma", "Family · you decide", -0.5]].map(([n, t, r]) => (
                <li key={n as string} style={{ transform: `rotate(${r}deg)` }} className="flex items-center justify-between rounded-full bg-background px-4 py-2.5 transition-transform hover:!rotate-0">
                  <span className="font-semibold">{n}</span>
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-forest">{t}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120} className="relative overflow-hidden rounded-[1.25rem_2.5rem_1.25rem_2.5rem] bg-forest-gradient p-6 text-on-forest shadow-lift sm:p-8 lg:col-span-3 lg:rotate-1">
            <Shape kind="wallet" tone="--forest-deep" className="-bottom-16 -right-16 size-56 opacity-30" />
            <Doodle kind="spark" className="right-6 top-6 size-8 text-on-forest/50" />
            <h3 className="relative text-xl">Left to spend</h3>
            <p className="relative mt-2 text-on-forest/80">An estimate for the period up to your next pay, from your recorded entries: money in, minus spending, bills still due and money you set aside. Opening balance isn't counted. Missing entries or changed bills change it; it's not a live bank balance.</p>
            <dl className="money relative mt-6 space-y-3">
              {[["Came in · 1–25 Nov", 85000], ["Spent and invested", -50616], ["Bills still to come", -649], ["Savings goal", -15000]].map(([l, v]) => (
                <div key={l as string} className="flex justify-between border-b border-dashed border-primary-foreground/25 pb-2">
                  <dt className="text-on-forest/80">{l}</dt>
                  <dd className="font-semibold">{inr(v as number, { sign: true })}</dd>
                </div>
              ))}
              <div className="flex items-end justify-between pt-2">
                <dt className="font-semibold">Estimated left to spend · until 1 Dec<span className="block text-xs font-normal text-on-forest/70">Sample data through 25 Nov</span></dt>
                <dd><CountUp value={18735} className="font-display text-3xl font-bold" /></dd>
              </div>
            </dl>
          </Reveal>
          <Reveal className="relative flex flex-col items-center px-2 pt-4 text-center lg:col-span-2">
            <h3 className="text-xl">Every entry, findable</h3>
            <p className="mt-2 max-w-xs text-muted-foreground">Search by payee, category or note. Filter, edit and export.</p>
            <ShapeStage kind="arch" tone="--shape-sun" className="max-w-[16rem]">
              <img src={vault.url} alt="Vault screen with sample data: every entry, newest first" loading="lazy" width={640} height={1138} className="mx-auto h-64 w-40 rounded-[1.5rem] object-cover object-top shadow-lift" />
            </ShapeStage>
          </Reveal>
          <Reveal delay={100} className="relative flex flex-col items-center px-2 pt-4 text-center lg:col-span-2">
            <h3 className="text-xl">Rewind</h3>
            <p className="mt-2 max-w-xs text-muted-foreground">Your year at a glance, with records and streaks, ready to share.</p>
            <ShapeStage kind="cloud" tone="--shape-clay" className="max-w-[16rem]">
              <img src={rewind.url} alt="Rewind screen with sample data: a year of entries and records" loading="lazy" width={640} height={1138} className="mx-auto h-64 w-40 rotate-3 rounded-[1.5rem] object-cover object-top shadow-lift" />
            </ShapeStage>
          </Reveal>
          <Reveal delay={200} className="relative flex flex-col items-center justify-center px-2 pt-4 text-center lg:col-span-2">
            <span className="relative grid size-28 place-items-center">
              <Shape kind="burst" tone="--sand" spin className="inset-0 size-full" />
              <Lock className="relative size-9 text-forest" aria-hidden />
            </span>
            <h3 className="mt-4 text-xl">Locked when you leave</h3>
            <p className="mt-2 max-w-xs text-muted-foreground">Fingerprint unlock on Android, and the app locks itself whenever you switch away. Works offline, syncs when you're back.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Banks() {
  return (
    <section className="edge edge-arc relative z-[4] bg-background"><div className="container-site py-16 sm:py-20">
      <Reveal className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="text-eyebrow">Supported banks</p>
          <h2 className="text-section mt-3">Reads the statements you already get</h2>
        </div>
        <Link to="/features" hash="banks" className="inline-flex items-center gap-1 font-semibold text-forest hover:underline">See formats and request a bank <ArrowRight className="size-4" /></Link>
      </Reveal>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {BANKS.map((b, i) => (
          <Reveal key={b.name} delay={i * 60} className="flex flex-col items-center p-4 text-center transition-transform hover:-translate-y-1">
            <span className="bank-logo"><img src={BANK_LOGOS[b.key]} alt={`${b.name} logo`} loading="lazy" className="max-h-full max-w-full object-contain" /></span>
            <p className="mt-3 font-semibold leading-tight">{b.name}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {b.formats.map((f) => <span key={f} className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-forest">{f}</span>)}
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">PDFs from other banks often work too.</p>
      <p className="mt-1 text-xs text-muted-foreground">Logos are trademarks of their respective owners. Wall·ette is not affiliated with these banks.</p>
    </div>
    </section>
  );
}

function Privacy() {
  const points = [
    "Your statement file stays on your device. Only the transactions are saved, to your own account.",
    "Statement passwords are used to open the file and never kept.",
    "Each account is walled off by database rules, so other users can't read your data.",
    "Export everything, or delete your account and data, whenever you want.",
  ];
  return (
    <section className="edge edge-tilt z-[3] section-fit bg-forest-gradient py-16 text-on-forest sm:py-24">
      <div className="container-site grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sage-soft">Private by design</p>
          <h2 className="text-section mt-3">A money app sees more of your life than almost anything else on your phone.</h2>
          <p className="mt-4 max-w-lg text-on-forest/80">Wall·ette is built to keep that to you — and to say plainly what's stored and where.</p>
          <Button asChild variant="ghostIvory" size="xl" className="mt-8"><Link to="/privacy" hash="how-we-protect">Read how we protect your data</Link></Button>
        </Reveal>
        <ul className="grid gap-3">
          {points.map((p, i) => (
            <Reveal as="li" key={p} delay={i * 100} className="flex gap-4 rounded-2xl bg-on-forest/8 p-5 ring-1 ring-on-forest/15">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sage-soft" aria-hidden />
              <span>{p}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Compare() {
  const reasons = [
    { icon: FileCheck2, title: "Built around Indian statements", body: "Start with a PDF or Excel file from a supported bank. No bank-login connection is needed for statement imports.", example: "Your file → reviewed entries", shape: "arch", tone: "--shape-sun" },
    { icon: Users, title: "Transfers aren't real spending", body: "Mark your own-account and investment payees once, so moving money doesn't inflate your spending totals.", example: "Savings transfer ≠ shopping", shape: "leaf", tone: "--sage-soft" },
    { icon: Smartphone, title: "A clearer view before payday", body: "See what's left after spending, upcoming bills and your savings goal. A planning number, not a live bank balance.", example: "Income − commitments = left to spend", shape: "cloud", tone: "--shape-clay" },
  ] as const;
  return <section className="container-site relative py-16 sm:py-20">
    <Reveal className="max-w-3xl"><p className="text-eyebrow">Why Wall·ette</p><h2 className="text-section mt-3">Choose the fit.<br />Not the <Mark>hype</Mark>.</h2><p className="mt-5 text-lg text-muted-foreground">Statement-first tracking is one way to understand your money. Here's where ours fits.</p></Reveal>
    <div className="mt-10 grid gap-10 md:grid-cols-3">{reasons.map((r, i) => <Reveal key={r.title} delay={i * 100} className="border-t border-border pt-6"><span className="relative grid size-14 place-items-center"><Shape kind={r.shape} tone={r.tone} className="inset-0 size-full" /><r.icon className="relative size-6 text-forest" aria-hidden /></span><h3 className="mt-5 text-xl">{r.title}</h3><p className="mt-3 text-muted-foreground">{r.body}</p><p className="mt-5 text-sm font-semibold text-forest">{r.example}</p></Reveal>)}</div>
    <div className="mt-12 grid items-start gap-5 border-t border-dashed border-border pt-8 lg:grid-cols-[1fr_auto]"><p className="max-w-2xl text-muted-foreground">Prefer bank-connected automation, hands-on budgeting or business accounting? Another tool may suit you better. Compare features, country support, pricing and trade-offs using official sources.</p><Button asChild variant="outline" size="xl"><Link to="/compare">Compare Wall·ette with 21 money apps <ArrowRight className="size-4" /></Link></Button></div>
  </section>;
}

function Founder() {
  return <section className="edge edge-arc relative z-[2] tint-sage py-12 sm:py-16"><div className="container-site grid gap-6 lg:grid-cols-[.75fr_1.25fr]"><Reveal><p className="text-eyebrow">From Mumbai, with a purpose</p><h2 className="text-section mt-3">It started with<br />one person's <Mark>payday</Mark>.</h2></Reveal><Reveal delay={100}><p className="text-lg">Akshat Vora wanted to understand what was actually left before his next salary. Confusing statement codes and transfers that looked like spending led him to build Wall·ette.</p><p className="mt-4 text-muted-foreground">Today, {COMPANY.legalName} builds and runs it in Mumbai—with the same aim: make your own money easier to understand.</p><Button asChild variant="soft" size="pill" className="mt-6"><Link to="/about">Meet the story behind Wall·ette <ArrowRight /></Link></Button></Reveal></div></section>;
}

function PricingTeaser() {
  const plans = [
    { name: "Essential", m: "₹49", y: "₹449", note: "Core tracking" },
    { name: "Plus", m: "₹99", y: "₹899", note: "Unlimited accounts, full history" },
  ];
  return (
    <section className="container-site pb-8">
      <Reveal className="relative grid gap-8 overflow-hidden rounded-[2.5rem_1.5rem_2.5rem_1.5rem] bg-sand p-6 sm:p-10 md:grid-cols-[1.1fr_1fr] md:items-center">
        <Shape kind="pebble" tone="--sage-soft" className="-bottom-24 -left-20 size-64 opacity-70" />
        <div className="relative">
          <p className="text-eyebrow">Pricing</p>
          <h2 className="text-section mt-3">First month <Mark>free</Mark>. Then from ₹37 a month.</h2>
          <p className="mt-3 text-muted-foreground">Two simple plans, monthly or yearly. Card required; first charge on day 31. Cancel before then and you pay nothing.</p>
          <Button asChild variant="hero" size="xl" className="mt-6"><Link to="/pricing">Compare plans</Link></Button>
        </div>
        <div className="relative grid grid-cols-2 items-center gap-4 py-6">
          {plans.map((p, i) => i === 0 ? (
            <div key={p.name} className="-rotate-2 rounded-[1.5rem] bg-card p-5">
              <p className="text-sm font-semibold text-muted-foreground">{p.name}</p>
              <p className="money mt-1 font-display text-3xl font-bold">{p.m}<span className="text-base font-medium opacity-70">/mo</span></p>
              <p className="mt-1 text-sm text-muted-foreground">or {p.y} a year</p>
              <p className="mt-3 text-xs text-muted-foreground">{p.note}</p>
            </div>
          ) : (
            <div key={p.name} className="relative isolate">
              <Shape kind="burst" tone="--shape-sun" spin className="-z-10 -inset-8 size-[calc(100%+4rem)]" />
              <Doodle kind="spark" className="-right-3 -top-6 size-8 text-forest" />
              <div className="plan-glow relative rotate-2 scale-105 rounded-[1.5rem] bg-forest-gradient p-5 text-on-forest">
                <span className="absolute -top-3 right-4 rounded-full bg-sand px-2.5 py-0.5 text-xs font-bold text-forest">Most popular</span>
                <p className="text-sm font-semibold opacity-80">{p.name}</p>
                <p className="money mt-1 font-display text-3xl font-bold">{p.m}<span className="text-base font-medium opacity-70">/mo</span></p>
                <p className="mt-1 text-sm opacity-80">or {p.y} a year</p>
                <p className="mt-3 text-xs opacity-80">{p.note}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Faq() {
  return (
    <section className="section-fit container-site grid gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_1.6fr]">
      <Reveal>
        <p className="text-eyebrow">Questions</p>
        <h2 className="text-section mt-3">Good questions to ask a money app</h2>
        <img src={think.url} alt="The Wall·ette mascot thinking" width={271} height={334} loading="lazy" className="mt-8 hidden w-40 lg:block" />
        <Link to="/faq" className="mt-6 inline-flex items-center gap-1 font-semibold text-forest hover:underline">All questions <ArrowRight className="size-4" /></Link>
      </Reveal>
      <Accordion type="single" collapsible className="rounded-3xl border border-border bg-card px-5 sm:px-8">
        {FAQ.map((f) => (
          <AccordionItem key={f.q} value={f.q}>
            <AccordionTrigger className="py-5 text-left text-base font-semibold">{f.q}</AccordionTrigger>
            <AccordionContent className="pb-5 text-[0.95rem] text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function Index() {
  return (
    <>
      <Hero />
      <Introduction />
      <Steps />
      <Showcase />
      <Bento />
      <Banks />
      <Founder />
      <Privacy />
      <Compare />
      <PricingTeaser />
      <Faq />
      <CtaBand />
    </>
  );
}
