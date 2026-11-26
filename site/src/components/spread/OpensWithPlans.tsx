import { Clock3 } from "lucide-react";
import { Newsletter } from "@/components/site/Newsletter";
import { cn } from "@/lib/utils";

/**
 * Referrals, student access and gifts start with paid plans. Until then each
 * Spread panel says so in place of its form, and offers the Monthly Check-in
 * to hear when it opens.
 */
export function OpensWithPlans({ title, body, source, tone = "card", className }: { title: string; body: string; source: string; tone?: "card" | "forest"; className?: string }) {
  const forest = tone === "forest";
  return (
    <div className={cn("mt-6 rounded-2xl p-5", forest ? "bg-on-forest/10" : "bg-sand", className)} role="note">
      <p className="flex items-center gap-2 font-semibold"><Clock3 className="size-4" aria-hidden /> {title}</p>
      <p className={cn("mt-1 text-sm", forest ? "text-on-forest/75" : "text-muted-foreground")}>{body}</p>
      {!forest && <div className="mt-4"><Newsletter source={source} /></div>}
    </div>
  );
}
