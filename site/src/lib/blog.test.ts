import { describe, expect, it } from "vitest";
import { articles, ARTICLE_CTA, BLOG_CATEGORIES, getArticle } from "./blog";
import { articleJsonLd, blogHead } from "./blog-seo";

const slugs = ["read-bank-statement", "salary-cash-flow", "50-30-20-budget-india", "family-transfers", "left-to-spend", "hidden-subscriptions", "upi-spending", "password-protected-statements", "emergency-fund-salary", "monthly-money-check-in"];
describe("static blog content", () => {
  it("contains exactly the ten requested substantial articles", () => {
    expect(articles.map((article) => article.slug)).toEqual(slugs);
    expect(new Set(articles.map((article) => article.title)).size).toBe(10);
    expect(new Set(articles.map((article) => article.description)).size).toBe(10);
    for (const article of articles) {
      expect(article.wordCount).toBeGreaterThanOrEqual(900);
      expect(article.wordCount).toBeLessThanOrEqual(1200);
      expect(article.readTimeMinutes).toBe(Math.ceil(article.wordCount / 200));
      expect(article.cover).toBe(`/covers/${article.slug}.webp`);
      expect(article.coverAlt.length).toBeGreaterThan(20);
      expect(BLOG_CATEGORIES).toContain(article.category);
      expect(Number.isNaN(Date.parse(article.publishedAt))).toBe(false);
      expect(article.keyTakeaways.length).toBeGreaterThanOrEqual(3);
      expect(new Set(article.sections.map((section) => section.id)).size).toBe(article.sections.length);
      expect(getArticle(article.slug)).toBe(article);
    }
  });
  it("returns no article for unknown or inherited property names", () => {
    for (const slug of ["unknown", "toString", "__proto__", "READ-BANK-STATEMENT"]) expect(getArticle(slug)).toBeUndefined();
    expect(ARTICLE_CTA).toBe("Track this automatically — first month free");
  });
  it("provides absolute leaf metadata and valid structured data", () => {
    for (const article of articles) {
      const head = blogHead({ title: article.title, description: article.description, path: `/blog/${article.slug}`, image: article.cover, article });
      expect(head.links[0]?.href).toBe(`https://wall-ette.com/blog/${article.slug}`);
      expect(head.meta).toContainEqual({ property: "og:type", content: "article" });
      expect(head.meta).toContainEqual({ property: "og:image", content: `https://wall-ette.com/covers/${article.slug}.webp` });
      expect(head.meta).toContainEqual({ name: "twitter:image", content: `https://wall-ette.com/covers/${article.slug}.webp` });
      expect(head.meta).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
      const schema = JSON.parse(articleJsonLd(article).children);
      expect(schema["@type"]).toBe("Article");
      expect(schema.headline).toBe(article.title);
    }
  });
});
