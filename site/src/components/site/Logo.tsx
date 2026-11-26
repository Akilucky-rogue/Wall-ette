import { Link } from "@tanstack/react-router";
import mark from "@/assets/icon-mark-leaf.png.asset.json";
import wordmark from "@/assets/wordmark-clean.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" aria-label="Wall·ette home" className={cn("inline-flex shrink-0 items-center gap-2 sm:gap-2.5", className)}>
      <img src={mark.url} alt="" width={288} height={288} className="size-8 shrink-0 sm:size-9" />
      <img src={wordmark.url} alt="Wall·ette" width={944} height={185} className="h-6 w-auto sm:h-7 dark:brightness-0 dark:invert" />
    </Link>
  );
}
