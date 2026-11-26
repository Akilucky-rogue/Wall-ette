import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Newsletter } from "./Newsletter";
import { COMPANY } from "@/lib/site";

type L = { label: string; to: string; hash?: string; href?: string };
const GROUPS: { title: string; links: L[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/features" },
      { label: "Web app", to: "/", href: "/app" },
      { label: "Pricing", to: "/pricing" },
      { label: "Compare apps", to: "/compare" },
      { label: "Spread", to: "/spread" },
      { label: "Roadmap", to: "/roadmap" },
      { label: "Status", to: "/status" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Blog", to: "/blog" },
      { label: "Resources", to: "/resources" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "FAQ", to: "/faq" },
      { label: "How we keep data private", to: "/privacy", hash: "how-we-protect" },
      { label: "Delete my data", to: "/data-deletion" },
      { label: "Grievance officer", to: "/grievance" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", to: "/privacy" },
      { label: "Terms of use", to: "/terms" },
      { label: "Refund & cancellation", to: "/refund-policy" },
      { label: "Disclaimer", to: "/disclaimer" },
      { label: "Cookie policy", to: "/cookies" },
    ],
  },
];

function FooterLinks({ links }: { links: L[] }) {
  return (
    <ul className="space-y-2.5">
      {links.map((l) => (
        <li key={l.label}>
          {l.href
            ? <a href={l.href} className="text-[0.95rem] text-muted-foreground transition hover:text-forest">{l.label}</a>
            : <Link to={l.to} {...(l.hash ? { hash: l.hash } : {})} className="text-[0.95rem] text-muted-foreground transition hover:text-forest">{l.label}</Link>}
        </li>
      ))}
    </ul>
  );
}

export function Footer() {
  const year = 2026;
  return (
    <footer className="border-t border-border bg-sand/60 pb-24 sm:pb-0">
      <div className="container-site grid gap-12 pt-14 pb-6 lg:grid-cols-[1.1fr_2fr] lg:pt-20 lg:pb-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-muted-foreground">{COMPANY.promise}</p>
          <div className="mt-8 max-w-md">
            <p className="font-display text-lg font-bold">The Monthly Check-in</p>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">One email a month: new guides and money tips. No spam.</p>
            <Newsletter source="footer" />
          </div>
        </div>
        <div>
          {/* Desktop / tablet: columns */}
          <div className="hidden grid-cols-4 gap-8 sm:grid">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-4 text-sm font-semibold">{g.title}</p>
                <FooterLinks links={g.links} />
              </div>
            ))}
          </div>
          {/* Phones: tap to open */}
          <div className="divide-y divide-border border-y border-border sm:hidden">
            {GROUPS.map((g) => (
              <details key={g.title} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between py-3 font-semibold">
                  {g.title}
                  <span className="text-xl text-muted-foreground transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <div className="pb-4"><FooterLinks links={g.links} /></div>
              </details>
            ))}
          </div>
        </div>
      </div>
      <div className="container-site pb-8">
        <p className="border-b border-border pb-5 text-xs leading-relaxed text-muted-foreground">
          Wall·ette helps you organise recorded transactions and manage your own budgets. It does not recommend investments or provide personalised investment advice. It is not a bank, investment adviser or research analyst.
        </p>
        <p className="mt-5 text-sm text-muted-foreground">© {year} Akshat Vora · Backed by SERNET · Made in India.</p>
      </div>
    </footer>
  );
}
