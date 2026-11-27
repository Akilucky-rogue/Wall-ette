import { createFileRoute, Link } from "@tanstack/react-router";
import { Gift, GraduationCap, Users } from "lucide-react";
import { PageHeader, breadcrumbJsonLd } from "@/components/site/PageHeader";
import { SectionTabs } from "@/components/site/SectionTabs";
import { Reveal } from "@/components/site/Reveal";
import { Doodle, Mark, Shape } from "@/components/site/Decor";
import { CtaBand } from "@/components/site/CtaBand";
import { Mascot } from "@/components/site/Mascot";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ReferralPanel } from "@/components/spread/ReferralPanel";
import { InstitutionRequestForm, StudentPanel } from "@/components/spread/StudentPanel";
import { GiftPanel } from "@/components/spread/GiftPanel";
import { COMPANY } from "@/lib/site";
import { GIFT_DISCOUNTS, REFERRAL_REWARD, STUDENT_OFFER } from "@/lib/programs";

const PATH = "/spread";
const SPREAD_TABS = [
  { id: "refer", label: "Refer friends", icon: Users },
  { id: "students", label: "Students & institutions", icon: GraduationCap },
  { id: "gift", label: "Gift subscriptions", icon: Gift },
] as const;
const FAQ = [
  { q: "When does a referral qualify?", a: `A referral is recorded when a new member applies a valid code. The referrer and friend each become eligible for ${REFERRAL_REWARD.freeMonths} month of their own current Essential or Plus plan after ${REFERRAL_REWARD.qualifiesAfter}. Plus members are never moved to Essential for this reward. Self-referrals and repeat redemptions do not qualify.` },
  { q: "Does a referral add to the first free month?", a: "No. The referral reward does not stack with the new-member trial. Referrals open when paid plans start; the reward follows the friend’s first paid month." },
  { q: "How does student verification work in India?", a: `Students aged ${STUDENT_OFFER.minimumAge}+ can verify with an institution-issued email, a unique single-use code from a partner institution, or an assisted review. Approved Essential access lasts until the verified course end date, with eligibility checked every ${STUDENT_OFFER.verificationIntervalMonths} months. Approval is manual, not guaranteed by submitting the form.` },
  { q: "Can a school or college distribute codes?", a: "Yes. An authorised representative can request a batch using an official email. After the institution is verified, unique per-student codes avoid collecting a spreadsheet of student IDs. Under-18 account access is not currently open." },
  { q: "How do gift subscriptions work?", a: "Choose annual Essential or Plus and the number of gifts. We confirm the final price, payment and delivery before purchase. Each recipient receives a unique code; do not send recipient lists or card details through the request form." },
  { q: "Can I gift just one subscription?", a: `Yes. One annual gift receives the published ${GIFT_DISCOUNTS[0].label} discount. Larger quantities receive ${GIFT_DISCOUNTS[1].label} for 5–19 and ${GIFT_DISCOUNTS[2].label} for 20 or more, before applicable taxes.` },
];

export const Route = createFileRoute("/spread")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } => ({ ...(typeof search["ref"] === "string" ? { ref: search["ref"] } : {}) }),
  head: () => ({
    meta: [
      { title: "Spread Wall·ette — referrals, student access and gifts" },
      { name: "description", content: "Refer friends with your own code, apply for Essential through your verified course, partner as an institution, or request discounted annual Wall·ette gifts." },
      { property: "og:title", content: "Spread Wall·ette — share something useful" },
      { property: "og:description", content: "Referral rewards, Essential through a verified student’s course, institution codes and annual gift subscriptions." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${COMPANY.siteUrl}${PATH}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.siteUrl}${PATH}` }],
    scripts: [breadcrumbJsonLd([{ name: "Spread", path: PATH }]), { type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) }) }],
  }),
  component: SpreadPage,
});

function SpreadPage() {
  const { ref = "" } = Route.useSearch();
  return <>
    <PageHeader crumbs={[{ label: "Spread" }]} eyebrow="Refer · Students · Gift" title={<>Good money habits <span className="text-forest">are better shared.</span></>} lead="Invite a friend, make verified student access easier, or gift someone a clearer year with their money." actions={<><Button asChild variant="hero" size="xl"><a href="#refer">How referrals work</a></Button><Button asChild variant="soft" size="xl"><a href="#gift">Gifts</a></Button></>} aside={<Reveal className="relative isolate mx-auto w-full max-w-md py-6">
      <Shape kind="pebble" tone="--sage-soft" className="-z-10 -inset-6 size-[calc(100%+3rem)]" />
      <Doodle kind="leaf" className="-right-2 -top-2 size-10 text-forest/50" />
      <div className="space-y-4">{[{ icon: Users, title: "Refer", text: "One month of each person’s own plan after the friend’s first paid month.", kind: "pebble", tone: "--shape-sun", r: -2 }, { icon: GraduationCap, title: "Students", text: "Essential through the verified course, with annual checks; currently 18+.", kind: "cloud", tone: "--shape-clay", r: 1.5 }, { icon: Gift, title: "Gift", text: "Annual Essential or Plus with 5–15% volume discounts.", kind: "burst", tone: "--sage-soft", r: -1 }].map((item) => <div key={item.title} style={{ transform: `rotate(${item.r}deg)` }} className="flex gap-4 rounded-[1.5rem_0.75rem_1.5rem_0.75rem] bg-card p-4 shadow-lift transition-transform hover:!rotate-0"><span className="relative grid size-12 shrink-0 place-items-center"><Shape kind={item.kind as "pebble"} tone={item.tone} className="inset-0 size-full" /><item.icon className="relative size-5 text-forest" /></span><div><p className="font-semibold">{item.title}</p><p className="text-sm text-muted-foreground">{item.text}</p></div></div>)}</div>
    </Reveal>} />

    <SectionTabs label="Spread sections" items={SPREAD_TABS} />

    <section id="refer" className="edge edge-wave relative z-[4] section-fit scroll-mt-36 overflow-hidden tint-sage py-16 sm:py-20" aria-labelledby="refer-title"><Shape kind="burst" tone="--shape-sun" spin className="-right-16 top-10 size-48 opacity-60" /><Doodle kind="arrow" className="right-[18%] top-28 hidden size-12 text-forest/40 lg:block" /><div className="container-site relative"><div className="max-w-3xl"><p className="text-eyebrow">For existing members</p><h2 id="refer-title" className="text-section mt-3">Share your <Mark>code</Mark>. Share a clearer month.</h2><p className="mt-4 text-muted-foreground">Your friend still receives the standard new-member trial. After their first paid month, you each qualify for one month of your own current Essential or Plus plan — Plus members keep Plus. It is not cash, a bank reward or another trial stacked on top.</p></div><div className="mt-8"><ReferralPanel initialCode={ref} /></div><p className="mt-5 text-sm text-muted-foreground">Referrals, student access and gifts open when paid plans start. Until then Wall·ette is free for everyone.</p></div></section>

    <section id="students" className="edge edge-scallop relative z-[3] section-fit scroll-mt-36 overflow-hidden tint-sand py-16 sm:py-20" aria-labelledby="students-title"><Shape kind="arch" tone="--shape-sun" className="-left-24 bottom-20 size-72 opacity-50" /><Doodle kind="spark" className="right-[10%] top-24 hidden size-10 text-forest/40 md:block" /><div className="container-site relative"><div className="max-w-3xl"><p className="text-eyebrow">Verified students · {STUDENT_OFFER.minimumAge}+</p><h2 id="students-title" className="text-section mt-3">Learn your own money through your <Mark>course</Mark>.</h2><p className="mt-4 text-muted-foreground">Eligible students receive {STUDENT_OFFER.plan} until their verified course end date, with an eligibility check every {STUDENT_OFFER.verificationIntervalMonths} months and no card required during approved access. This is a course-linked student programme, not a permanent free plan.</p></div><div className="mt-8"><StudentPanel /></div><Reveal className="relative mt-12 overflow-hidden rounded-[2.5rem_1.25rem_2.5rem_1.25rem] bg-forest-gradient p-6 text-on-forest shadow-lift sm:p-10"><Shape kind="leaf" tone="--forest-deep" className="-bottom-20 -right-16 size-72 opacity-30" /><div className="relative"><p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">For colleges and schools</p><h3 className="mt-3 text-2xl">Bring Wall·ette to your students — without sending us their ID cards.</h3><p className="mt-3 max-w-3xl opacity-80">An authorised administrator verifies the institution, requests unique per-student codes and distributes them directly. We can review the arrangement before any codes are issued. Under-18 accounts are not open yet.</p><div className="mt-2 rounded-[1.5rem] bg-card p-4 text-foreground sm:p-6"><InstitutionRequestForm /></div></div></Reveal></div></section>

    <section id="gift" className="section-fit relative scroll-mt-36 py-16 sm:py-20" aria-labelledby="gift-title"><div className="container-site relative"><div className="grid items-center gap-6 md:grid-cols-[1fr_12rem]"><div className="max-w-3xl"><p className="text-eyebrow">One gift or a whole batch</p><h2 id="gift-title" className="text-section mt-3">Give someone a clearer <Mark>year</Mark>.</h2><p className="mt-4 text-muted-foreground">Choose prepaid annual Essential or Plus. Buy for one person or request unique codes for a team, family, college group or community.</p></div><div className="relative isolate"><Shape kind="pebble" tone="--sage-soft" className="-z-10 inset-0 m-auto size-full" /><Mascot pose="gift" className="mx-auto w-28 md:w-40" /></div></div>
      <div className="mt-12 grid grid-cols-3 gap-4 sm:gap-8">{GIFT_DISCOUNTS.map((tier, i) => <Reveal key={tier.label} delay={i * 120} className="relative isolate grid place-items-center py-6 text-center"><Shape kind="burst" tone={(["--sage-soft", "--shape-sun", "--shape-clay"] as const)[i] ?? "--sage-soft"} spin className="-z-10 inset-0 m-auto size-full max-w-48" /><div style={{ transform: `rotate(${[-4, 2, -2][i] ?? 0}deg)` }}><p className="money font-display text-3xl font-bold text-forest sm:text-5xl">{tier.label}</p><p className="mt-1 text-xs font-semibold sm:text-sm">{tier.minimum}–{tier.maximum ?? "∞"} gifts</p></div></Reveal>)}</div>
      <div className="mt-10"><GiftPanel /></div></div></section>
    <section className="container-site max-w-3xl py-16"><h2 className="text-section">Spread questions</h2><Accordion type="multiple" className="mt-6">{FAQ.map((item) => <AccordionItem key={item.q} value={item.q}><AccordionTrigger className="text-left">{item.q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{item.a}</AccordionContent></AccordionItem>)}</Accordion><p className="mt-6 text-muted-foreground">Something unusual to arrange? <Link to="/contact" className="font-semibold text-forest underline">Talk to us</Link>.</p></section>
    <CtaBand title="Start with your own money. Then share the clarity." body="Wall·ette is free while paid plans are set up. Referrals, student access and gifts open with them." cta="Create your wallet" />
  </>;
}
