import welcome from "@/assets/mascot-open-welcome.png.asset.json";
import statement from "@/assets/mascot-statement-review.png.asset.json";
import gift from "@/assets/mascot-gift-sharing.png.asset.json";
import encourage from "@/assets/mascot-gentle-encourage.png.asset.json";
import { cn } from "@/lib/utils";

const POSES = {
  welcome: { asset: welcome, width: 585, alt: "The Wall·ette mascot welcoming you with open arms" },
  statement: { asset: statement, width: 588, alt: "The Wall·ette mascot checking a statement with a magnifying glass" },
  gift: { asset: gift, width: 590, alt: "The Wall·ette mascot offering a gift" },
  encourage: { asset: encourage, width: 564, alt: "The Wall·ette mascot giving an encouraging thumbs up" },
} as const;

export function Mascot({ pose, className, eager = false, decorative = false }: {
  pose: keyof typeof POSES;
  className?: string;
  eager?: boolean;
  decorative?: boolean;
}) {
  const selected = POSES[pose];
  return <img src={selected.asset.url} alt={decorative ? "" : selected.alt} aria-hidden={decorative || undefined} width={selected.width} height={800} loading={eager ? "eager" : "lazy"} decoding="async" className={cn("h-auto object-contain", className)} />;
}