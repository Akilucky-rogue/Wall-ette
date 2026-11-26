import { useState, type FormEvent } from "react";
import { z } from "zod";
import { subscribeNewsletter } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const schema = z.object({ email: z.string().trim().email("Please enter a valid email").max(255) });

export function Newsletter({ source = "footer", className }: { source?: string; className?: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) return (setState("error"), setMsg(parsed.error.issues[0]?.message ?? "Invalid email"));
    if (!consent) return (setState("error"), setMsg("Please tick the box so we can email you."));
    setState("loading");
    try {
      await subscribeNewsletter(parsed.data.email, source);
    } catch {
      setState("error");
      setMsg("Something went wrong. Please try again.");
      return;
    }
    setState("done");
  }

  if (state === "done")
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-5", className)} role="status">
        <p className="font-display text-lg font-bold">You're on the list.</p>
        <p className="mt-1 text-sm text-muted-foreground">The Monthly Check-in lands once a month. Unsubscribe anytime.</p>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)} noValidate>
      <label htmlFor={`nl-${source}`} className="sr-only">Email address</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`nl-${source}`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 min-w-0 flex-1 rounded-full border border-input bg-card px-5 text-base outline-none transition focus:border-forest focus:ring-2 focus:ring-sage/40"
        />
        <Button type="submit" variant="hero" size="xl" disabled={state === "loading"}>
          {state === "loading" ? "Subscribing…" : "Subscribe"}
        </Button>
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--forest)]" />
        <span>Monthly money tips from Wall·ette. Unsubscribe anytime.</span>
      </label>
      {state === "error" && <p className="mt-2 text-sm text-destructive" role="alert">{msg}</p>}
    </form>
  );
}
