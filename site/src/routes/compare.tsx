import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, Banknote, FileCheck2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, breadcrumbJsonLd } from "@/components/site/PageHeader";
import { CtaBand } from "@/components/site/CtaBand";
import { ComparisonView } from "@/components/site/ComparisonView";
import { Doodle, Mark, Shape, Sticker } from "@/components/site/Decor";
import { COMPARISON_PEERS, PEER_IDS } from "@/lib/comparison-catalog";
import { comparisonSelection } from "@/lib/compare-model";
import { WALLETTE_COMPARISON } from "@/lib/wallette-comparison";
import { COMPANY } from "@/lib/site";
import think from "@/assets/mascot-think-cutout.png.asset.json";

type CompareSearch = { first?: string; second?: string };
export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): CompareSearch => {
    const [first, second] = comparisonSelection(PEER_IDS, typeof search["first"] === "string" ? search["first"] : undefined, typeof search["second"] === "string" ? search["second"] : undefined);
    return { first, second };
  },
  head: () => ({
    meta: [
      { title: "Compare money apps: India & international alternatives — Wall·ette" },
      { name: "description", content: "Compare Wall·ette with two selected money apps: Fold, axio, YNAB, Lunch Money and more. Explore pricing, bank support, tracking methods, privacy and household fit." },
      { property: "og:title", content: "Three money apps. Your priorities. — Wall·ette Compare" },
      { property: "og:description", content: "A source-linked comparison of personal finance apps for India and beyond. Choose two peers beside Wall·ette and compare cost, tracking, country support and fit." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${COMPANY.siteUrl}/compare` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${COMPANY.siteUrl}/compare` }],
    scripts: [breadcrumbJsonLd([{ name: "Compare money apps", path: "/compare" }])],
  }),
  component: ComparePage,
});

function ComparePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [firstId, secondId] = comparisonSelection(PEER_IDS, search.first, search.second);
  const first = COMPARISON_PEERS.find(app => app.id === firstId);
  const second = COMPARISON_PEERS.find(app => app.id === secondId);
  if (!first || !second) return <PageHeader crumbs={[{ label: "Compare" }]} title="Comparison unavailable" lead="Please try again shortly." />;

  return <>
    <div className="[&>section]:min-h-0">
      <PageHeader crumbs={[{ label: "Compare" }]} eyebrow="Find your kind of money app" title={<>Compare money apps.<br /><span className="text-forest">Choose your <Mark>fit.</Mark></span></>} lead="Automatic connections, statement imports or hands-on budgets? The right app starts with how you manage money—not the longest list of ticks." actions={<><Button asChild variant="hero" size="xl"><a href="#comparison">Build your shortlist<ArrowDown className="size-4" /></a></Button><Button asChild variant="soft" size="xl"><Link to="/pricing">Wall·ette plans<ArrowRight className="size-4" /></Link></Button></>} aside={<div className="relative isolate mx-auto max-w-sm py-10">
        <Shape kind="burst" tone="--shape-sun" spin className="-z-10 inset-0 m-auto size-80 max-w-full" />
        <Doodle kind="arrow" className="right-0 top-0 size-12 text-forest" />
        <img src={think.url} alt="The Wall·ette mascot weighing up money apps" width={271} height={334} className="mx-auto w-44 sm:w-52" />
        <Sticker className="left-0 top-6" tilt={-5}><span className="flex items-center gap-2"><Banknote className="size-4 text-forest" />Bank-connected</span></Sticker>
        <Sticker className="right-0 top-1/2" tilt={4} delay={300}><span className="flex items-center gap-2"><FileCheck2 className="size-4 text-forest" />Statement-first</span></Sticker>
        <Sticker className="bottom-0 left-4" tilt={-3} delay={500}><span className="flex items-center gap-2"><PencilLine className="size-4 text-forest" />Hands-on budgets</span></Sticker>
      </div>} />
    </div>
    <ComparisonView wallette={WALLETTE_COMPARISON} peers={COMPARISON_PEERS} selected={[first, second]} onChange={(a, b) => { const [nextFirst, nextSecond] = comparisonSelection(PEER_IDS, a, b); void navigate({ search: { first: nextFirst, second: nextSecond }, replace: true, resetScroll: false }); }} />
    <CtaBand title="Statement-first feels like your fit?" body="Start your first 30 days at ₹0. Essential ₹49/month or ₹449/year; Plus ₹99/month or ₹899/year. Card or bank details required; secure checkout is not connected on this site." cta="Start Wall·ette signup" />
  </>;
}