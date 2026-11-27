import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { AppWindow, LogOut, Menu, UserRound, X } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/firebase";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/spread", label: "Spread" },
  { to: "/blog", label: "Blog" },
  { to: "/pricing", label: "Pricing" },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, signOut } = useAuth();
  const displayName = user?.displayName?.split(" ")[0] || "Account";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header className={cn("site-header fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl", scrolled ? "border-border/70 bg-background/95 shadow-soft" : "border-transparent bg-transparent backdrop-blur-none")}>
        <div className="container-site flex h-[var(--header-height)] items-center justify-between gap-3 sm:gap-4">
          <div className="header-item min-w-0 shrink-0"><Logo /></div>
          <nav aria-label="Main" className="header-item hidden items-center gap-1 lg:flex" style={{ "--d": "90ms" } as CSSProperties}>
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="nav-link" activeProps={{ className: "is-active" }}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-item flex shrink-0 items-center gap-1.5 sm:gap-2" style={{ "--d": "160ms" } as CSSProperties}>
            <ThemeToggle />
            {!loading && (user ? (
              <details className="relative hidden sm:block">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-sand"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-forest"><UserRound className="size-4" /></span><span className="max-w-28 truncate">{displayName}</span></summary>
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border bg-popover p-3 shadow-lift">
                  <p className="truncate px-2 text-sm font-semibold">{user.email}</p>
                  <p className="px-2 pt-1 text-xs text-muted-foreground">Your private Wall·ette account</p>
                  <a href={APP_URL} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-sand"><AppWindow className="size-4" /> Open Wall·ette</a>
                  <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-sand"><LogOut className="size-4" /> Sign out</button>
                </div>
              </details>
            ) : (
              <><Link to="/signin" className="hidden rounded-full px-4 py-2 text-[0.95rem] font-medium transition-colors hover:bg-sand sm:inline-flex">Sign in</Link><Button asChild variant="hero" size="pill" className="hidden sm:inline-flex"><Link to="/signup">Sign up</Link></Button></>
            ))}
            <button type="button" className="grid size-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-sand lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X className="size-6" /> : <Menu className="size-6" />}</button>
          </div>
        </div>
      </header>

      <div className={cn("fixed inset-0 z-40 flex h-[100dvh] flex-col bg-background pt-[var(--header-height)] transition-all duration-300 lg:hidden", open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0")} aria-hidden={!open}>
        <nav aria-label="Mobile" className="container-site flex-1 overflow-y-auto">
          <div className="mt-6 divide-y divide-border">
            {NAV.map((item, index) => <Link key={item.to} to={item.to} className={cn("mobile-nav-item block py-4 font-display text-2xl font-bold", open && "is-open")} style={{ "--d": `${100 + index * 55}ms` } as CSSProperties}>{item.label}</Link>)}
            {!loading && !user && <Link to="/signin" className={cn("mobile-nav-item block py-4 font-display text-2xl font-bold", open && "is-open")} style={{ "--d": "320ms" } as CSSProperties}>Sign in</Link>}
          </div>
        </nav>
        <div className="container-site border-t border-border py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!loading && (user ? <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="font-semibold">{displayName}</p><p className="truncate text-sm text-muted-foreground">{user.email}</p></div><Button asChild variant="hero"><a href={APP_URL}>Open</a></Button><Button type="button" variant="soft" onClick={() => void signOut()} aria-label="Sign out"><LogOut /></Button></div> : <Button asChild variant="hero" size="xl" className="w-full"><Link to="/signup">Start your free month</Link></Button>)}
        </div>
      </div>
    </>
  );
}

export function MobileStickyCta() {
  const [show, setShow] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  useEffect(() => {
    const on = () => setShow(window.scrollY > 700);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // Without a trailing slash: a host that keeps one ("/signin/") would show the
  // bar in the browser but not in the prerendered page, and React's hydration fails (#418).
  const path = pathname.replace(/\/+$/, "") || "/";
  if (["/signup", "/signin", "/forgot-password", "/reset-password"].includes(path) || user) return null;
  return <div className={cn("fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl transition-transform sm:hidden", show ? "translate-y-0" : "translate-y-full")}><Button asChild variant="hero" size="xl" className="w-full"><Link to="/signup">Start your free month</Link></Button></div>;
}
