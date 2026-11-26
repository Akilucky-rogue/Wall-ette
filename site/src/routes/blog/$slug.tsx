import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Calendar, ChevronRight, Clock, ListOrdered, Share2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { breadcrumbJsonLd } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { BlogNewsletter } from "@/components/blog/BlogNewsletter";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { ARTICLE_CTA, articles, EDUCATIONAL_NOTE, formatBlogDate, getArticle } from "@/lib/blog";
import { metaFor } from "@/lib/blog-meta";
import { articleJsonLd, blogHead } from "@/lib/blog-seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    return article;
  },
  head: ({ loaderData: article }) => {
    if (!article) return { meta: [{ title: "Guide unavailable — Wall·ette" }, { name: "robots", content: "noindex" }] };
    return {
      ...blogHead({ title: `${article.title} — Wall·ette`, description: article.description, path: `/blog/${article.slug}`, image: article.cover, article }),
      scripts: [articleJsonLd(article), breadcrumbJsonLd([{ name: "Blog", path: "/blog" }, { name: article.title, path: `/blog/${article.slug}` }])],
    };
  },
  component: BlogArticlePage,
  notFoundComponent: () => (
    <section className="container-site pb-20 pt-32">
      <h1 className="text-section">That guide could not be found</h1>
      <p className="my-5 text-muted-foreground">Choose a guide from the Wall·ette blog instead.</p>
      <Button asChild variant="hero"><Link to="/blog">Browse all guides</Link></Button>
    </section>
  ),
});

function BlogArticlePage() {
  const article = Route.useLoaderData();
  const [active, setActive] = useState(article.sections[0]?.id ?? "");
  const related = articles.filter((a) => a.slug !== article.slug).sort((a, b) => Number(b.category === article.category) - Number(a.category === article.category)).slice(0, 3);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-30% 0px -60% 0px" });
    article.sections.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [article]);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: article.title, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* user cancelled */ }
  }

  return (
    <>
      <article className="container-site pb-4 pt-28 sm:pt-32">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-forest">Home</Link><ChevronRight className="size-3.5" />
          <Link to="/blog" className="hover:text-forest">Blog</Link><ChevronRight className="size-3.5" />
          <span aria-current="page" className="text-foreground">{article.category}</span>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="order-2 lg:order-1">
            <div className="space-y-5 lg:sticky lg:top-24">
              <img src={article.cover} alt={article.coverAlt} width={1200} height={675} fetchPriority="high" className="hidden aspect-video w-full rounded-2xl bg-sand object-cover lg:block" />
              <nav aria-label="Topic index" className="rounded-2xl border border-border bg-card p-5">
                <p className="flex items-center gap-2 font-semibold"><ListOrdered className="size-4 text-forest" />Topic index</p>
                <ol className="mt-4 space-y-1 text-sm">
                  {article.sections.map((s) => (
                    <li key={s.id}><a href={`#${s.id}`} className={cn("block border-l-2 py-1.5 pl-3 transition", active === s.id ? "border-forest font-medium text-forest" : "border-transparent text-muted-foreground hover:text-foreground")}>{s.title}</a></li>
                  ))}
                </ol>
              </nav>
            </div>
          </aside>

          <div className="order-1 min-w-0 lg:order-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-accent px-2.5 py-1 font-medium text-forest">{article.category}</span>
              <Link to="/blog" search={{ sub: metaFor(article.slug).sub }} className="rounded-md bg-muted px-2.5 py-1 text-muted-foreground hover:text-forest">{metaFor(article.slug).sub}</Link>
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl xl:text-5xl">{article.title}</h1>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" />Wall·ette Editorial</span>
                <span className="inline-flex items-center gap-1.5"><Calendar className="size-4" /><time dateTime={article.publishedAt}>{formatBlogDate(article.publishedAt)}</time></span>
                <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{article.readTimeMinutes} min read</span>
              </p>
              <Button variant="soft" size="sm" onClick={() => void share()}><Share2 className="size-4" />Share</Button>
            </div>
            <img src={article.cover} alt={article.coverAlt} width={1200} height={675} className="mt-6 aspect-video w-full rounded-2xl bg-sand object-cover lg:hidden" />
            <blockquote className="mt-7 border-l-4 border-forest/50 pl-5 text-lg italic leading-8 text-muted-foreground sm:text-xl">{article.description}</blockquote>

            <aside aria-labelledby="takeaways-heading" className="mt-8 rounded-2xl bg-sand p-6">
              <h2 id="takeaways-heading" className="font-display text-lg font-bold">Key takeaways</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">{article.keyTakeaways.map((t) => <li key={t}>{t}</li>)}</ul>
            </aside>

            <div className="mt-8 max-w-3xl space-y-5 text-[1.05rem] leading-8">{article.introduction.map((p, i) => <p key={i}>{p}</p>)}</div>
            {article.sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="mt-10 max-w-3xl scroll-mt-28">
                <h2 id={`${s.id}-heading`} className="border-b border-border pb-3 font-display text-2xl font-bold">{s.title}</h2>
                <div className="mt-5 space-y-5 text-[1.05rem] leading-8">{s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
              </section>
            ))}

            <p className="mt-10 flex flex-wrap gap-2 text-sm">{metaFor(article.slug).tags.map((t) => <Link key={t} to="/blog" search={{ tag: t }} className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:border-forest hover:text-forest">#{t}</Link>)}</p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
              <p className="font-medium">Turn a clearer picture into a calmer money routine.</p>
              <Link to="/signup" className="inline-flex items-center gap-1 font-semibold text-forest">{ARTICLE_CTA}<ArrowRight className="size-4" /></Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-muted-foreground"><strong>Disclaimer:</strong> {EDUCATIONAL_NOTE}</p>
          </div>
        </div>
      </article>

      <section aria-labelledby="related-heading" className="container-site pt-14">
        <div className="flex items-end justify-between gap-4"><h2 id="related-heading" className="text-section">Keep reading</h2><Link to="/blog" className="inline-flex items-center gap-1 font-semibold text-forest">All guides <ArrowRight className="size-4" /></Link></div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{related.map((a) => <ArticleCard key={a.slug} article={a} />)}</div>
      </section>
      <BlogNewsletter source={`blog-${article.slug}`} />
    </>
  );
}
