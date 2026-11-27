import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/** First-visit loader: a stitched line traces the wallet card, then the centre dot fills. */
export function SiteLoader() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("wl-seen")) setGone(true);
    sessionStorage.setItem("wl-seen", "1");
    const t = setTimeout(() => setGone(true), 1600);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  return (
    <div className="loader-out fixed inset-0 z-[100] grid place-items-center bg-background" aria-hidden>
      <svg width="132" height="92" viewBox="0 0 132 92" fill="none">
        <rect x="4" y="4" width="124" height="84" rx="18" fill="var(--sage-soft)" />
        <rect className="loader-stitch" x="12" y="12" width="108" height="68" rx="12" stroke="var(--forest)" strokeWidth="2.5" strokeDasharray="6 6" fill="none" />
        <circle className="loader-dot" cx="66" cy="46" r="8" fill="var(--sage)" />
      </svg>
    </div>
  );
}

/** Thin sage bar while the next page loads. */
export function RouteProgress() {
  const loading = useRouterState({ select: (s) => s.status === "pending" });
  if (!loading) return null;
  return <div className="route-progress fixed inset-x-0 top-0 z-[60] h-0.5 bg-forest" aria-hidden />;
}
