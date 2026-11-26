import { useEffect, useRef, type ElementType, type ReactNode, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function useInView<T extends Element>(onIn?: () => void) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            onIn?.();
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

export function Reveal({
  as: Tag = "div",
  delay = 0,
  direction = "up",
  className,
  children,
}: {
  as?: ElementType;
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
  className?: string;
  children: ReactNode;
}) {
  const ref = useInView<HTMLElement>();
  return (
    <Tag ref={ref} data-direction={direction} className={cn("reveal", className)} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
}
