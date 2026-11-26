import { StatementDemo } from "@/components/site/StatementDemo";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { ArrowLeftRight, ArrowRight, Check, CheckCircle2, Download, FileUp, IndianRupee, Landmark, Lock, Moon, Plus, ReceiptText, Repeat, Search, ShieldCheck, Smartphone, StickyNote, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageHeader, breadcrumbJsonLd } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { Doodle, Mark, Shape, ShapeStage, Sticker } from "@/components/site/Decor";
import mascotCelebrate from "@/assets/mascot-celebrate-clean.png.asset.json";
import { Mascot } from "@/components/site/Mascot";
import { SectionTabs } from "@/components/site/SectionTabs";
import { CtaBand } from "@/components/site/CtaBand";
import { PhoneShot } from "@/components/site/PhoneShot";
import { CountUp } from "@/components/site/CountUp";
import { cn } from "@/lib/utils";
import { BANKS, COMPANY, FEATURE_SECTIONS } from "@/lib/site";
import { inr, leftToSpend } from "@/lib/money";
import vault from "@/assets/screen-history.webp.asset.json";
import pulse from "@/assets/screen-pulse.webp.asset.json";
import flow from "@/assets/screen-flow.webp.asset.json";
import rewind from "@/assets/screen-rewind.webp.asset.json";
import home from "@/assets/screen-home.webp.asset.json";
import { BANK_LOGOS } from "@/lib/bank-logos";

const PATH = "/features";
const FAQ = [
  { q: "Do I need to connect my bank account or share my bank login?", a: "No. Download a PDF or Excel statement from your bank. Wall·ette opens the file on your device; this workflow does not require your bank-login credentials. Password-protected PDFs are supported, and the password is not kept." },
  { q: "What does ‘checked to the paisa’ mean?", a: "Each imported row is checked against the statement’s running balance and the bank’s printed totals where available. Categories are a separate review step: Wall·ette suggests them and you can correct them before saving." },
  { q: "What happens if I import the same statement twice?", a: "Rows already recorded are skipped using the bank’s reference, so overlapping imports do not create a second copy. Unreadable rows are named rather than silently omitted." },
  { q: "Are categories and transfers always classified correctly?", a: "No classification should be treated as infallible. Review suggested categories and mark your own-account and investment payees. Money sent to family is a real outflow for you; you decide how it should count." },
  { q: "Is Left to spend my live bank balance?", a: "No. It is a planning figure: came in minus spent, bills still due and your savings goal. Missing entries or changed commitments can affect it, so check your bank before making a payment." },
  { q: "Which features are in Essential and Plus?", a: "Essential includes statement imports, Vault, Pulse, categories, transfer classification and Left to spend, with 1 bank account and 12 months of history. Plus adds unlimited accounts, full history, Flow, Rewind, recurring tracking and priority support. Privacy and accuracy checks are identical." },
];

export const Route = createFileRoute("/features/")({
  head: () => ({
    meta: [
      { title: "Bank statement imports, expense tracking & money flow — Wall·ette" },
      { name: "description", content: "See how Wall·ette turns Indian bank statements into reviewed expenses, clear money flow and a practical Left-to-spend number. Explore every feature on one page." },
      { property: "og:title", content: "One statement. A month that finally makes sense — Wall·ette" },
      { property: "og:description", content: "Import, review, understand and plan: explore Wall·ette’s connected money-tracking features on one page." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${COMPANY.siteUrl}${PATH}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.siteUrl}${PATH}` }],
    scripts: [
      breadcrumbJsonLd([{ name: "Features", path: PATH }]),
      { type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }) },
      { type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "ItemList", itemListElement: FEATURE_SECTIONS.map((f, i) => ({ "@type": "ListItem", position: i + 1, name: f.title, url: `${COMPANY.siteUrl}${PATH}#${f.id}` })) }) },
    ],
  }),
  component: FeaturesPage,
});

const CHAPTER_ICONS = {
  import: FileUp,
  expenses: ReceiptText,
  flow: ArrowLeftRight,
  "left-to-spend": IndianRupee,
} as const;
const FEATURE_TABS = FEATURE_SECTIONS.map((item) => ({ id: item.id, label: item.title, icon: CHAPTER_ICONS[item.id] }));

function ChapterNav() {
  return <SectionTabs label="Feature chapters" items={FEATURE_TABS} />;
}

function Points({ items, inverse = false }: { items: string[]; inverse?: boolean }) {
  return <ul className="mt-7 space-y-3">{items.map((item) => <li key={item} className="flex items-start gap-3"><span className={inverse ? "mt-0.5 text-on-forest/80" : "mt-0.5 text-forest"}><Check className="size-5" aria-hidden /></span><span className={inverse ? "text-on-forest/85" : "text-muted-foreground"}>{item}</span></li>)}</ul>;
}

function ImportChapter() {
  return (
    <>
      <section id="import" className="edge edge-wave z-[9] section-fit tint-sage relative scroll-mt-32 overflow-hidden py-20 sm:py-28">
        <Doodle kind="leaf" className="left-[4%] top-16 size-12" />
        <Doodle kind="spark" className="right-[6%] top-10 size-9" style={{ animationDelay: "1.5s" }} />
        <div className="container-site grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
          <Reveal>
            <p className="text-eyebrow">01 · Import statements</p>
            <h2 className="text-section mt-4">Your bank already has the entries. Skip the <Mark>typing</Mark>.</h2>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">Bring in a PDF or Excel statement. Wall·ette reads it on your device, checks every row against the running balance and lets you review the result before it is saved.</p>
            <Points items={["Password-locked PDFs open locally; passwords are never kept.", "Unreadable rows and duplicate imports are surfaced clearly.", "Balance checks and category review stay separate and visible."]} />
            <p className="mt-7 flex items-center gap-2 text-sm font-semibold text-forest"><CheckCircle2 className="size-5" /> Tested against 17 real statements across six banks</p>
          </Reveal>
          <Reveal delay={100} direction="right" className="relative">
            <ShapeStage kind="arch" tone="--sage-soft"><PhoneShot src={vault.url} alt="Vault screen showing imported sample bank entries" className="relative" /></ShapeStage>
            <Sticker className="-left-2 top-20 sm:left-4" tilt={-5}><span className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-forest" /> Balance matched</span><span className="text-xs text-muted-foreground">to the paisa</span></Sticker>
            <Sticker className="-right-1 bottom-24 sm:right-6" tilt={4} delay={900}><span className="font-semibold">142 rows</span><span className="block text-xs text-muted-foreground">0 duplicates</span></Sticker>
            <Mascot pose="statement" decorative className="absolute -bottom-4 right-0 w-24 sm:right-4 sm:w-32" />
          </Reveal>
        </div>
      </section>
      <section id="banks" className="edge edge-arc relative z-[8] bg-background scroll-mt-32 py-14">
        <div className="container-site">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><p className="text-eyebrow">Supported banks</p><h3 className="mt-3 font-display text-2xl font-bold">The statements you already receive</h3></div>
            <Link to="/contact" className="inline-flex items-center gap-1 font-semibold text-forest hover:underline">Request your bank <ArrowRight className="size-4" /></Link>
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {BANKS.map((bank, i) => <Reveal as="li" key={bank.name} delay={i * 50} className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background p-4 text-center transition-shadow hover:shadow-soft"><span className="bank-logo"><img src={BANK_LOGOS[bank.key]} alt={`${bank.name} logo`} loading="lazy" className="max-h-full max-w-full object-contain" /></span><span><span className="block text-sm font-semibold leading-tight">{bank.name}</span><span className="mt-1 block text-xs text-muted-foreground">{bank.formats.join(" · ")}</span></span></Reveal>)}
            <Reveal as="li" delay={BANKS.length * 50}><Link to="/contact" className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-4 text-center text-sm font-semibold text-forest hover:bg-accent"><span className="grid h-12 w-12 place-items-center rounded-[.9rem] bg-accent"><Plus className="size-5" /></span>More banks</Link></Reveal>
          </ul>
          <p className="mt-7 text-sm text-muted-foreground">PDFs from other banks often work too. Wall·ette names any row it cannot read.</p>
          <p className="mt-2 text-xs text-muted-foreground">Bank names and logos are trademarks of their respective owners, shown only to indicate supported statement formats. Wall·ette is not affiliated with or endorsed by these banks.</p>
        </div>
      </section>
    </>
  );
}

function ExpensesChapter() {
  return (
    <>
    <section id="expenses" className="edge edge-scallop z-[7] section-fit tint-sand relative scroll-mt-32 overflow-hidden py-20 sm:py-28">
      <Doodle kind="coin" className="right-[5%] top-14 size-12" />
      <Doodle kind="arrow" className="bottom-12 left-[45%] hidden size-14 lg:block" style={{ animationDelay: "2s" }} />
      <div className="container-site grid items-center gap-14 lg:grid-cols-2">
        <Reveal direction="left" className="order-2 lg:order-1">
          <div className="relative mx-auto max-w-md">
            <Sticker className="-left-3 top-16 w-52 sm:-left-8" tilt={-4}>
              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Search className="size-4 text-forest" /> Find in Vault</p>
              <p className="mt-2 font-semibold">Swiggy</p><p className="money text-sm text-muted-foreground">Food delivery · ₹486</p>
            </Sticker>
            <Sticker className="-right-2 bottom-20 sm:-right-6" tilt={5} delay={1200}><span className="text-xs text-muted-foreground">Groceries this month</span><span className="money block font-semibold">₹7,840</span></Sticker>
            <ShapeStage kind="cloud" tone="--shape-sun"><PhoneShot src={pulse.url} alt="Pulse screen showing sample expenses grouped by category" /></ShapeStage>
          </div>
        </Reveal>
        <Reveal delay={100} className="order-1 lg:order-2">
          <p className="text-eyebrow">02 · Expense tracker</p>
          <h2 className="text-section mt-4">Find one payment. Understand the whole <Mark>pattern</Mark>.</h2>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">Vault keeps every recorded entry searchable. Pulse turns those entries into a category-by-category view, with the numbers behind every chart.</p>
          <Points items={["Search by payee, category or note; filter, edit and export.", "Review category suggestions instead of trusting a merchant name blindly.", "Keep recurring bills and subscriptions visible with Plus."]} />
          <div className="mt-8 flex flex-wrap gap-2 text-sm font-semibold"><span className="rounded-full bg-accent px-3 py-1.5 text-forest">Vault · both plans</span><span className="rounded-full bg-accent px-3 py-1.5 text-forest">Pulse · both plans</span><span className="rounded-full bg-sand px-3 py-1.5">Recurring · Plus</span></div>
        </Reveal>
      </div>
    </section>
    </>
  );
}

function FlowChapter() {
  return (
    <section id="flow" className="edge edge-tilt z-[6] section-fit relative scroll-mt-32 overflow-hidden bg-forest-gradient py-20 text-on-forest sm:py-28">
      <Doodle kind="leaf" className="right-[8%] top-12 size-14 !text-on-forest !opacity-30" />
      <Doodle kind="spark" className="bottom-16 left-[6%] size-10 !text-on-forest !opacity-30" />
      <div className="container-site">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_.9fr]">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-forest/70">03 · Money flow <span className="ml-2 rounded-full bg-on-forest/10 px-2 py-1 normal-case tracking-normal text-on-forest">Plus</span></p>
            <h2 className="text-section mt-4">Not every debit is spending. See what actually happened.</h2>
            <p className="mt-5 max-w-xl text-lg text-on-forest/80">Flow separates what came in, what was consumed and what you moved. Rewind then places the month in your longer recorded history.</p>
            <Points inverse items={["Mark own-account and investment payees so movement is not mistaken for shopping.", "Family payments remain real outflows; you choose what they represent.", "Compare months only after filling missing statement periods."]} />
          </Reveal>
          <Reveal delay={100} direction="right" className="relative"><ShapeStage kind="leaf" tone="--forest-deep"><PhoneShot src={flow.url} alt="Flow screen showing sample income, spending and money moved" /></ShapeStage><Sticker className="-left-1 top-24 text-foreground sm:left-6" tilt={-5}><span className="text-xs text-muted-foreground">Moved to savings</span><span className="money block font-semibold">₹15,000 · not spent</span></Sticker></Reveal>
        </div>
        <Reveal className="mt-16 grid items-center gap-6 border-t border-on-forest/20 pt-10 md:grid-cols-[1fr_auto]">
          <div><p className="font-display text-2xl font-bold">Step back with Rewind</p><p className="mt-2 max-w-2xl text-on-forest/75">A wider view of your recorded history, yearly records and streaks—always grounded in the statements you have actually imported.</p></div>
          <img src={rewind.url} alt="Rewind yearly money history with sample data" loading="lazy" width={640} height={1138} className="h-44 w-full rounded-[2.5rem_1rem_2.5rem_1rem] object-cover object-top md:w-80 md:-rotate-2" />
        </Reveal>
      </div>
    </section>
  );
}

function LeftToSpendChapter() {
  const result = leftToSpend({ cameIn: 85000, spent: 50616, billsDue: 649, savingsGoal: 15000 });
  const rows = [["Came in", 85000], ["Spent", -50616], ["Bills still due", -649], ["Savings goal", -15000]] as const;
  return (
    <section id="left-to-spend" className="edge edge-wave z-[5] section-fit tint-peach relative scroll-mt-32 overflow-hidden py-20 sm:py-28">
      <Doodle kind="rupee" className="left-[4%] top-14 size-11" />
      <Doodle kind="coin" className="bottom-14 right-[44%] hidden size-10 lg:block" style={{ animationDelay: "1s" }} />
      <div className="container-site grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
        <Reveal>
          <p className="text-eyebrow">04 · Left to spend</p>
          <h2 className="text-section mt-4">Give your balance its <Mark>jobs</Mark> before you spend it.</h2>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">An estimate for one pay period, with all four inputs visible: money in, minus spending, bills still due and money you set aside. Your opening balance is left out, so it never pretends to be a live bank balance.</p>
          <dl className="money mt-8 max-w-lg -rotate-1 rounded-3xl border border-border bg-card p-6 shadow-lift transition-transform hover:rotate-0">
            {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-border py-3"><dt className="text-muted-foreground">{label}</dt><dd>{inr(value, { sign: true })}</dd></div>)}
            <div className="flex items-end justify-between gap-4 pt-5"><dt className="font-semibold">Estimated left to spend<span className="block text-xs font-normal text-muted-foreground">Sample data through 25 Nov</span></dt><dd><CountUp value={result} className="font-display text-3xl font-bold text-forest" /></dd></div>
          </dl>
          <p className="mt-4 max-w-lg text-sm text-muted-foreground">Sample figures for 1–30 Nov. Missing entries, changed bills or commitments and transfers all change the estimate.</p>
        </Reveal>
        <Reveal delay={100} direction="right" className="relative"><ShapeStage kind="wallet" tone="--shape-clay"><PhoneShot src={home.url} alt="Home screen showing a sample Left-to-spend planning figure" className="relative" /></ShapeStage><img src={mascotCelebrate.url} alt="" aria-hidden loading="lazy" className="sticker absolute -bottom-4 -left-2 z-10 w-24 sm:w-32" style={{ "--tilt": "-6deg" } as CSSProperties} /></Reveal>
      </div>
    </section>
  );
}

const MONTH = [
  { icon: Wallet, title: "Salary arrives", body: "₹62,400 credited on the 1st." },
  { icon: FileUp, title: "Import statement", body: "Drop the PDF; rows are balance-checked." },
  { icon: ReceiptText, title: "Review categories", body: "Accept or fix suggestions in seconds." },
  { icon: IndianRupee, title: "See left to spend", body: "₹18,250 after bills and savings." },
  { icon: Repeat, title: "Month-end review", body: "Compare, learn and start fresh." },
];
function MonthStrip() {
  return (
    <section className="edge edge-arc z-[4] tint-sage relative overflow-hidden py-16 sm:py-20">
      <Doodle kind="spark" className="right-[5%] top-10 size-9" />
      <div className="container-site">
        <Reveal><p className="text-eyebrow">How a month looks</p><h2 className="text-section mt-3 max-w-2xl">Five calm steps from payday to <Mark>month-end</Mark>.</h2></Reveal>
        <ol className="relative mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          <span className="month-path absolute inset-x-[10%] top-7 hidden h-3 lg:block" aria-hidden />
          {MONTH.map((m, i) => <Reveal as="li" key={m.title} delay={i * 90} className="relative flex gap-4 lg:flex-col lg:items-center lg:text-center"><span className={cn("relative grid size-14 shrink-0 place-items-center rounded-full shadow-soft", i === 3 ? "bg-forest text-on-forest" : "bg-background text-forest")} style={{ rotate: `${i % 2 ? 4 : -4}deg` }}><m.icon className="size-6" aria-hidden /><span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-mark text-xs font-bold text-foreground">{i + 1}</span></span><div><p className="font-semibold lg:mt-3">{m.title}</p><p className="money mt-1 text-sm text-muted-foreground">{m.body}</p></div></Reveal>)}
        </ol>
        <p className="mt-5 text-xs text-muted-foreground">Sample figures for illustration.</p>
      </div>
    </section>
  );
}
const EXTRAS = [
  { icon: Repeat, title: "Recurring bills", body: "Subscriptions and EMIs kept in view.", plan: "Plus" },
  { icon: ArrowLeftRight, title: "Own-account transfers", body: "Moving money isn’t counted as spending.", plan: "Both" },
  { icon: StickyNote, title: "Notes on entries", body: "Remember why a payment happened.", plan: "Both" },
  { icon: Download, title: "Export anytime", body: "Your records leave with you.", plan: "Both" },
  { icon: Landmark, title: "Multiple accounts", body: "Every bank account in one picture.", plan: "Plus" },
  { icon: Moon, title: "Light and dark", body: "Easy on the eyes, day or night.", plan: "Both" },
];
function Extras() {
  return (
    <section className="container-site py-20 sm:py-24">
      <Reveal><p className="text-eyebrow">Also built in</p><h2 className="text-section mt-3">The small things that keep it <Mark>tidy</Mark>.</h2></Reveal>
      <div className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {EXTRAS.map((e, i) => <Reveal key={e.title} delay={i * 50} className="flex gap-4 py-2"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-forest" style={{ rotate: `${i % 2 ? 5 : -5}deg` }}><e.icon className="size-5" aria-hidden /></span><div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-semibold">{e.title}<span className={e.plan === "Plus" ? "rounded-full bg-sand px-2 py-0.5 text-xs" : "rounded-full bg-accent px-2 py-0.5 text-xs text-forest"}>{e.plan === "Plus" ? "Plus" : "Both plans"}</span></p><p className="mt-1 text-sm text-muted-foreground">{e.body}</p></div></Reveal>)}
      </div>
      <Reveal className="mt-12 grid gap-4 rounded-3xl bg-accent p-6 text-sm sm:grid-cols-3 sm:p-8">
        <p className="flex items-start gap-3"><Lock className="mt-0.5 size-5 shrink-0 text-forest" /> Statements are read on your device; no bank login needed.</p>
        <p className="flex items-start gap-3"><Landmark className="mt-0.5 size-5 shrink-0 text-forest" /> Built for Indian bank statements and rupee figures.</p>
        <p className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-forest" /> A tracking tool — not investment or financial advice.</p>
      </Reveal>
    </section>
  );
}


/** Features hero: three app screens fanned over a sun-burst shape, with the four chapters as stickers. */
function FeatureHeroArt() {
  return (
    <div className="relative isolate mx-auto w-full max-w-md px-2 pt-4">
      <Shape kind="burst" tone="--shape-sun" spin className="-z-10 -right-4 -top-2 size-24 sm:size-28" />
      <Shape kind="pebble" tone="--sage-soft" className="-z-10 -right-6 top-1/4 h-2/3 w-2/3" />
      <StatementDemo />
      <Sticker className="-left-1 -top-1" tilt={-4}><span className="flex items-center gap-2 font-semibold"><span className="size-2 rounded-full bg-sage" aria-hidden /> Web app live</span></Sticker>
      <Sticker className="-left-3 top-1/2" tilt={-3} delay={400}><span className="flex items-center gap-2 font-semibold"><Check className="size-4 text-forest" aria-hidden /> Checked to the paisa</span></Sticker>
      <Sticker className="-bottom-3 right-0" tilt={-2} delay={800}><span className="flex items-center gap-2 font-semibold"><Smartphone className="size-4 text-forest" aria-hidden /> Android coming soon</span></Sticker>
    </div>
  );
}

function FeaturesPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Features" }]}
        eyebrow="One connected picture"
        title={<>One statement. <span className="text-forest">A month that makes sense.</span></>}
        lead="Import your entries, understand what happened and make room for what comes next. Four connected tools, without four different stories to piece together."
        actions={<><Button asChild variant="hero" size="xl"><Link to="/signup">Start your first month <ArrowRight /></Link></Button><Button asChild variant="soft" size="xl"><a href="#import">Explore the features</a></Button></>}
        aside={<FeatureHeroArt />}
      />
      <ChapterNav />
      <ImportChapter />
      <ExpensesChapter />
      <FlowChapter />
      <LeftToSpendChapter />
      <MonthStrip />
      <Extras />

      <section className="edge edge-scallop relative z-[3] bg-card py-16">
        <Reveal className="container-site grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div><p className="text-eyebrow">Same care on every plan</p><h2 className="text-section mt-3">Accuracy and privacy are not upgrades.</h2><p className="mt-4 max-w-3xl text-muted-foreground">Both plans include statement checks, editable categories, no ads, data export and deletion. Essential covers the core month; Plus adds unlimited accounts, full history, Flow, Rewind and recurring tracking.</p></div>
          <Button asChild variant="soft" size="xl"><Link to="/pricing">Compare Essential and Plus</Link></Button>
        </Reveal>
      </section>

      <section className="container-site grid gap-10 py-20 sm:py-24 lg:grid-cols-[1fr_1.6fr]">
        <Reveal><p className="text-eyebrow">Good questions</p><h2 className="text-section mt-3">The details worth knowing</h2><p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-5 text-forest" /> Clear limits make clearer tools.</p></Reveal>
        <Accordion type="single" collapsible className="rounded-3xl border border-border bg-card px-5 sm:px-8">
          {FAQ.map((f) => <AccordionItem key={f.q} value={f.q}><AccordionTrigger className="py-5 text-left text-base font-semibold">{f.q}</AccordionTrigger><AccordionContent className="pb-5 text-[0.95rem] text-muted-foreground">{f.a}</AccordionContent></AccordionItem>)}
        </Accordion>
      </section>
      <CtaBand title="Let your next statement explain itself." body="Start with 30 days at ₹0. Card or bank details are required. Then choose Essential at ₹49/month or ₹449/year, or Plus at ₹99/month or ₹899/year." cta="Start your first month" />
    </>
  );
}
