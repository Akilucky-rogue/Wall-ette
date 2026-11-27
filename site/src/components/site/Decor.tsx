import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type DoodleKind = "leaf" | "coin" | "rupee" | "arrow" | "spark" | "receipt";

const PATHS: Record<DoodleKind, ReactNode> = {
  leaf: <><path d="M8 40C8 20 22 8 42 8c0 20-12 34-34 32Z" /><path d="M10 38 30 18" /></>,
  coin: <><circle cx="24" cy="24" r="15" /><path d="M24 15v18M19 19h7a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h7" /></>,
  rupee: <><path d="M15 12h20M15 19h20M17 12c10 0 12 14 0 14h-2l16 12" /></>,
  arrow: <><path d="M6 34c10-16 24-22 36-18" /><path d="M34 10l8 6-8 6" /></>,
  spark: <><path d="M24 6v10M24 32v10M6 24h10M32 24h10M12 12l6 6M30 30l6 6M36 12l-6 6M18 30l-6 6" /></>,
  receipt: <><path d="M12 6h24v36l-4-3-4 3-4-3-4 3-4-3-4 3Z" /><path d="M18 16h12M18 23h12M18 30h7" /></>,
};

/** Hand-drawn style brand doodle; purely decorative. */
export function Doodle({ kind, className, style }: { kind: DoodleKind; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn("doodle pointer-events-none absolute", className)} style={style}>
      {PATHS[kind]}
    </svg>
  );
}

/** Small tilted floating card around product shots. */
export function Sticker({ children, className, tilt = -4, delay = 0 }: { children: ReactNode; className?: string; tilt?: number; delay?: number }) {
  return (
    <div className={cn("sticker absolute z-10 rounded-2xl border border-border bg-popover px-3.5 py-2.5 text-sm shadow-lift", className)} style={{ "--tilt": `${tilt}deg`, "--fd": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/** Soft wave edge between tinted sections. `fill` is a CSS colour variable name. */
export function Wave({ fill, flip = false, className }: { fill: string; flip?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden className={cn("block h-10 w-full sm:h-16", flip && "rotate-180", className)} style={{ color: `var(${fill})` }}>
      <path fill="currentColor" d="M0 40c180 30 360 40 540 20S900 0 1080 10s270 40 360 40v30H0Z" />
    </svg>
  );
}

/** Highlighted key word with a hand-drawn underline. */
export function Mark({ children }: { children: ReactNode }) {
  return <span className="mark-underline">{children}</span>;
}

type ShapeKind = "pebble" | "arch" | "leaf" | "cloud" | "wallet" | "burst";

const SHAPES: Record<ShapeKind, string> = {
  // soft organic pebble
  pebble: "M318 52c62 34 92 112 74 186-17 72-80 136-160 146-82 11-170-32-200-104C2 208 28 118 92 68 156 18 256 18 318 52Z",
  // tall rounded arch, like a doorway
  arch: "M60 400V190C60 100 124 30 200 30s140 70 140 160v210Z",
  // big tilted leaf
  leaf: "M40 360C30 190 150 46 370 40c10 210-110 330-330 320Z",
  // stacked cloud / receipt-ish
  cloud: "M96 120c10-54 70-84 120-60 30-40 104-36 126 16 52 4 74 66 44 104 34 40 6 106-50 104-20 50-96 60-130 20-46 30-112 6-118-50-50-14-58-90-12-112 4-12 10-20 20-22Z",
  // wallet with flap
  wallet: "M40 120c0-30 24-54 54-54h212c30 0 54 24 54 54v190c0 30-24 54-54 54H94c-30 0-54-24-54-54Zm200 70h120v80H240a40 40 0 0 1 0-80Z",
  // gentle 8-point burst
  burst: "M200 24l38 58 68-14-10 68 58 38-58 38 10 68-68-14-38 58-38-58-68 14 10-68-58-38 58-38-10-68 68 14Z",
};

/** Decorative brand shape placed behind a product shot. `tone` is a CSS colour variable. */
export function Shape({ kind, tone = "--sage-soft", className, spin = false }: { kind: ShapeKind; tone?: string | undefined; className?: string; spin?: boolean }) {
  return (
    <svg viewBox="0 0 400 400" aria-hidden className={cn("pointer-events-none absolute", spin && "shape-spin", className)} style={{ color: `var(${tone})` }}>
      <path fill="currentColor" fillRule="evenodd" d={SHAPES[kind]} />
    </svg>
  );
}

/** Positions a phone shot over a brand shape with an outline echo. */
export function ShapeStage({ kind, tone, children, className }: { kind: ShapeKind; tone?: string | undefined; children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative isolate mx-auto w-full max-w-md py-6", className)}>
      <Shape kind={kind} tone={tone} className="-z-10 inset-0 m-auto h-[92%] w-full" />
      <svg viewBox="0 0 400 400" aria-hidden className="pointer-events-none absolute inset-0 -z-10 m-auto h-[92%] w-[96%] translate-x-[2%] translate-y-[3%] text-forest/25">
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 8" d={SHAPES[kind]} />
      </svg>
      {children}
    </div>
  );
}
