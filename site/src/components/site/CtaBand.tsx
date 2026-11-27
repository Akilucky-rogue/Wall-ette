import { Link } from "@tanstack/react-router";
import { Mascot } from "./Mascot";
import { Button } from "@/components/ui/button";
import { Reveal } from "./Reveal";
import { Doodle, Shape } from "./Decor";

export function CtaBand({
  title = "Start your free month",
  body = "Import your first statement and see where your money really went. First month ₹0 for new members; card required. Then from ₹37 a month. Cancel anytime.",
  cta = "Start your free month",
}: { title?: string; body?: string; cta?: string }) {
  return (
    <section className="container-site py-16 sm:py-24">
      <Reveal className="relative overflow-hidden rounded-[3rem_1.5rem_3rem_1.5rem] bg-sand px-6 py-12 sm:px-12 sm:py-16">
        <Shape kind="pebble" tone="--sage-soft" className="-bottom-24 -left-20 size-72 opacity-70" />
        <Doodle kind="coin" className="left-[45%] top-8 hidden size-10 text-forest/40 md:block" />
        <div className="relative grid items-center gap-10 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-section">{title}</h2>
            <p className="mt-4 max-w-xl text-muted-foreground">{body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="xl"><Link to="/signup">{cta}</Link></Button>
              <Button asChild variant="soft" size="xl"><Link to="/pricing">See plans</Link></Button>
            </div>
          </div>
          <div className="relative isolate grid place-items-center"><Shape kind="burst" tone="--shape-sun" spin className="-z-10 inset-0 m-auto size-64 sm:size-72" /><Mascot pose="encourage" className="mx-auto w-40 sm:w-52 float-y" /></div>
        </div>
      </Reveal>
    </section>
  );
}
