import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Doodle, Shape } from "./Decor";

export type Crumb = { label: string; to?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        <li><Link to="/" className="hover:text-foreground">Home</Link></li>
        {items.map((c) => (
          <li key={c.label} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            {c.to ? <a href={c.to} className="hover:text-foreground">{c.label}</a> : <span aria-current="page" className="text-foreground">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ crumbs, eyebrow, title, lead, actions, aside }: { crumbs: Crumb[]; eyebrow?: string; title: ReactNode; lead?: ReactNode; actions?: ReactNode; aside?: ReactNode }) {
  return (
    <section className="edge edge-wave relative z-[20] section-fit bg-hero overflow-clip">
      <Shape kind="burst" tone="--shape-sun" spin className="-right-16 top-[calc(var(--header-height)+1rem)] size-40 opacity-50 sm:size-56" />
      <Shape kind="leaf" tone="--sage-soft" className="-left-28 bottom-6 size-64 opacity-60" />
      <Doodle kind="spark" className="right-[38%] top-[calc(var(--header-height)+2rem)] hidden size-8 text-forest/35 lg:block" />
      <div className={cn("container-site relative grid items-center gap-10 pb-14 pt-[calc(var(--header-height)+2.5rem)] sm:pb-20 sm:pt-[calc(var(--header-height)+3.5rem)] lg:gap-16 [&>*]:min-w-0", aside ? "lg:grid-cols-[1.08fr_.92fr]" : "lg:grid-cols-1")}>
        <div className={cn("hero-enter", !aside && "max-w-4xl")}>
          <Breadcrumbs items={crumbs} />
          {eyebrow && <p className="text-eyebrow mt-7 sm:mt-8">{eyebrow}</p>}
          <h1 className="text-hero mt-3">{title}</h1>
          {lead && <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{lead}</p>}
          {actions && <div className="mt-7 flex flex-wrap gap-3 sm:mt-8">{actions}</div>}
        </div>
        {aside && <div className="hero-enter hero-aside mx-auto w-full max-w-xl lg:max-w-none">{aside}</div>}
      </div>
    </section>
  );
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [{ name: "Home", path: "/" }, ...items].map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        item: `https://wall-ette.com${it.path}`,
      })),
    }),
  };
}
