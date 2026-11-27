import { useState } from "react";
import { ArrowRight, CircleDollarSign, ExternalLink, Globe2, ListFilter, ShieldCheck, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ComparisonApp } from "@/lib/compare-model";
import { cn } from "@/lib/utils";
import { Mark } from "./Decor";

type Group = "all" | "cost" | "tracking" | "fit";
const TABS = [
  { id: "all", label: "All details", icon: ListFilter },
  { id: "cost", label: "Cost", icon: CircleDollarSign },
  { id: "tracking", label: "Tracking & privacy", icon: ShieldCheck },
  { id: "fit", label: "Fit & access", icon: Globe2 },
] as const;
const ROWS: { key: keyof ComparisonApp; label: string; group: Group }[] = [
  { key: "price", label: "Price & billing", group: "cost" },
  { key: "trial", label: "Trial & conditions", group: "cost" },
  { key: "tracking", label: "How money gets in", group: "tracking" },
  { key: "storage", label: "Where data lives", group: "tracking" },
  { key: "features", label: "Standout capabilities", group: "tracking" },
  { key: "kind", label: "Primary purpose", group: "fit" },
  { key: "origin", label: "Company / project origin", group: "fit" },
  { key: "countries", label: "Country & currency reach", group: "fit" },
  { key: "india", label: "For Indian accounts", group: "fit" },
  { key: "platforms", label: "Where you can use it", group: "fit" },
  { key: "fit", label: "Life stage & financial needs", group: "fit" },
  { key: "caveat", label: "Know before choosing", group: "fit" },
];

export function ComparisonView({ wallette, peers, selected, onChange }: {
  wallette: ComparisonApp;
  peers: ComparisonApp[];
  selected: [ComparisonApp, ComparisonApp];
  onChange: (first: string, second: string) => void;
}) {
  const [group, setGroup] = useState<Group>("all");
  const apps = [wallette, ...selected];
  return <>
    <section id="comparison" className="relative bg-background pb-16 pt-12 sm:pt-16">
      <div className="container-site">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-eyebrow">Your shortlist</p><h2 className="mt-3 text-section">Three apps. Your <Mark>priorities.</Mark></h2></div>
          <p className="max-w-sm text-sm text-muted-foreground">Research checked 26 November 2026. Prices stay in their original currency; taxes and store prices may vary.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2" aria-label="Comparison shortlists">
          {[
            { label: "Indian trackers", a: "fold", b: "axio" },
            { label: "Budget-first", a: "ynab", b: "actual-budget" },
            { label: "Across currencies", a: "lunch-money", b: "spendee" },
            { label: "Household & wealth", a: "monarch", b: "empower" },
          ].map(p => <Button key={p.label} variant="outline" size="sm" onClick={() => onChange(p.a, p.b)}>{p.label}<ArrowRight className="size-3.5" /></Button>)}
        </div>
      </div>
      <div className="sticky top-[var(--header-height)] z-30 mt-8 border-y border-border bg-background shadow-soft">
        <div className="container-site grid grid-cols-3 gap-2 py-4 sm:gap-6">
          <div className="flex min-w-0 flex-col justify-end"><span className="mb-1 text-xs text-muted-foreground">Your starting point</span><span className="flex items-center gap-2 py-2 font-display text-base font-bold text-forest sm:text-xl"><Wallet className="hidden size-5 sm:block" />Wall·ette</span></div>
          {selected.map((app, i) => <div key={i} className="min-w-0"><label htmlFor={`peer-${i}`} className="mb-1 block text-xs text-muted-foreground">Compare with {i + 1}</label><Select value={app.id} onValueChange={id => onChange(i === 0 ? id : selected[0].id, i === 1 ? id : selected[1].id)}><SelectTrigger id={`peer-${i}`} aria-label={`Comparison app ${i + 1}`} className="h-14 whitespace-normal bg-card px-2 text-left text-xs [&>span]:line-clamp-none sm:h-10 sm:px-3 sm:text-sm"><SelectValue /></SelectTrigger><SelectContent>{peers.map(peer => <SelectItem key={peer.id} value={peer.id} disabled={peer.id === selected[i === 0 ? 1 : 0].id}>{peer.name}{peer.status === "discontinued" ? " · discontinued" : peer.status === "unverified" ? " · unverified" : ""}</SelectItem>)}</SelectContent></Select></div>)}
        </div>
      </div>
      <div className="container-site">
        <div className="flex flex-wrap gap-x-4 border-b border-border pt-4 sm:gap-x-8" role="tablist" aria-label="Comparison details">
          {TABS.map(tab => <Button key={tab.id} role="tab" aria-selected={group === tab.id} variant="ghost" onClick={() => setGroup(tab.id)} className={cn("h-12 rounded-none border-b-2 px-0 text-xs sm:text-sm", group === tab.id ? "border-forest text-forest" : "border-transparent text-muted-foreground")}><tab.icon className="size-4" />{tab.label}</Button>)}
        </div>
        <div role="tabpanel" aria-label={`${TABS.find(t => t.id === group)?.label ?? "All details"} comparison`} className="mt-6" aria-live="polite">
          <div className="grid grid-cols-3 gap-2 sm:gap-6">
            {apps.map((app, i) => <div key={app.id} className={cn("min-w-0 rounded-lg p-3 sm:p-5", i === 0 ? "bg-forest-gradient text-on-forest" : "bg-card border border-border")}>
              <p className="font-display text-sm font-bold sm:text-xl">{app.name}</p>
              <p className={cn("mt-2 text-xs leading-relaxed sm:text-sm", i === 0 ? "text-on-forest" : "text-muted-foreground")}>{app.kind}</p>
              {app.status && <p className="mt-3 text-xs font-semibold">{app.status === "discontinued" ? "Historical — no longer available" : "Identity not confirmed"}</p>}
            </div>)}
          </div>
          <dl className="mt-4">
            {ROWS.filter(row => group === "all" || row.group === group).map(row => <div key={row.key} className="border-b border-border py-5">
              <dt className="mb-3 text-sm font-semibold">{row.label}</dt>
              <div className="grid grid-cols-3 gap-2 sm:gap-6">{apps.map((app, i) => <dd key={app.id} className={cn("min-w-0 break-words rounded-md px-2 py-3 text-xs leading-relaxed sm:px-4 sm:text-sm", i === 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground")}><span className="sr-only">{app.name}: </span>{String(app[row.key] ?? "Not verified")}</dd>)}</div>
            </div>)}
          </dl>
        </div>
      </div>
    </section>
    <section className="edge edge-arc tint-sage py-14 sm:py-20">
      <div className="container-site"><p className="text-eyebrow">No universal winner</p><h2 className="mt-3 text-section">Choose the fit, not the <Mark>hype.</Mark></h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">{apps.map(app => <article key={app.id} className="min-w-0 border-t-2 border-forest pt-5"><h3 className="text-xl">Consider {app.name} when…</h3><p className="mt-3 text-muted-foreground">{app.fit}</p><p className="mt-4 text-sm"><strong>The trade-off: </strong>{app.caveat}</p><div className="mt-5">{app.id === "wallette" ? <Button asChild variant="outline"><Link to="/features">Explore Wall·ette<ArrowRight className="size-4" /></Link></Button> : app.sources[0] && <Button asChild variant="outline"><a href={app.sources[0].url} target="_blank" rel="noopener noreferrer">Official site<ExternalLink className="size-4" /></a></Button>}</div></article>)}</div>
      </div>
    </section>
    <section className="container-site py-16">
      <h2 className="text-section">Sources & the small print</h2>
      <p className="mt-4 max-w-3xl text-muted-foreground">This comparison is published by Wall·ette, not an independent review. We use official product, pricing and help pages; missing information is marked “Not verified”, not treated as a missing feature. Needs-based audience descriptions are our editorial assessment, not provider age claims.</p>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">Country availability is not the same as bank connectivity. Local file processing is not the same as local-only transaction storage. Promotional prices are not standard renewal prices. Product names belong to their respective owners; no affiliation or endorsement is implied.</p>
      <div className="mt-8 grid gap-6 md:grid-cols-3">{apps.map(app => <div key={app.id} className="min-w-0"><h3 className="text-lg">{app.name}</h3><ul className="mt-3 space-y-2">{app.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-forest underline underline-offset-4">{source.label}<ExternalLink className="size-3 shrink-0" /></a></li>)}</ul>{app.sources.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Awaiting the correct product link; no claims made.</p>}</div>)}</div>
      <p className="mt-8 text-sm text-muted-foreground">Spotted something that changed? <Link to="/contact" className="text-forest underline">Send us the official source.</Link></p>
    </section>
  </>;
}