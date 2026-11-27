import { useState } from "react";
import { Gift, PackageCheck } from "lucide-react";
import { giftQuote, GIFT_DISCOUNTS } from "@/lib/programs";
import { inr } from "@/lib/money";
import type { PlanId } from "@/lib/plans";
import { OpensWithPlans } from "./OpensWithPlans";

/** The gift estimate works now; gift orders start with paid plans. */
export function GiftPanel() {
  const [plan, setPlan] = useState<PlanId>("essential");
  const [quantity, setQuantity] = useState(1);
  const quote = giftQuote(plan, quantity);

  return <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
    <section className="rounded-3xl bg-forest-gradient p-6 text-on-forest shadow-soft sm:p-8" aria-labelledby="gift-quote-title">
      <Gift className="size-7" />
      <h3 id="gift-quote-title" className="mt-4 text-2xl">Build a gift estimate</h3>
      <p className="mt-2 text-on-forest/75">Prepaid annual access, one gift code per recipient. No payment is taken on this page.</p>
      <fieldset className="mt-6"><legend className="text-sm font-semibold">Plan</legend><div className="mt-2 grid grid-cols-2 gap-2">{(["essential", "plus"] as const).map((item) => <label key={item} className={`cursor-pointer rounded-2xl border px-4 py-3 capitalize ${plan === item ? "border-on-forest bg-on-forest/15" : "border-on-forest/25"}`}><input type="radio" name="gift-plan" className="sr-only" checked={plan === item} onChange={() => setPlan(item)} /><span className="block font-semibold">{item}</span><span className="money text-sm text-on-forest/75">{inr(item === "essential" ? 449 : 899)}/year each</span></label>)}</div></fieldset>
      <label htmlFor="gift-quantity" className="mt-5 block text-sm font-semibold">Number of gifts</label><input id="gift-quantity" type="number" min="1" max="10000" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(10000, Number(event.target.value) || 1)))} className="mt-2 w-full rounded-2xl border border-on-forest/30 bg-on-forest/10 px-4 py-3 text-on-forest outline-none focus:border-on-forest" />
      <div className="mt-6 space-y-2 border-t border-on-forest/20 pt-5"><p className="flex justify-between text-on-forest/75"><span>Annual price × {quantity}</span><span className="money">{inr(quote.subtotal)}</span></p><p className="flex justify-between text-on-forest/75"><span>Gift discount · {Math.round(quote.rate * 100)}%</span><span className="money">−{inr(quote.discount)}</span></p><p className="flex items-end justify-between pt-3 text-xl font-bold"><span>Estimated total</span><span className="money text-3xl">{inr(quote.total)}</span></p></div>
      <p className="mt-4 text-xs text-on-forest/65">Estimate before any applicable taxes. We confirm the final amount and terms before asking for payment.</p>
    </section>

    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8" aria-labelledby="gift-request-title">
      <PackageCheck className="size-7 text-forest" />
      <h3 id="gift-request-title" className="mt-4 text-2xl">Request this gift order</h3>
      <p className="mt-2 text-muted-foreground">For family, friends, teams or communities: one unique code per person, delivered by email.</p>
      <OpensWithPlans title="Gift orders open with paid plans" body={`Discounts then: ${GIFT_DISCOUNTS.map((tier) => `${tier.label} for ${tier.minimum}–${tier.maximum ?? "∞"}`).join("; ")}. Hear when gifts open:`} source="spread-gifts" />
    </section>
  </div>;
}
