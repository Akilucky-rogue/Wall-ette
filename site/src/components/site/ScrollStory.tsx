import { useEffect, useRef, useState } from "react";
import { PhoneShot } from "./PhoneShot";
import { cn } from "@/lib/utils";

export type Chapter = { title: string; body: string; points?: string[]; img: string; alt: string };

/** Text scrolls on the left; the phone on the right stays put and swaps screens. */
export function ScrollStory({ chapters }: { chapters: Chapter[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset["i"]))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const cur = chapters[active] ?? chapters[0];
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 [&>*]:min-w-0">
      <div>
        {chapters.map((c, i) => (
          <div key={c.title} data-i={i} ref={(el) => { refs.current[i] = el; }} className={cn("py-8 transition-opacity duration-500 lg:flex lg:min-h-[70vh] lg:flex-col lg:justify-center", i === active ? "lg:opacity-100" : "lg:opacity-35")}>
            <p className="font-display text-sm font-bold text-forest">0{i + 1}</p>
            <h3 className="mt-2 text-2xl sm:text-3xl">{c.title}</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">{c.body}</p>
            {c.points && (
              <ul className="mt-5 space-y-2">
                {c.points.map((p) => <li key={p} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-sage" aria-hidden />{p}</li>)}
              </ul>
            )}
            <div className="mt-8 lg:hidden"><PhoneShot src={c.img} alt={c.alt} className="max-w-[14rem]" /></div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-24 flex h-[calc(100vh-8rem)] items-center justify-center">
          <div className="absolute inset-x-10 inset-y-16 rounded-[3rem] bg-sage-soft" aria-hidden />
          {cur && <div key={cur.img} className="row-in relative"><PhoneShot src={cur.img} alt={cur.alt} /></div>}
        </div>
      </div>
    </div>
  );
}
