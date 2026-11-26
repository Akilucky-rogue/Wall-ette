import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Eye, FileCheck2, ShieldCheck, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, breadcrumbJsonLd } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { Doodle, Mark, Shape } from "@/components/site/Decor";
import { Mascot } from "@/components/site/Mascot";
import { ProductProof } from "@/components/site/ProductProof";
import { CtaBand } from "@/components/site/CtaBand";
import { COMPANY } from "@/lib/site";
import { inr } from "@/lib/money";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Wall·ette — our story, principles & Mumbai roots" },
      { name: "description", content: "Meet the story behind Wall·ette: a first-salary question and a statement-first money tracker, built and run in Mumbai and backed by SERNET. Our principles and how subscriptions will fund us." },
      { property: "og:title", content: "About Wall·ette — built from a real money question" },
      { property: "og:description", content: "From a confusing bank statement to a clearer month. Our Mumbai roots, founder-led beginning and evidence behind our promises." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${COMPANY.siteUrl}/about` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.siteUrl}/about` }],
    scripts: [breadcrumbJsonLd([{ name: "About", path: "/about" }])],
  }),
  component: About,
});

const PRINCIPLES = [
  { icon: ShieldCheck, title: "Private by default", body: "Your statement file stays on your device. Extracted transactions sync to your private account; the file itself isn't uploaded.", to: "/privacy", label: "Read our privacy policy" },
  { icon: FileCheck2, title: "Numbers you can check", body: "Trace totals to statement rows, see balance checks and review categories. We name what couldn't be read instead of hiding it.", to: "/features", label: "See the statement checks" },
  { icon: Sprout, title: "Built openly", body: "See what's available and what's still ahead. Android is coming soon; the web app is available now.", to: "/roadmap", label: "Explore the roadmap" },
  { icon: Eye, title: "Clear service information", body: "Service reports and published incident updates have their own home, so you can check them for yourself.", to: "/status", label: "Check service status" },
] as const;

function About() {
  return <>
    <PageHeader crumbs={[{ label: "About" }]} eyebrow="Our story · Mumbai, India"
      title={<>Wall·ette. Built from a <span className="text-forest">real money question.</span></>}
      lead="For anyone who has looked at a bank statement and wondered where the month went. It started with that same question, right here in Mumbai."
      actions={<Button asChild variant="soft" size="xl"><a href="#our-story">Meet the story <ArrowRight /></a></Button>}
      aside={<div className="relative isolate mx-auto max-w-sm py-4"><Shape kind="arch" tone="--sage-soft" className="-z-10 inset-0 m-auto size-full" /><Mascot pose="welcome" eager className="float-y mx-auto w-52 sm:w-64" /><Doodle kind="leaf" className="bottom-10 right-2 size-10 text-forest/50" /><p className="mt-5 text-center text-sm font-semibold text-forest">A little more clarity. A little less worry.</p></div>} />

    <ProductProof />

    <section id="our-story" className="edge edge-arc relative z-[6] scroll-mt-24 bg-card py-16 sm:py-20">
      <div className="container-site">
        <Reveal className="max-w-3xl"><p className="text-eyebrow">The beginning</p><h2 className="text-section mt-3">One salary. One statement.<br />One surprisingly <Mark>hard</Mark> question.</h2><p className="mt-5 max-w-2xl text-lg text-muted-foreground">After his first few salaries, Akshat, an engineer from NMIMS Mumbai, wanted to know what he could actually spend before the next payday.</p></Reveal>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {[
            { title: "The question", body: "The balance was there. But bills, savings and everyday spending made the amount left for the month much less obvious.", detail: "What is still mine before payday?" },
            { title: "The frustration", body: "His statement buried the answer in transaction codes. Transfers to his own savings looked like spending, and spreadsheets took hours.", detail: "Money moved isn't always money spent." },
            { title: "The first version", body: "He built a reader that checks statement rows against the balance and keeps own-account transfers separate from real spending.", detail: "Start with the statement. Check every row." },
          ].map((step, i) => <Reveal as="li" key={step.title} delay={i * 100} className="relative border-t border-border pt-6"><span className="font-display text-sm font-bold text-forest">0{i + 1}</span><h3 className="mt-3 text-xl">{step.title}</h3><p className="mt-3 text-muted-foreground">{step.body}</p><p className="mt-5 text-sm font-semibold text-forest">{step.detail}</p></Reveal>)}
        </ol>
        <Reveal className="mt-14 grid items-center gap-6 border-t border-dashed border-border pt-8 md:grid-cols-[1fr_1.2fr]">
          <div><p className="text-eyebrow">From a code to a clear entry</p><p className="mt-3 break-all font-mono text-sm text-muted-foreground">UPI/DR/6312…/SWIGGY/YESB</p><p className="mt-2 text-xs text-muted-foreground">Illustrative statement entry, not a customer's data.</p></div>
          <div className="flex items-center justify-between gap-4 rounded-lg bg-accent p-5"><div><p className="font-semibold">Swiggy</p><p className="mt-1 text-sm text-muted-foreground">Food & dining · spending</p></div><p className="money shrink-0 font-semibold">{inr(420)}</p></div>
        </Reveal>
      </div>
    </section>

    <section className="edge edge-wave relative z-[5] overflow-hidden tint-sage py-16 sm:py-20">
      <Shape kind="leaf" tone="--sage-soft" className="-right-24 bottom-0 size-80 opacity-60" />
      <div className="container-site relative grid gap-8 lg:grid-cols-[.75fr_1.25fr]">
        <Reveal><p className="text-eyebrow">The person behind the product</p><h2 className="text-section mt-3">A founder-led beginning.<br />A very everyday <Mark>purpose</Mark>.</h2></Reveal>
        <Reveal delay={100}><p className="text-lg leading-relaxed">Akshat's starting point wasn't a complicated financial model. It was the wish to understand his own month without typing every purchase or treating every transfer as an expense.</p><p className="mt-4 text-muted-foreground">That purpose still shapes Wall·ette: make banking data readable, keep the checks visible, and leave the decisions with you. Akshat continues to lead the product. {COMPANY.operatorRelationship} {COMPANY.dataAccessNote}</p><div className="mt-6 border-l-2 border-primary pl-4"><p className="font-semibold">Akshat</p><p className="mt-1 text-sm text-muted-foreground">Founder · continues to lead Wall·ette</p></div><Button asChild variant="outline" size="pill" className="mt-6"><Link to="/contact">Get in touch <ArrowRight /></Link></Button></Reveal>
      </div>
    </section>

    <section className="edge edge-tilt relative z-[4] overflow-hidden bg-forest-gradient py-16 text-on-forest sm:py-20">
      <div className="container-site"><Reveal className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">Promises you can inspect</p><h2 className="text-section mt-3">Don't just take our word for it.</h2></Reveal>
        <div className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2">{PRINCIPLES.map((p, i) => <Reveal key={p.title} delay={i * 80} className="border-t border-on-forest/20 pt-6"><p.icon aria-hidden className="size-6 text-sage" /><h3 className="mt-4 text-xl">{p.title}</h3><p className="mt-3 max-w-lg text-on-forest/80">{p.body}</p><Link to={p.to} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-on-forest underline decoration-on-forest/40 underline-offset-4">{p.label}<ArrowRight className="size-4" /></Link></Reveal>)}</div>
      </div>
    </section>

    <section className="container-site grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
      <Reveal><p className="text-eyebrow">How we make money</p><h2 className="text-section mt-3">Subscriptions.<br />Not your financial data.</h2><p className="mt-5 max-w-xl text-muted-foreground">Essential and Plus subscriptions will fund Wall·ette once paid plans start; until then it’s free. No advertising and no selling financial data. Privacy, statement checks, data export and deletion belong on both plans.</p><Button asChild variant="soft" size="pill" className="mt-6"><Link to="/pricing">See Essential and Plus <ArrowRight /></Link></Button><p className="mt-8 max-w-xl text-sm text-muted-foreground">{COMPANY.nonAdvisory} <Link to="/disclaimer" className="font-semibold text-forest underline">Read the disclaimer</Link>.</p></Reveal>
      <Reveal delay={100} className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0"><h2 className="text-xl">Who runs Wall·ette</h2><dl className="mt-6 space-y-5 text-sm"><div><dt className="text-muted-foreground">Run by</dt><dd className="mt-1 font-semibold">{COMPANY.legalName}</dd></div><div><dt className="text-muted-foreground">Backing</dt><dd className="mt-1">{COMPANY.endorsement}. {COMPANY.dataAccessNote}</dd></div><div><dt className="text-muted-foreground">{COMPANY.grievanceTitle}</dt><dd className="mt-1 font-semibold">Mr. {COMPANY.grievanceOfficer}</dd></div><div><dt className="text-muted-foreground">Based in</dt><dd className="mt-1">{COMPANY.addressLines.map((line) => <span key={line} className="block">{line}</span>)}</dd></div><div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 break-all font-semibold"><a href={`mailto:${COMPANY.supportEmail}`} className="text-forest hover:underline">{COMPANY.supportEmail}</a></dd></div></dl></Reveal>
    </section>
    <CtaBand />
  </>;
}
