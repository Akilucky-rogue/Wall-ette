import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionTab = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export function SectionTabs({ label, items }: { label: string; items: readonly SectionTab[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const headerHeight = document.querySelector("header.site-header")?.getBoundingClientRect().height ?? 72;
      let current = items[0]?.id ?? "";
      for (const item of items) {
        const section = document.getElementById(item.id);
        if (section && section.getBoundingClientRect().top <= headerHeight + 176) current = item.id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [items]);

  return (
    <nav aria-label={label} className="sticky top-[var(--header-height)] z-30 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="container-site">
        <div className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none]">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              onClick={() => setActive(item.id)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 py-4 text-sm font-medium transition sm:text-base",
                active === item.id ? "border-forest text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="size-4 text-forest" aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
