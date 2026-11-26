import { cn } from "@/lib/utils";

export function PhoneShot({ src, alt, className, priority }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[17rem] rounded-[2.4rem] border-[6px] border-ink bg-ink p-0.5 shadow-phone", className)}>
      <div className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-ink" aria-hidden />
      <img
        src={src}
        alt={alt}
        width={640}
        height={1138}
        loading={priority ? "eager" : "lazy"}
        className="block aspect-[640/1138] w-full rounded-[2rem] object-cover"
      />
    </div>
  );
}
