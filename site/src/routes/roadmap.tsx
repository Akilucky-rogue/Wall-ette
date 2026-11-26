import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PageHeader, breadcrumbJsonLd } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { Doodle, Mark, Shape } from "@/components/site/Decor";
import { CtaBand } from "@/components/site/CtaBand";
import { COMPANY } from "@/lib/site";
import { PhoneShot } from "@/components/site/PhoneShot";
import home from "@/assets/screen-home.webp.asset.json";

const PATH = "/roadmap";
const FAQ = [{"q": "Where can I use Wall·ette now?", "a": "The web app is live. Android is coming soon and iPhone is planned. Neither mobile status is a release date."}, {"q": "When will Android or iPhone launch?", "a": "No release date is promised here. Android is next; iPhone is planned for later. Priorities and scope may change."}, {"q": "Can I suggest a feature?", "a": "Yes. Contact us with the problem you want to solve, how you handle it today and the device or bank involved. Suggestions help us prioritise; submitting one does not guarantee delivery."}];
const STAGES = [
{ status: "Live", title: "Web", body: "Use Wall·ette in your browser today.", points: ["PDF and Excel statement import", "Vault and Pulse", "Flow, Rewind and left-to-spend planning"] },
{ status: "Next", title: "Android · coming soon", body: "Android is the next platform on the roadmap, not a currently available download.", points: ["Coming soon", "No launch date announced"] },
{ status: "Later", title: "iPhone · planned", body: "An iPhone app is planned for later. Timing and scope are not confirmed.", points: ["Planned, not released", "No App Store availability claimed"] },
];

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap: web live, Android next, iPhone planned — Wall·ette" },
      { name: "description", content: "See what is live in Wall·ette, what is coming next and what is planned for later. Web is live, Android is coming soon and iPhone is planned." },
      { property: "og:title", content: "Roadmap: web live, Android next, iPhone planned — Wall·ette" },
      { property: "og:description", content: "See what is live in Wall·ette, what is coming next and what is planned for later. Web is live, Android is coming soon and iPhone is planned." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${COMPANY.siteUrl}${PATH}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.siteUrl}${PATH}` }],
    scripts: [breadcrumbJsonLd([{ name: "Roadmap: web live, Android next, iPhone planned", path: PATH }]),
      { type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }) },
    ],
  }),
  component: Page,
});

function Page() {
  return <>
    <PageHeader crumbs={[{ label: "Roadmap" }]} eyebrow="Live · Next · Later" title={<>Built around your money. <span className="text-forest">Clear about what is next.</span></>} lead="The web app is live. Android is coming soon. iPhone is planned. This is a statement of direction, not a promise of release dates." actions={<><Start label="Start on the web" /><Button asChild variant="soft" size="xl"><Link to="/contact">Suggest a feature</Link></Button></>} aside={<PhoneShot src={home.url} alt="Sample Wall·ette Home interface; not a mobile-app release announcement" priority />} />
    <section className="edge edge-scallop relative z-[5] section-fit overflow-hidden tint-sage py-16"><div className="container-site relative"><h2 className="text-section">Where things <Mark>stand</Mark></h2><div className="relative mt-12 grid gap-8 lg:grid-cols-3"><div className="absolute left-8 right-8 top-8 hidden border-t-2 border-dashed border-forest/30 lg:block" aria-hidden />{STAGES.map((stage, i) => <Reveal key={stage.status} delay={i * 120} className={`relative rounded-[2.5rem_1.25rem_2.5rem_1.25rem] p-8 shadow-lift ${(["lg:-rotate-1", "lg:rotate-1", "lg:-rotate-[0.5deg]"] as const)[i] ?? ""} ${i === 0 ? "bg-forest-gradient text-on-forest" : "bg-card"}`}><span className="relative -mt-14 mb-4 grid size-14 place-items-center"><Shape kind={(["burst", "cloud", "pebble"] as const)[i] ?? "pebble"} tone={(["--shape-sun", "--shape-clay", "--sand"] as const)[i] ?? "--sand"} spin={i === 0} className="inset-0 size-full" /><span className="relative font-display font-bold text-forest-deep">{i + 1}</span></span><p className={i === 0 ? "text-xs font-semibold uppercase tracking-[0.16em] opacity-80" : "text-eyebrow"}>{stage.status}</p><h3 className="mt-3 text-2xl">{stage.title}</h3><p className="mt-4 opacity-80">{stage.body}</p><ul className="mt-6 space-y-3">{stage.points.map(point => <li key={point} className="border-t border-dashed border-current/20 pt-3">{point}</li>)}</ul></Reveal>)}</div><p className="mt-8 text-sm text-muted-foreground">Next and Later are planning categories. They do not guarantee availability, scope or a launch date. Screenshots show sample data, not evidence of a released native app.</p></div></section>
    <section className="container-site py-12"><Reveal className="relative overflow-hidden rounded-[3rem_1.5rem_3rem_1.5rem] tint-peach p-8 sm:p-12"><Shape kind="burst" tone="--shape-sun" spin className="-right-10 -top-10 size-40 opacity-60" /><Doodle kind="arrow" className="bottom-6 right-[20%] hidden size-14 text-forest/40 md:block" /><h2 className="text-section">Tell us the problem, not just the button.</h2><p className="mt-4 max-w-2xl text-muted-foreground">What are you trying to understand? What takes too long today? Include the bank or device involved, but do not send passwords, card details or unredacted statements. Suggestions inform priorities; they are not delivery commitments.</p><Button asChild variant="soft" size="xl" className="mt-6"><Link to="/contact">Suggest a feature</Link></Button></Reveal></section>
    <section className="container-site max-w-3xl py-16"><h2 className="text-section">Roadmap questions</h2><Questions items={FAQ} /></section>
    <CtaBand title="You do not have to wait for the web." body="The web app is live. Start with 30 days at ₹0; card or bank details required. Then Essential ₹49/month or ₹449/year; Plus ₹99/month or ₹899/year." cta="Start on the web" />
  </>;
}

function Questions({ items }: { items: { q: string; a: string }[] }) {
  return <Accordion type="multiple" className="mt-6">{items.map(f => <AccordionItem key={f.q} value={f.q}><AccordionTrigger className="text-left">{f.q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{f.a}</AccordionContent></AccordionItem>)}</Accordion>;
}
function Start({ label }: { label: string }) {
  return <Button asChild variant="hero" size="xl"><Link to="/signup">{label}</Link></Button>;
}
