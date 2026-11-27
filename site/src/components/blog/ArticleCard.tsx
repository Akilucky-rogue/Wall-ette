import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Calendar } from "lucide-react";
import { formatBlogDate, type BlogArticle } from "@/lib/blog";
import { metaFor } from "@/lib/blog-meta";

export function ArticleCard({ article, priority = false }: { article: BlogArticle; priority?: boolean }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-[1.75rem_0.75rem_1.75rem_0.75rem] bg-card shadow-soft transition hover:-translate-y-1 hover:rotate-[-0.4deg] hover:shadow-soft">
      <Link to="/blog/$slug" params={{ slug: article.slug }} tabIndex={-1} aria-hidden="true" className="block overflow-hidden">
        <img src={article.cover} alt="" width={1200} height={675} loading={priority ? "eager" : "lazy"} className="aspect-video w-full bg-sand object-cover transition duration-500 group-hover:scale-[1.03]" />
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground"><BookOpen className="size-3" />{article.readTimeMinutes} min read</span>
          <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">{article.category}</span>
          <Link to="/blog" search={{ sub: metaFor(article.slug).sub }} className="rounded-md bg-accent px-2 py-1 font-medium text-forest hover:underline">{metaFor(article.slug).sub}</Link>
        </div>
        <h3 className="mt-4 font-display text-lg font-bold leading-snug sm:text-xl"><Link to="/blog/$slug" params={{ slug: article.slug }} className="hover:text-forest">{article.title}</Link></h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{article.description}</p>
        <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{metaFor(article.slug).tags.map((t) => <Link key={t} to="/blog" search={{ tag: t }} className="hover:text-forest hover:underline">#{t}</Link>)}</p>
        <div className="mt-auto flex items-center justify-between text-sm"><div className="mt-5 flex w-full items-center justify-between border-t border-border">
          <span className="inline-flex items-center gap-1.5 pt-4 text-muted-foreground"><Calendar className="size-3.5" /><time dateTime={article.publishedAt}>{formatBlogDate(article.publishedAt)}</time></span>
          <Link to="/blog/$slug" params={{ slug: article.slug }} className="inline-flex items-center gap-1 pt-4 font-semibold text-forest" aria-label={`Read ${article.title}`}>Read <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></Link>
        </div></div>
      </div>
    </article>
  );
}
