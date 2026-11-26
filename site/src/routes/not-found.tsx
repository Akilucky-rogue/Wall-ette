import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/site/Mascot";

// Built as 404.html for Firebase Hosting (scripts/build-hosting.mjs), which
// shows it for any address the site doesn't have.
export const Route = createFileRoute("/not-found")({
  head: () => ({ meta: [{ title: "Page not found — Wall·ette" }, { name: "robots", content: "noindex" }] }),
  component: NotFoundPage,
});

function NotFoundPage() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-4 pb-16 pt-[calc(var(--header-height)+2rem)]">
      <div className="max-w-md text-center">
        <Mascot pose="encourage" className="mx-auto w-36" />
        <h1 className="mt-6 font-display text-4xl font-bold">This page isn’t here</h1>
        <p className="mt-3 text-muted-foreground">The address may be mistyped, or the page has moved.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="hero" size="xl"><Link to="/">Go home</Link></Button>
          <Button asChild variant="soft" size="xl"><a href="/app">Open Wall·ette</a></Button>
        </div>
      </div>
    </section>
  );
}
