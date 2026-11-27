import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "./PageHeader";
import think from "@/assets/mascot-think-cutout.png.asset.json";

export function ComingSoon({ title, lead }: { title: string; lead: string }) {
  return (
    <section className="bg-hero">
      <div className="container-site grid min-h-[70vh] items-center gap-10 pb-16 pt-28 md:grid-cols-[1.4fr_1fr]">
        <div>
          <Breadcrumbs items={[{ label: title }]} />
          <h1 className="text-hero mt-8">{title}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">{lead}</p>
          <p className="mt-3 text-sm text-muted-foreground">This page is being written and will be live shortly.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="xl"><Link to="/signup">Start your free month</Link></Button>
            <Button asChild variant="soft" size="xl"><Link to="/">Back to home</Link></Button>
          </div>
        </div>
        <img src={think.url} alt="" width={271} height={334} className="mx-auto w-40 sm:w-52" />
      </div>
    </section>
  );
}
