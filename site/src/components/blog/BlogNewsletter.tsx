import { Newsletter } from "@/components/site/Newsletter";
import { Doodle, Shape } from "@/components/site/Decor";

export function BlogNewsletter({ source }: { source: string }) {
  return (
    <section aria-labelledby="blog-newsletter-title" className="container-site py-16">
      <div className="relative overflow-hidden rounded-[3rem_1.5rem_3rem_1.5rem] tint-peach p-6 sm:p-10"><Shape kind="burst" tone="--shape-sun" spin className="-right-12 -top-12 size-44 opacity-60" /><Doodle kind="spark" className="right-[22%] top-8 hidden size-8 text-forest/40 md:block" />
        <p className="text-eyebrow">A calmer money routine</p>
        <h2 id="blog-newsletter-title" className="text-section mt-3">The Monthly Check-in</h2>
        <p className="mb-6 mt-4 max-w-2xl text-muted-foreground">One monthly email from Wall·ette with plain-language money guides and a small action to try. Unsubscribe anytime.</p>
        <Newsletter source={source} />
      </div>
    </section>
  );
}
