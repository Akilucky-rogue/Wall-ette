import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Clock, Landmark, Mail, MapPin, ShieldCheck } from "lucide-react";
import { sendContactMessage } from "@/lib/forms";
import { Doodle, Shape } from "@/components/site/Decor";
import { Button } from "@/components/ui/button";
import { PageHeader, breadcrumbJsonLd } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { COMPANY } from "@/lib/site";
import celebrate from "@/assets/mascot-celebrate-cutout.png.asset.json";
import encourage from "@/assets/mascot-encourage-cutout.png.asset.json";

const TOPICS = [
  { v: "support", l: "Help with the app" },
  { v: "bank", l: "Request a bank" },
  { v: "feedback", l: "Feedback or idea" },
  { v: "privacy", l: "Privacy or my data" },
  { v: "press", l: "Press or partnership" },
  { v: "other", l: "Something else" },
] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Please tell us your name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  topic: z.enum(["support", "bank", "feedback", "privacy", "press", "other"]),
  message: z.string().trim().min(10, "A few more words, please (10+ characters)").max(2000, "Please keep it under 2,000 characters"),
});

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Wall·ette — support, bank requests & feedback" },
      { name: "description", content: "Get help with Wall·ette, request support for your bank, or reach our grievance officer. Email akshatbvora@gmail.com — we reply within two working days." },
      { property: "og:title", content: "Contact Wall·ette" },
      { property: "og:description", content: "Support, bank requests, privacy questions and feedback — we reply within two working days." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${COMPANY.siteUrl}/contact` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.siteUrl}/contact` }],
    scripts: [breadcrumbJsonLd([{ name: "Contact", path: "/contact" }])],
  }),
  component: Contact,
});

type Errors = Partial<Record<keyof z.infer<typeof schema>, string>>;

function Field({ id, label, error, children }: { id: string; label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
      {error && <p id={`${id}-err`} className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-input bg-background px-4 py-3 text-base outline-none transition focus:border-forest focus:ring-2 focus:ring-sage/40";

function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", topic: "support", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Errors = {};
      for (const i of parsed.error.issues) errs[i.path[0] as keyof Errors] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setState("sending");
    try {
      await sendContactMessage(parsed.data);
      setState("sent");
    } catch {
      setState("failed");
    }
  }

  if (state === "sent")
    return (
      <div className="rounded-[2rem] border border-border bg-card p-8 text-center shadow-soft sm:p-12" role="status">
        <img src={celebrate.url} alt="" width={306} height={332} className="mx-auto w-32" />
        <h2 className="mt-4 text-2xl">Thanks — we've got your message.</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">We'll reply to {form.email} within two working days.</p>
        <Button asChild variant="hero" size="xl" className="mt-8"><Link to="/signup">Meanwhile, start your free month</Link></Button>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="space-y-5 rounded-[2rem] border border-border bg-card p-6 shadow-soft sm:p-10">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="c-name" label="Your name" error={errors.name}>
          <input id="c-name" autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} className={inputCls} />
        </Field>
        <Field id="c-email" label="Email" error={errors.email}>
          <input id="c-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={!!errors.email} className={inputCls} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">What's it about?</legend>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <label key={t.v} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition ${form.topic === t.v ? "border-forest bg-accent text-forest" : "border-border hover:bg-sand"}`}>
              <input type="radio" name="topic" value={t.v} checked={form.topic === t.v} onChange={set("topic")} className="sr-only" />
              {t.l}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="c-msg" label={form.topic === "bank" ? "Which bank, and PDF or Excel?" : "Message"} error={errors.message}>
        <textarea id="c-msg" rows={6} value={form.message} onChange={set("message")} aria-invalid={!!errors.message} className={inputCls} placeholder={form.topic === "bank" ? "e.g. ICICI Bank, PDF statement from net banking" : "How can we help?"} />
      </Field>
      <p className="text-xs text-muted-foreground">Please don't include card numbers, passwords or statement files. By sending, you agree to our <Link to="/privacy" className="underline">privacy policy</Link>.</p>
      {state === "failed" && <p className="text-sm text-destructive" role="alert">That didn't send. Please try again, or email {COMPANY.supportEmail}.</p>}
      <Button type="submit" variant="hero" size="xl" disabled={state === "sending"} className="w-full sm:w-auto">{state === "sending" ? "Sending…" : "Send message"}</Button>
    </form>
  );
}

function Contact() {
  const cards = [
    { icon: Mail, t: "Email support", b: <a href={`mailto:${COMPANY.supportEmail}`} className="font-semibold text-forest hover:underline">{COMPANY.supportEmail}</a> },
    { icon: Clock, t: "Response time", b: "Within two working days, Monday to Friday." },
    { icon: Landmark, t: "Bank requests", b: "Pick “Request a bank” in the form — we add banks based on demand." },
    { icon: ShieldCheck, t: "Grievance officer", b: <>{COMPANY.grievanceOfficer} · <Link to="/grievance" className="font-semibold text-forest hover:underline">How to raise a grievance</Link></> },
    { icon: MapPin, t: "Who runs Wall·ette", b: <>{COMPANY.legalName}, {COMPANY.address}<br />{COMPANY.endorsement}</> },
  ];
  return (
    <>
      <PageHeader crumbs={[{ label: "Contact" }]} eyebrow="Contact" title={<>Talk to a human <span className="text-forest">who built it.</span></>} lead="Questions, a bank you'd like supported, or something that doesn't add up — tell us. Real people read every message." aside={<img src={encourage.url} alt="The Wall·ette mascot giving a thumbs up" width={260} height={332} className="float-y mx-auto hidden w-44 lg:block" />} />
      <section className="section-fit container-site grid gap-10 py-16 lg:grid-cols-[1.5fr_1fr]">
        <Reveal><ContactForm /></Reveal>
        <div className="space-y-3">
          {cards.map((c, i) => (
            <Reveal key={c.t} delay={i * 80} className="flex items-center gap-4 rounded-[1.5rem_0.75rem_1.5rem_0.75rem] bg-card p-4 shadow-soft">
              <span className="relative grid size-12 shrink-0 place-items-center"><Shape kind={(["cloud", "pebble", "wallet", "burst"] as const)[i] ?? "pebble"} tone={(["--shape-sun", "--sage-soft", "--shape-clay", "--sage-soft"] as const)[i] ?? "--sage-soft"} className="inset-0 size-full" /><c.icon className="relative size-5 text-forest" aria-hidden /></span>
              <div><p className="font-semibold">{c.t}</p><div className="mt-1 text-sm text-muted-foreground">{c.b}</div></div>
            </Reveal>
          ))}
          <Reveal className="relative overflow-hidden rounded-[0.75rem_1.5rem_0.75rem_1.5rem] tint-peach p-5"><Doodle kind="spark" className="right-4 top-4 size-7 text-forest/40" />
            <p className="font-semibold">Looking for a quick answer?</p>
            <p className="mt-1 text-sm text-muted-foreground">Most questions about importing, privacy and pricing are answered in the FAQ.</p>
            <Link to="/faq" className="mt-3 inline-block text-sm font-semibold text-forest hover:underline">Read the FAQ →</Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
