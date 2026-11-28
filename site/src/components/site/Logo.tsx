import { Link } from "@tanstack/react-router";
import mark from "@/assets/icon-mark-leaf.png.asset.json";
import wordmark from "@/assets/brand/wordmark.svg?raw";
import { cn } from "@/lib/utils";

/**
 * The mark and the wordmark, both vector (the app's scripts/brand-trace.py
 * traced the wordmark from the brand kit), so they stay sharp at any size.
 * The letters take the text colour; the dot stays brand sage, lighter in dark mode.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="Wall·ette home" className={cn("inline-flex shrink-0 items-center gap-2 sm:gap-2.5", className)}>
      <img src={mark.url} alt="" width={288} height={288} className="size-8 shrink-0 sm:size-9" />
      <span
        role="img"
        aria-label="Wall·ette"
        className="block h-5 w-auto shrink-0 text-[#282D20] sm:h-[22px] dark:text-[#F2EFE7] [&_svg]:h-full [&_svg]:w-auto dark:[&_.wm-dot]:fill-[#A2B57A]"
        dangerouslySetInnerHTML={{ __html: wordmark }}
      />
    </Link>
  );
}
