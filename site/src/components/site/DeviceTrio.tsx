import { Check, Smartphone } from "lucide-react";
import { Shape, Sticker } from "@/components/site/Decor";
import desktop from "@/assets/wallette-desktop-dashboard.webp.asset.json";
import pulse from "@/assets/screen-pulse.webp.asset.json";
import home from "@/assets/screen-home.webp.asset.json";

/** Hero product composition using the real desktop dashboard and app screens. */
export function DeviceTrio() {
  return (
    <div className="relative isolate mx-auto w-full max-w-4xl px-1 pb-10 pt-7 sm:px-8 sm:pb-12" role="img" aria-label="Wall·ette shown in laptop, tablet and phone frames: the desktop dashboard, Pulse and the mobile Home screen">
      <Shape kind="pebble" tone="--sage-soft" className="-z-10 inset-x-0 -bottom-4 top-10 h-[88%] w-full" />
      <Shape kind="burst" tone="--shape-sun" spin className="-z-10 -right-2 top-0 size-24 sm:size-32" />

      {/* Laptop: the supplied desktop dashboard, with the browser chrome removed. */}
      <div className="relative z-[1] mx-auto w-[94%] sm:w-[84%]">
        <div className="rounded-t-[1.35rem] border border-[color:var(--device-edge)] bg-[color:var(--device-frame)] p-1.5 shadow-lift sm:p-2.5">
          <span className="mx-auto mb-1 block size-1 rounded-full bg-on-forest/35 sm:mb-1.5 sm:size-1.5" aria-hidden />
          <div className="aspect-[1900/948] overflow-hidden rounded-t-lg bg-card">
            <img src={desktop.url} alt="" width={1900} height={948} className="size-full object-cover object-top" fetchPriority="high" />
          </div>
        </div>
        <div className="relative mx-[-5%] h-3 rounded-b-[1rem] border border-[color:var(--device-edge)] bg-[color:var(--device-frame)] shadow-lift sm:h-4">
          <span className="absolute left-1/2 top-0 h-1 w-[12%] -translate-x-1/2 rounded-b-md bg-on-forest/20" aria-hidden />
        </div>
        <div className="mx-auto h-1.5 w-[24%] rounded-b-xl bg-[color:var(--device-edge)]" aria-hidden />
      </div>

      {/* Tablet: a real Pulse screen in a portrait tablet bezel. */}
      <div className="absolute -bottom-1 left-[1%] z-[2] w-[25%] -rotate-3 rounded-[1.25rem] border border-[color:var(--device-edge)] bg-[color:var(--device-frame)] p-1.5 shadow-lift sm:bottom-0 sm:left-[2%] sm:w-[21%] sm:p-2">
        <span className="mx-auto mb-1 block size-1 rounded-full bg-on-forest/35" aria-hidden />
        <div className="aspect-[3/4] overflow-hidden rounded-[0.85rem] bg-card">
          <img src={pulse.url} alt="" width={640} height={1138} className="size-full object-cover object-top" />
        </div>
      </div>

      {/* Phone: the real Home screen, with a speaker and home indicator. */}
      <div className="absolute bottom-0 right-[1%] z-[3] w-[17%] rotate-3 rounded-[1.4rem] border border-[color:var(--device-edge)] bg-[color:var(--device-frame)] p-1.5 shadow-lift sm:right-[3%] sm:w-[14%] sm:p-2">
        <span className="mx-auto mb-1 block h-1 w-7 rounded-full bg-on-forest/35" aria-hidden />
        <div className="aspect-[640/1138] overflow-hidden rounded-[1rem] bg-card">
          <img src={home.url} alt="" width={640} height={1138} className="size-full object-cover object-top" />
        </div>
        <span className="mx-auto mt-1 block h-0.5 w-6 rounded-full bg-on-forest/35" aria-hidden />
      </div>

      <Sticker className="left-[3%] top-0 hidden sm:block" tilt={-4}><span className="flex items-center gap-2 font-semibold"><span className="size-2 rounded-full bg-sage" aria-hidden /> Web app live</span></Sticker>
      <Sticker className="right-[13%] top-1 hidden md:block" tilt={3} delay={300}><span className="flex items-center gap-2 font-semibold"><Check className="size-4 text-forest" /> Transfers separated</span></Sticker>
      <Sticker className="-bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs sm:text-sm" tilt={-2} delay={600}><span className="flex items-center gap-2 font-semibold"><Smartphone className="size-4 text-forest" /> Android coming soon</span></Sticker>
    </div>
  );
}
