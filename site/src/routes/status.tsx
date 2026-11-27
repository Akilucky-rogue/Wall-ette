import { createFileRoute, Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, Mail, ShieldCheck } from "lucide-react";
import { SERVICE_STATUS } from "@/lib/status-data";
import { Shape } from "@/components/site/Decor";
import { PageHeader, breadcrumbJsonLd } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { CtaBand } from "@/components/site/CtaBand";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/site";

const PATH = "/status";

const STATUS_LABELS: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Maintenance",
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Service status and incident history — Wall·ette" },
      { name: "description", content: "Check the current reported status of Wall·ette’s website, statement imports, saved data and messages, plus published incident updates." },
      { property: "og:title", content: "Wall·ette service status" },
      { property: "og:description", content: "Current service reports, ongoing incidents and resolution updates for Wall·ette." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${COMPANY.siteUrl}${PATH}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.siteUrl}${PATH}` }],
    scripts: [breadcrumbJsonLd([{ name: "Status", path: PATH }])],
  }),
  component: StatusPage,
  errorComponent: StatusError,
  notFoundComponent: () => <div className="container-site py-32">Status page not found.</div>,
});

function StatusError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return <div className="container-site max-w-2xl py-32 pt-40" role="alert"><AlertTriangle className="size-8 text-destructive" /><h1 className="text-section mt-5">We couldn’t load service status.</h1><p className="mt-4 text-muted-foreground">{error instanceof Error ? error.message : "Service status is temporarily unavailable"}. You can still report a problem to {COMPANY.supportEmail}.</p><Button variant="hero" size="xl" className="mt-6" onClick={() => void router.invalidate()}>Try again</Button></div>;
}

function StatusPage() {
  const data = SERVICE_STATUS;
  const allOperational = data.components.every((component) => component.status === "operational");
  const latestReport = data.components.map((component) => component.updated_at).sort().at(-1) ?? data.refreshedAt;
  const active = data.incidents.filter((incident) => incident.status !== "resolved");

  return <>
    <PageHeader crumbs={[{ label: "Status" }]} eyebrow="Service status" title={<>What’s working. <span className="text-forest">What we’re fixing.</span></>} lead="Current service reports and straightforward incident updates for Wall·ette. No invented uptime percentages or hidden incident notes." actions={<Button asChild variant="soft" size="xl"><Link to="/contact">Report a problem <ArrowRight /></Link></Button>} aside={<Reveal className="relative isolate py-6"><Shape kind="pebble" tone="--sage-soft" className="-z-10 -inset-4 size-[calc(100%+2rem)]" /><div className="rounded-[2rem_1rem_2rem_1rem] bg-card p-7 shadow-lift"><div className="flex items-center gap-3"><span className="relative flex size-3"><span className={`absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden ${allOperational ? "bg-forest" : "bg-destructive"}`} /><span className={`relative size-3 rounded-full ${allOperational ? "bg-forest" : "bg-destructive"}`} aria-hidden /></span><p className="font-display text-xl font-bold">{allOperational ? "All systems operational" : "Some systems need attention"}</p></div><p className="mt-3 text-sm text-muted-foreground">Latest component report: {formatDate(latestReport)}</p><p className="mt-1 text-xs text-muted-foreground">Published by hand when something changes; there is no automatic monitoring.</p></div></Reveal>} />

    <section className="section-fit container-site py-14" aria-labelledby="components-title">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-eyebrow">Right now</p><h2 id="components-title" className="text-section mt-2">Service components</h2></div><p className="max-w-md text-sm text-muted-foreground">These reports are published by hand when something changes. They are not automatic uptime monitoring.</p></div>
      <div className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-soft">{data.components.map((component) => <div key={component.slug} className="flex flex-col gap-3 border-b border-border p-5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h3 className="font-display text-lg font-bold">{component.name}</h3><p className="mt-1 text-sm text-muted-foreground">{component.description}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`size-2.5 rounded-full ${component.status === "operational" ? "bg-forest" : "bg-destructive"}`} aria-hidden /><span className="text-sm font-semibold">{STATUS_LABELS[component.status] ?? component.status}</span></div></div>)}</div>
    </section>

    <section className="edge edge-arc relative z-[4] bg-sand py-16" aria-labelledby="incidents-title">
      <div className="container-site">
        <div className="flex items-center gap-3"><Activity className="size-6 text-forest" aria-hidden /><h2 id="incidents-title" className="text-section">Incident history</h2></div>
        <p className="mt-3 max-w-2xl text-muted-foreground">When something goes wrong, we publish what is affected, what we know and when the next update arrives.</p>
        {active.length > 0 && <p className="mt-5 inline-flex rounded-full bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive">{active.length} active {active.length === 1 ? "incident" : "incidents"}</p>}
        {data.incidents.length === 0 ? <Reveal className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-soft"><CheckCircle2 className="mx-auto size-8 text-forest" /><h3 className="mt-4 text-xl">No incidents have been published.</h3><p className="mt-2 text-muted-foreground">There is no incident history to show yet. This is not a claim of uninterrupted historical uptime.</p></Reveal> : <div className="mt-8 space-y-5">{data.incidents.map((incident) => <article key={incident.id} className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8"><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-forest">{STATUS_LABELS[incident.status] ?? incident.status}</span><span className="text-sm text-muted-foreground">Started {formatDate(incident.started_at)}</span></div><h3 className="mt-4 text-2xl">{incident.title}</h3><p className="mt-3 text-muted-foreground">{incident.summary}</p>{incident.updates.length > 0 && <ol className="mt-6 space-y-4 border-l border-border pl-5">{incident.updates.map((update) => <li key={`${update.created_at}-${update.status}`}><p className="text-sm font-semibold">{STATUS_LABELS[update.status] ?? update.status} · {formatDate(update.created_at)}</p><p className="mt-1 text-sm text-muted-foreground">{update.message}</p></li>)}</ol>}{incident.resolved_at && <p className="mt-5 text-sm text-forest">Resolved {formatDate(incident.resolved_at)}</p>}</article>)}</div>}
      </div>
    </section>

    <section className="container-site grid gap-6 py-16 md:grid-cols-3">
      {[{ icon: ShieldCheck, title: "Clear impact", text: "Which feature is affected, whether your saved data is at risk and any workaround you can use." }, { icon: Clock3, title: "Dated updates", text: "Investigating, identified, monitoring and resolved — with timestamps rather than vague assurances." }, { icon: Mail, title: "A human route", text: "If your experience differs from this page, contact support. Do not include passwords, OTPs or statements." }].map((item, index) => <Reveal key={item.title} delay={index * 80} className="rounded-3xl border border-border bg-card p-6"><item.icon className="size-6 text-forest" /><h3 className="mt-4 text-xl">{item.title}</h3><p className="mt-2 text-sm text-muted-foreground">{item.text}</p></Reveal>)}
    </section>

    <CtaBand title="A clearer service, with a clear status." body={`Check this page whenever something seems wrong. If your experience differs, email ${COMPANY.supportEmail}; never include passwords, card details or unredacted statements.`} cta="Start your free month" />
  </>;
}
