import type { ReactNode } from "react";
import { Doodle, Shape } from "./Decor";
import { Check, LockKeyhole } from "lucide-react";
import welcome from "@/assets/mascot-welcome-cutout.png.asset.json";
import encourage from "@/assets/mascot-encourage-cutout.png.asset.json";

export function AuthLayout({ mode, title, lead, children, footer }: { mode: "signup" | "signin" | "recovery"; title: string; lead: string; children: ReactNode; footer?: ReactNode }) {
  const mascot = mode === "signup" ? welcome : encourage;
  return (
    <section className="section-fit bg-hero pb-16 pt-[calc(var(--header-height)+2rem)] sm:pt-[calc(var(--header-height)+2.5rem)]">
      <div className="container-site grid overflow-hidden rounded-[2rem] border border-border bg-card shadow-lift lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative isolate flex flex-col justify-between overflow-hidden bg-sand/70 p-6 sm:p-10 lg:min-h-[44rem] lg:p-12">
          <Shape kind="pebble" tone="--sage-soft" className="-z-10 -left-20 -top-16 size-80 opacity-80" />
          <Shape kind="burst" tone="--shape-sun" spin className="-z-10 -bottom-12 -right-12 size-48 opacity-70" />
          <Doodle kind="leaf" className="right-8 top-8 hidden size-10 text-forest/40 lg:block" />
          <Doodle kind="coin" className="left-8 bottom-40 hidden size-9 text-forest/40 lg:block" />
          <div className="flex items-center gap-5 lg:block">
            <img src={mascot.url} alt="The Wall·ette mascot welcoming you" width={341} height={467} className="w-20 shrink-0 sm:w-24 lg:mx-auto lg:w-64" />
            <div className="lg:mt-8 lg:text-center">
              <p className="text-eyebrow">Private by default</p>
              <h2 className="mt-2 font-display text-xl font-bold lg:text-3xl">Your statement stays on your device.</h2>
            </div>
          </div>
          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-3 lg:mt-10 lg:grid-cols-1">
            {["Statement passwords are never stored", "No ads or selling your money data", "Review transactions before they’re saved"].map((item, i) => (
              <li key={item} className={`flex items-start gap-2 rounded-2xl bg-card/80 px-3 py-2.5 shadow-soft ${(["lg:-rotate-1", "lg:rotate-1 lg:ml-6", "lg:-rotate-[0.5deg]"] as const)[i] ?? ""}`}><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-forest"><Check className="size-3" /></span>{item}</li>
            ))}
          </ul>
          <p className="mt-6 hidden items-center gap-2 text-sm text-muted-foreground lg:flex"><LockKeyhole className="size-4 text-forest" /> Your account is protected with secure sign-in.</p>
        </div>
        <div className="flex items-center p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-3 text-muted-foreground">{lead}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6">{footer}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
