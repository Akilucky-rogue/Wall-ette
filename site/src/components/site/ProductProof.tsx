import { FileCheck2, Landmark, MapPin, ShieldCheck } from "lucide-react";
import { BANKS } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Shape } from "./Decor";

const FACTS = [
  { icon: MapPin, value: "Mumbai", detail: "Built and operated here", shape: "pebble", tone: "--sage-soft" },
  { icon: FileCheck2, value: "17 statements", detail: "Used to check statement reading", shape: "cloud", tone: "--shape-sun" },
  { icon: Landmark, value: `${BANKS.length} banks`, detail: "Named, supported formats", shape: "arch", tone: "--shape-clay" },
  { icon: ShieldCheck, value: "No ads", detail: "Funded by subscriptions", shape: "leaf", tone: "--sage-soft" },
] as const;

export function ProductProof({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "pt-0" : "container-site py-10 sm:py-12"}>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-eyebrow">Proof, in plain sight</p>
        <h2 className={cn("mt-2 font-display font-bold tracking-tight", compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl")}>Real statements. Clear facts.</h2>
        <p className="mt-2 text-sm text-muted-foreground">A quick look at what Wall·ette is built on.</p>
      </div>
      <ul aria-label="Wall·ette at a glance" className={cn("mx-auto mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4", compact ? "max-w-4xl" : "mt-8 max-w-5xl gap-y-8")}>
        {FACTS.map((fact) => (
          <li key={fact.value} className="flex items-center justify-center gap-3 text-left">
            <span className={cn("relative grid shrink-0 place-items-center", compact ? "size-10" : "size-11 sm:size-14")}>
              <Shape kind={fact.shape} tone={fact.tone} className="inset-0 size-full" />
              <fact.icon aria-hidden className={cn("relative text-forest", compact ? "size-4" : "size-5")} />
            </span>
            <div>
              <p className={cn("font-display font-bold leading-tight", compact ? "text-sm sm:text-base" : "text-base sm:text-xl")}>{fact.value}</p>
              <p className="mt-1 max-w-32 text-[0.68rem] leading-snug text-muted-foreground sm:max-w-40 sm:text-xs">{fact.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
