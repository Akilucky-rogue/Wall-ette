import type { BlogArticle } from "./blog";

const origin = "https://wall-ette.com";
export function blogHead({ title, description, path, image, article }: {
  title: string;
  description: string;
  path: string;
  image: string;
  article?: BlogArticle;
}) {
  const url = `${origin}${path}`;
  const absoluteImage = `${origin}${image}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: article ? "article" : "website" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: "Wall·ette" },
      { property: "og:locale", content: "en_IN" },
      { property: "og:image", content: absoluteImage },
      { property: "og:image:alt", content: article?.coverAlt ?? "Plain-language money guides from Wall·ette" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: absoluteImage },
      { name: "twitter:image:alt", content: article?.coverAlt ?? "Plain-language money guides from Wall·ette" },
      ...(article ? [
        { property: "article:published_time", content: article.publishedAt },
        { property: "article:section", content: article.category },
      ] : []),
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
export function articleJsonLd(article: BlogArticle) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.description,
      image: [`${origin}${article.cover}`],
      datePublished: article.publishedAt,
      author: { "@type": "Organization", name: "Wall·ette", url: origin },
      publisher: { "@type": "Organization", name: "Wall·ette", url: origin },
      mainEntityOfPage: { "@type": "WebPage", "@id": `${origin}/blog/${article.slug}` },
      articleSection: article.category,
      inLanguage: "en-IN",
      wordCount: article.wordCount,
      timeRequired: `PT${article.readTimeMinutes}M`,
      isAccessibleForFree: true,
    }).replace(/</g, "\\u003c"),
  };
}
