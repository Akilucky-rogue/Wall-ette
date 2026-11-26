import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarArchive({ dates, selected, onSelect }: {
  dates: readonly string[];
  selected: string | undefined;
  onSelect: (date: string | undefined) => void;
}) {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(d, (counts.get(d) ?? 0) + 1);
  const sorted = [...dates].sort();
  const latest = selected ?? sorted[sorted.length - 1] ?? "2026-02-01";

  const [view, setView] = useState(() => ({
    y: Number(latest.slice(0, 4)),
    m: Number(latest.slice(5, 7)) - 1,
  }));

  const shift = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const offset = first.getDay();
  const monthLabel = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"><ChevronLeft className="size-4" /></button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"><ChevronRight className="size-4" /></button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center">
        {WEEKDAYS.map((w, i) => <span key={i} aria-hidden="true" className="pb-1 text-[11px] font-medium text-muted-foreground">{w}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`o${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = i + 1;
          const key = `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const n = counts.get(key) ?? 0;
          const isSel = selected === key;
          if (!n) return <span key={key} className="py-1 text-xs text-muted-foreground/50">{d}</span>;
          const label = new Date(view.y, view.m, d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
          return (
            <button key={key} type="button" onClick={() => onSelect(isSel ? undefined : key)} aria-pressed={isSel} aria-label={`${label}, ${n} post${n > 1 ? "s" : ""}`}
              className={cn("mx-auto flex h-8 w-8 flex-col items-center justify-center rounded-full text-xs transition", isSel ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent")}>
              {d}
              <span className={cn("mt-0.5 size-1 rounded-full", isSel ? "bg-primary-foreground" : "bg-forest")} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
