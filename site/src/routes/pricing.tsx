import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageHeader, breadcrumbJsonLd } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { Doodle, Mark, Shape, Sticker } from "@/components/site/Decor";
import { Check } from "lucide-react";
import { CtaBand } from "@/components/site/CtaBand";
import { COMPANY } from "@/lib/site";
import { useState } from "react";
import { inr } from "@/lib/money";
import { PLAN_CHANGE_FAQ, PLAN_TERMS_AT_A_GLANCE, PLANS } from "@/lib/plans";

const PATH = "/pricing";
const FAQ = [{"q": "What happens after the first 30 days?", "a": "Both plans start at ₹0 for 30 days, with card or bank details required. Day 31 is the first charge: Essential ₹49 monthly or ₹449 yearly; Plus ₹99 monthly or ₹899 yearly, according to the billing option you choose."}, {"q": "How much do I save with yearly billing?", "a": "Essential costs ₹449/year rather than ₹588 for twelve monthly payments, saving ₹139 (23.64%, rounded to 24%). Plus costs ₹899/year rather than ₹1,188, saving ₹289 (24.33%, rounded to 24%). The approximate monthly equivalents are ₹37 and ₹75; the yearly amount is charged as one payment."}, {"q": "What extra features does Plus include?", "a": "Essential includes statement imports, Vault/Pulse, categories, transfers and Left to spend, with 1 bank account and 12 months of history. Plus includes everything in Essential plus unlimited bank accounts, full history, Money flow/Rewind, recurring/subscription tracking and priority support/bank requests. Accuracy checks, privacy, no ads and data export/deletion are identical on both plans."}, {"q": "Which payment methods are supported?", "a": "In the Android app you'll pay through Google Play, with the payment methods it offers for subscriptions in India, such as UPI Autopay and cards. This marketing site has no checkout of its own."}, {"q": "Will I get a reminder before the first charge?", "a": "Yes. On day 25 the app will show a reminder with the date and amount of your first charge, and Google Play also emails a reminder before a free trial ends. Cancel before day 31 and nothing is charged."}, ...PLAN_CHANGE_FAQ];
const CAPABILITIES = [
{ name: "Statement imports, Vault/Pulse and categories", essential: "Included", plus: "Included" },
{ name: "Transfers and Left to spend", essential: "Included", plus: "Included" },
{ name: "Bank accounts", essential: "1", plus: "Unlimited" },
{ name: "History", essential: "12 months", plus: "Full history" },
{ name: "Money flow / Rewind", essential: "Not included", plus: "Included" },
{ name: "Recurring / subscription tracking", essential: "Not included", plus: "Included" },
{ name: "Priority support / bank requests", essential: "Not included", plus: "Included" },
{ name: "Accuracy checks and privacy", essential: "Identical", plus: "Identical" },
{ name: "No ads, data export and deletion", essential: "Included", plus: "Included" },
];

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing: Essential and Plus, first 30 days ₹0 — Wall·ette" },
      { name: "description", content: "Essential ₹49/month or ₹449/year. Plus ₹99/month or ₹899/year. Both start with 30 days at ₹0; card or bank details required. Compare billing options." },
      { property: "og:title", content: "Pricing: Essential and Plus, first 30 days ₹0 — Wall·ette" },
      { property: "og:description", content: "Essential ₹49/month or ₹449/year. Plus ₹99/month or ₹899/year. Both start with 30 days at ₹0; card or bank details required. Compare billing options." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${COMPANY.siteUrl}${PATH}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.siteUrl}${PATH}` }],
    scripts: [breadcrumbJsonLd([{ name: "Pricing: Essential and Plus, first 30 days \u20b90", path: PATH }]),
      { type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }) },
    ],
  }),
  component: Page,
});

function Page() {
  const [yearly, setYearly] = useState(false);
  return <>
    <PageHeader crumbs={[{ label: "Pricing" }]} eyebrow="Essential or Plus" title={<>A clearer month. <span className="text-forest">A clear price.</span></>} lead="Both plans start at ₹0 for 30 days. Card or bank details required. Choose monthly billing or one yearly payment." actions={<Start label="Start your 30 days" />} aside={<Reveal className="relative isolate mx-auto w-full max-w-sm py-8">
      <Shape kind="burst" tone="--shape-sun" spin className="-z-10 inset-0 m-auto size-full opacity-80" />
      <Doodle kind="coin" className="-left-2 top-2 size-10 text-forest/50" />
      <Doodle kind="spark" className="-right-2 bottom-6 size-9 text-forest/50" />
      <div className="mx-auto w-64 -rotate-3 rounded-[2rem_1rem_2rem_1rem] bg-card p-7 text-center shadow-lift">
        <p className="text-eyebrow">First month</p>
        <p className="money mt-2 font-display text-6xl font-bold text-forest">₹0</p>
        <p className="mt-2 text-sm text-muted-foreground">for 30 days · then from ₹37/month</p>
      </div>
      <Sticker className="-bottom-2 right-0" tilt={4}><span className="font-semibold">No permanent free plan</span></Sticker>
    </Reveal>} />
    <section className="container-site pb-10" aria-label="Before paid plans start">
      <p className="rounded-2xl border border-border bg-card p-5 text-muted-foreground shadow-soft"><strong className="text-foreground">Paid plans haven’t started yet.</strong> Until they do, Wall·ette is free and no card is asked for. These are the prices when they start, and we’ll tell members before anything changes.</p>
    </section>
    <section className="edge edge-wave relative z-[4] overflow-hidden tint-sage py-16 sm:py-20" aria-labelledby="plans-title">
      <Shape kind="leaf" tone="--sage-soft" className="-left-24 bottom-0 size-80 opacity-70" />
      <div className="container-site relative">
      <div className="flex flex-wrap items-center justify-between gap-6"><h2 id="plans-title" className="text-section">Choose your billing <Mark>rhythm</Mark></h2><fieldset className="flex rounded-full border border-border bg-card p-1"><legend className="sr-only">Billing period</legend>{[false, true].map(value => <label key={String(value)} className={`cursor-pointer rounded-full px-5 py-3 font-semibold focus-within:ring-2 focus-within:ring-ring ${yearly === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><input type="radio" name="billing" className="sr-only" checked={yearly === value} onChange={() => setYearly(value)} />{value ? "Yearly · Save 24%" : "Monthly"}</label>)}</fieldset></div>
      <div className="mt-14 grid items-center gap-10 md:grid-cols-2 md:gap-8">{PLANS.map(plan => { const plus = plan.name === "Plus"; return <Reveal key={plan.name} className={plus ? "relative isolate" : ""}>
        {plus && <><Shape kind="burst" tone="--shape-sun" spin className="-z-10 -inset-10 size-[calc(100%+5rem)] opacity-70" /><Doodle kind="spark" className="-right-2 -top-8 size-10 text-forest" /></>}
        <div className={plus ? "plan-glow relative rounded-[1.5rem_2.75rem_1.5rem_2.75rem] bg-forest-gradient p-8 text-on-forest md:rotate-1 md:scale-[1.03]" : "relative rounded-[2.75rem_1.5rem_2.75rem_1.5rem] bg-card p-8 shadow-lift md:-rotate-1"}>
        {plus && <span className="absolute -top-4 right-6 -rotate-3 rounded-full bg-sand px-3 py-1 text-sm font-bold text-forest shadow-lift">Most popular</span>}
        <h3 className="text-2xl">{plan.name}</h3>
        <p className="money mt-6 font-display text-5xl font-bold">{inr(0)}<span className="ml-2 text-base font-normal opacity-70">for 30 days</span></p>
        <div className="mt-4 min-h-24" aria-live="polite" aria-atomic="true"><p className="text-xl font-semibold">Then {inr(yearly ? plan.yearly : plan.monthly)}/{yearly ? "year" : "month"}</p><p className="mt-2 opacity-75">{yearly ? `Approximately ${inr(plan.equivalent)}/month. Billed ${inr(plan.yearly)} once yearly.` : "Billed monthly after the trial."}</p>{yearly && <p className={`mt-1 text-sm font-semibold ${plus ? "" : "text-forest"}`}>Save {inr(plan.monthly * 12 - plan.yearly)} per year · 24% rounded</p>}</div>
        <ul className="mt-4 space-y-2.5 text-sm">{(plan.name === "Essential" ? ["Statement imports, Vault/Pulse and categories", "Transfers and Left to spend", "1 bank account · 12 months of history"] : ["Everything in Essential", "Unlimited bank accounts · full history", "Money flow / Rewind", "Recurring / subscription tracking", "Priority support / bank requests"]).map(item => <li key={item} className="flex gap-2.5"><span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${plus ? "bg-on-forest/15" : "bg-accent"}`}><Check className="size-3.5" aria-hidden /></span>{item}</li>)}</ul>
        <p className="mt-5 text-xs opacity-70">Card or bank details required. Accuracy checks, privacy, no ads and data export/deletion are identical on both plans.</p>
        <div className="mt-6">{plus ? <Button asChild variant="ghostIvory" size="xl"><Link to="/signup">Start Plus signup</Link></Button> : <Start label="Start Essential signup" />}</div>
        </div>
      </Reveal>; })}</div><p className="mt-10 text-sm text-muted-foreground">Yearly equivalents are rounded, not monthly charges. Essential saves 23.64%; Plus saves 24.33%, each rounded to 24% versus 12 monthly payments.</p><p className="mt-2 text-sm text-muted-foreground">Move up to Plus at any time; move down to Essential after your first year, from your next renewal. The free month is for new members only — a paused or stopped plan restarts as a paid month one.</p></div></section>
    <section className="section-fit container-site relative py-16">
      <Doodle kind="arrow" className="right-[20%] top-10 hidden size-14 text-forest/40 lg:block" />
      <h2 className="text-section">Compare Essential and <Mark>Plus</Mark></h2><p className="mt-4 max-w-3xl text-muted-foreground">Choose by account count, history and planning tools — not by security or accuracy. Both plans have identical accuracy checks, privacy protections, no ads and data export/deletion.</p>
      <div className="mt-12 overflow-x-auto pt-4"><table className="w-full border-separate text-sm sm:text-base border-spacing-0 text-left"><caption className="sr-only">Essential and Plus plan comparison</caption><thead><tr><th scope="col" className="p-4 text-muted-foreground">Capability</th><th scope="col" className="p-4 text-center">Essential</th><th scope="col" className="relative rounded-t-[1.75rem] bg-forest-gradient p-4 text-center text-on-forest">Plus</th></tr></thead><tbody>{CAPABILITIES.map((item, i) => <tr key={item.name}><th scope="row" className={`rounded-l-2xl p-4 font-medium ${i % 2 === 0 ? "bg-card" : ""}`}>{item.name}</th><td className={`p-4 text-center text-muted-foreground ${i % 2 === 0 ? "bg-card" : ""}`}>{item.essential}</td><td className={`bg-forest-gradient p-4 text-center font-semibold text-on-forest ${i === CAPABILITIES.length - 1 ? "rounded-b-[1.75rem]" : ""}`}>{item.plus}</td></tr>)}</tbody></table></div>
    </section>
    <section className="container-site pb-16" aria-labelledby="plan-terms-title">
      <h2 id="plan-terms-title" className="text-section">How plans <Mark>work</Mark></h2>
      <p className="mt-4 max-w-3xl text-muted-foreground">Everything about trials, charges and changing plans, before you choose. The terms of service say the same.</p>
      <dl className="mt-10 grid gap-4 md:grid-cols-2">
        {PLAN_TERMS_AT_A_GLANCE.map(item => <div key={item.term} className="rounded-[1.5rem_1rem_1.5rem_1rem] border border-border bg-card p-5 shadow-soft"><dt className="font-display text-lg font-semibold text-foreground">{item.term}</dt><dd className="mt-2 text-muted-foreground">{item.text}</dd></div>)}
      </dl>
    </section>
    <section className="edge edge-scallop relative z-[3] overflow-hidden tint-sand py-16">
      <Shape kind="cloud" tone="--shape-sun" className="-right-20 -top-10 size-64 opacity-50" />
      <div className="container-site relative"><h2 className="text-section">Your first <Mark>30 days</Mark></h2>
      <ol className="relative mt-12 grid gap-10 md:grid-cols-3">
        <div className="absolute left-0 right-0 top-7 hidden border-t-2 border-dashed border-forest/30 md:block" aria-hidden />
        {[{ day: "Day 1", title: "Begin at ₹0", text: "Choose a plan and billing period. Card or bank details are required for the trial.", kind: "pebble", tone: "--sage-soft" }, { day: "Day 25", title: "A reminder", text: "The app reminds you of the date and amount of your first charge, and Google Play emails you too. Cancel before day 31 and you pay nothing.", kind: "cloud", tone: "--shape-sun" }, { day: "Day 31", title: "First charge", text: "Your selected monthly or full yearly price becomes due after the trial. Check the applicable subscription terms before continuing.", kind: "burst", tone: "--shape-clay" }].map((item, i) => <Reveal as="li" key={item.day} delay={i * 120} className="relative">
          <span className="relative grid size-14 place-items-center"><Shape kind={item.kind as "pebble"} tone={item.tone} className="inset-0 size-full" /><span className="relative font-display text-sm font-bold text-forest">{item.day.replace("Day ", "D")}</span></span>
          <p className="text-eyebrow mt-5">{item.day}</p><h3 className="mt-2 text-xl">{item.title}</h3><p className="mt-2 text-muted-foreground">{item.text}</p></Reveal>)}
      </ol>
      <div className="mt-12 flex items-start gap-4 rounded-[2rem_1rem_2rem_1rem] bg-card p-6"><span className="relative grid size-12 shrink-0 place-items-center"><Shape kind="wallet" tone="--sage-soft" className="inset-0 size-full" /></span><div><h3 className="text-xl">Planned ways to pay</h3><p className="mt-2 text-muted-foreground">UPI, cards and netbanking are planned. There is no active checkout on this page, and availability of a particular payment method is not confirmed here.</p></div></div></div>
    </section>
    <section className="container-site py-8"><Reveal className="relative overflow-hidden rounded-[2.5rem_1.25rem_2.5rem_1.25rem] tint-peach p-6 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-10"><Shape kind="burst" tone="--shape-sun" spin className="-right-10 -top-10 size-40 opacity-60" /><Doodle kind="receipt" className="right-[30%] bottom-3 hidden size-10 text-forest/40 md:block" /><div className="relative"><h2 className="text-2xl">Referrals, student access and gifts</h2><p className="mt-2 text-muted-foreground">See current-plan referral rewards, Essential through a verified course and annual gift discounts on Spread.</p></div><Button asChild variant="hero" size="xl" className="relative mt-5 shrink-0 sm:mt-0"><Link to="/spread">Explore Spread</Link></Button></Reveal></section>
    <section className="container-site max-w-3xl py-16"><h2 className="text-section">Pricing questions</h2><Questions items={FAQ} /><p className="mt-6 text-muted-foreground">Need a confirmed plan detail? <Link to="/contact" className="font-semibold text-forest underline">Ask us before choosing.</Link></p><p className="mt-4 text-muted-foreground">Still choosing your money app? <Link to="/compare" className="font-semibold text-forest underline">Compare Wall·ette with Indian and international peers.</Link></p></section>
    <CtaBand title="Start with your own numbers." body="Both plans: ₹0 for 30 days, card or bank details required. Then Essential ₹49/month or ₹449/year; Plus ₹99/month or ₹899/year." cta="Continue to signup" />
  </>;
}

function Questions({ items }: { items: { q: string; a: string }[] }) {
  return <Accordion type="multiple" className="mt-6">{items.map(f => <AccordionItem key={f.q} value={f.q}><AccordionTrigger className="text-left">{f.q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{f.a}</AccordionContent></AccordionItem>)}</Accordion>;
}
function Start({ label }: { label: string }) {
  return <Button asChild variant="hero" size="xl"><Link to="/signup">{label}</Link></Button>;
}
