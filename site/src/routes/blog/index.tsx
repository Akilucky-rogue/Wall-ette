import { useMemo, useState } from "react";
import { Doodle, Mark, Shape } from "@/components/site/Decor";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { metaFor } from "@/lib/blog-meta";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { breadcrumbJsonLd } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { BlogNewsletter } from "@/components/blog/BlogNewsletter";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { CalendarArchive } from "@/components/blog/CalendarArchive";
import { articles, BLOG_CATEGORIES, featuredArticle, type BlogCategory } from "@/lib/blog";
import { blogHead } from "@/lib/blog-seo";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

export const Route = createFileRoute("/blog/")({
  validateSearch: (s: Record<string, unknown>): { type?: string; cat?: string; sub?: string; tag?: string; date?: string } => ({
    ...(typeof s["type"] === "string" ? { type: s["type"] } : {}),
    ...(typeof s["cat"] === "string" ? { cat: s["cat"] } : {}),
    ...(typeof s["sub"] === "string" ? { sub: s["sub"] } : {}),
    ...(typeof s["tag"] === "string" ? { tag: s["tag"] } : {}),
    ...(typeof s["date"] === "string" ? { date: s["date"] } : {}),
  }),
  head: () => ({
    ...blogHead({
      title: "Money guides for everyday India — Wall·ette Blog",
      description: "Understand bank statements, salary cash flow, UPI spending and household budgets with practical, plain-language guides from Wall·ette.",
      path: "/blog",
      image: featuredArticle.cover,
    }),
    scripts: [breadcrumbJsonLd([{ name: "Blog", path: "/blog" }])],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const search = Route.useSearch();
  const { sub, tag, date } = search;
  const type = search.type ?? "All";
  const category = (BLOG_CATEGORIES as readonly string[]).includes(search.cat ?? "") ? (search.cat as BlogCategory) : "All";
  const navigate = useNavigate({ from: "/blog/" });
  type F = { type?: string; cat?: string; sub?: string; tag?: string; date?: string };
  const setFilter = (next: F) => { setPage(1); void navigate({ search: next, resetScroll: false }); };
  const base: F = { ...(type !== "All" ? { type } : {}), ...(category !== "All" ? { cat: category } : {}) };
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), []);
  // All current guides are written reads; Watch and Listen will fill in as media is published.
  const typeOf = (_a: (typeof articles)[number]) => "Read";
  const byType = sorted.filter((a) => type === "All" || typeOf(a) === type);
  const byCat = byType.filter((a) => category === "All" || a.category === category);
  const filtered = byCat.filter((a) => (!sub || metaFor(a.slug).sub === sub) && (!tag || metaFor(a.slug).tags.includes(tag)) && (!date || a.publishedAt === date) && a.title.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const subs = [...new Set(byCat.map((a) => metaFor(a.slug).sub))];
  const tags = [...new Set(byCat.flatMap((a) => metaFor(a.slug).tags))].sort();
  const selectCls = "h-11 w-full appearance-none rounded-xl border border-input bg-card pl-3.5 pr-9 text-sm font-medium outline-none focus:ring-2 focus:ring-ring";
  const pills: { label: string; clear: F }[] = [
    ...(type !== "All" ? [{ label: type, clear: category !== "All" ? { cat: category } : {} }] : []),
    ...(category !== "All" ? [{ label: category, clear: { ...(type !== "All" ? { type } : {}) } }] : []),
    ...(sub ? [{ label: sub, clear: base }] : []),
    ...(tag ? [{ label: `#${tag}`, clear: base }] : []),
    ...(date ? [{ label: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), clear: base }] : []),
  ];
  const tagCount = (t: string) => articles.filter((a) => metaFor(a.slug).tags.includes(t)).length;
  const dateLabel = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const searchField = (id: string) => (
    <label className="relative block">
      <span className="sr-only">Search guides by title</span>
      <Search aria-hidden="true" className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input id={id} type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search guides by title" className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </label>
  );

  return (
    <>
      <section className="edge edge-wave relative z-[20] overflow-hidden bg-gradient-to-br from-background via-sand/60 to-accent/50 pb-10 pt-28 sm:pt-32">
        <Shape kind="burst" tone="--shape-sun" spin className="-right-12 top-20 hidden size-48 opacity-60 md:block" />
        <Shape kind="leaf" tone="--sage-soft" className="right-48 top-36 hidden size-28 opacity-70 lg:block" />
        <Doodle kind="receipt" className="right-[30%] top-28 hidden size-10 text-forest/35 lg:block" />
        <div className="container-site relative">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground"><Link to="/" className="hover:text-forest">Home</Link><ChevronRight className="size-3.5" /><span aria-current="page" className="text-foreground">Blog</span></nav>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl">Make sense of your <span className="text-forest"><Mark>everyday</Mark> money</span></h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">Bank statements, cash flow, budgets and money routines — plain-language guides for Indian households, organised so you can find what matters.</p>
        </div>
      </section>

      <div className="sticky top-[var(--header-height)] z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="container-site py-3">
          <div role="group" aria-label="Filter guides" className="grid gap-2 sm:grid-cols-3 sm:gap-3">
            {[
              { id: "f-type", label: "Type", value: type, opts: ["All", "Read", "Watch", "Listen"].map((t) => { const n = sorted.filter((a) => t === "All" || typeOf(a) === t).length; return { v: t, l: t === "All" ? "All types" : n ? `${t} (${n})` : `${t} — coming soon`, off: !n }; }), on: (v: string) => setFilter({ ...(v !== "All" ? { type: v } : {}), ...(category !== "All" ? { cat: category } : {}) }) },
              { id: "f-cat", label: "Category", value: category, opts: ["All", ...BLOG_CATEGORIES].map((c) => { const n = byType.filter((a) => c === "All" || a.category === c).length; return { v: c, l: c === "All" ? "All categories" : `${c} (${n})`, off: !n }; }), on: (v: string) => setFilter({ ...(type !== "All" ? { type } : {}), ...(v !== "All" ? { cat: v } : {}) }) },
              { id: "f-sub", label: "Sub-category", value: sub ?? "All", opts: ["All", ...subs].map((x) => ({ v: x, l: x === "All" ? "All sub-categories" : `${x} (${byCat.filter((a) => metaFor(a.slug).sub === x).length})`, off: false })), on: (v: string) => setFilter({ ...base, ...(v !== "All" ? { sub: v } : {}) }) },
            ].map((f) => (
              <label key={f.id} htmlFor={f.id} className="relative block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground max-sm:sr-only">{f.label}</span>
                <span className="relative block">
                  <select id={f.id} value={f.value} onChange={(e) => f.on(e.target.value)} className={selectCls} aria-label={f.label}>
                    {f.opts.map((o) => <option key={o.v} value={o.v} disabled={o.off}>{o.l}</option>)}
                  </select>
                  <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </span>
              </label>
            ))}
          </div>
          {pills.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {pills.map((p) => <button key={p.label} onClick={() => setFilter(p.clear)} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm text-forest">{p.label}<X className="size-3.5" /><span className="sr-only">Remove filter</span></button>)}
              <button onClick={() => setFilter({})} className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-forest hover:underline">Clear all</button>
            </div>
          )}
        </div>
      </div>

      <section aria-label="Guides" className="container-site py-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="lg:hidden">{searchField("search-mobile")}</div>
            <p role="status" aria-live="polite" className="mb-5 mt-5 text-sm text-muted-foreground">
              {filtered.length ? `Showing ${(current - 1) * PAGE_SIZE + 1}–${(current - 1) * PAGE_SIZE + shown.length} of ${filtered.length}` : "No guides match that search."}
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              {shown.map((a, i) => <ArticleCard key={a.slug} article={a} priority={i < 2} />)}
            </div>
            {pages > 1 && (
              <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <Button key={n} size="sm" variant={n === current ? "hero" : "soft"} aria-current={n === current ? "page" : undefined} onClick={() => setPage(n)}>{n}</Button>)}
              </nav>
            )}
          </div>

          <aside aria-label="Blog tools" className="space-y-5 lg:sticky lg:top-[calc(var(--header-height)+9.5rem)] lg:self-start">
            <div className="hidden rounded-2xl border border-border bg-card p-5 lg:block">
              <h2 className="font-display text-base font-semibold">Search guides</h2>
              <div className="mt-3">{searchField("search-sidebar")}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-base font-semibold">Browse by date</h2>
              <div className="mt-3"><CalendarArchive dates={articles.map((a) => a.publishedAt)} selected={date} onSelect={(d) => setFilter(d ? { ...base, date: d } : base)} /></div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-base font-semibold">Browse by tag</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((t) => <button key={t} onClick={() => setFilter(tag === t ? base : { ...base, tag: t })} aria-pressed={tag === t} className={cn("rounded-full border px-3 py-1 text-sm transition", tag === t ? "border-forest bg-accent text-forest" : "border-border text-muted-foreground hover:text-forest")}>#{t}<span className="ml-1 text-xs opacity-70">{tagCount(t)}</span></button>)}
              </div>
            </div>
          </aside>
        </div>
      </section>
      <BlogNewsletter source="blog-index" />
    </>
  );
}
