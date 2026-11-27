import { createFileRoute, notFound } from "@tanstack/react-router";
import { resources } from "@/components/resources/catalog";
import { ResourcePage } from "@/components/resources/ResourcePage";
import { COMPANY } from "@/lib/site";

export const Route = createFileRoute("/resources/$slug")({
  loader: ({ params }) => {
    const resource = resources.find((r) => r.slug === params.slug);
    if (!resource) throw notFound();
    return resource;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Resource unavailable — Wall·ette" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.title} — Wall·ette`;
    const url = `${COMPANY.siteUrl}/resources/${loaderData.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: loaderData.description },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ResourceRoute,
  notFoundComponent: () => (
    <section className="container-site py-32">
      <h1 className="text-section">Resource not found</h1>
      <a href="/resources" className="mt-6 inline-block text-forest underline">
        Browse all resources
      </a>
    </section>
  ),
});

function ResourceRoute() {
  const resource = Route.useLoaderData();
  return <ResourcePage key={resource.slug} resource={resource} />;
}
