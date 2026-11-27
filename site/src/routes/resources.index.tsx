import { createFileRoute } from "@tanstack/react-router";
import { Shape } from "@/components/site/Decor";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { resources } from "@/components/resources/catalog";
import { ResourceFooter } from "@/components/resources/ResourcePage";
import { COMPANY } from "@/lib/site";

export const Route = createFileRoute("/resources/")({
  head: () => ({
    meta: [
      { title: "Free money tools & guides — Wall·ette" },
      { name: "description", content: "Free browser calculators, Indian bank statement guides, finance glossaries and a downloadable monthly budget CSV. No sign-in required." },
      { property: "og:title", content: "Free money tools & guides — Wall·ette" },
      { property: "og:description", content: "Practical calculators, statement guides and money templates you can use without an account." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${COMPANY.siteUrl}/resources` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.siteUrl}/resources` }],
  }),
  component: Resources,
});

function Resources() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Resources" }]}
        eyebrow="A little clarity"
        title={<>Make room for what matters.</>}
        lead="Practical money tools and plain-English guides. Use them in your browser, without creating an account."
      />
      <section className="container-site space-y-12 py-12">
        <p className="max-w-3xl text-muted-foreground">
          Calculator inputs stay in this page’s memory. We do not save or send
          them. Refreshing clears your entries. The budget sheet downloads
          directly from your browser.
        </p>
        {["Calculators", "Bank statement guides", "Reference & templates"].map(
          (group) => (
            <section key={group} aria-label={group}>
              <h2 className="text-section">{group}</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {resources
                  .filter((r) => r.group === group)
                  .map((r, i) => (
                    <Reveal key={r.slug} delay={(i % 3) * 80}>
                      <a
                        href={`/resources/${r.slug}`}
                        className={`group relative block h-full overflow-hidden p-6 shadow-soft transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${(["rounded-[2rem_1rem_2rem_1rem] tint-sage", "rounded-[1rem_2rem_1rem_2rem] tint-sand", "rounded-[2rem_1rem_2rem_1rem] tint-peach"] as const)[i % 3]}`}
                      >
                        <Shape kind={(["pebble", "cloud", "burst"] as const)[i % 3] ?? "pebble"} tone={(["--sage-soft", "--shape-sun", "--shape-clay"] as const)[i % 3] ?? "--sage-soft"} className="-right-8 -top-8 size-28 opacity-80 transition-transform duration-500 group-hover:rotate-12" />
                        <h3 className="relative text-xl font-semibold">{r.title}</h3>
                        <p className="mt-3 text-muted-foreground">
                          {r.description}
                        </p>
                        <span className="relative mt-5 inline-block font-semibold text-forest">
                          Open resource →
                        </span>
                      </a>
                    </Reveal>
                  ))}
              </div>
            </section>
          ),
        )}
      </section>
      <ResourceFooter />
    </>
  );
}
