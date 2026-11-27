import { Gift, Users } from "lucide-react";
import { REFERRAL_REWARD } from "@/lib/programs";
import { OpensWithPlans } from "./OpensWithPlans";

/** Referral codes arrive with paid plans; until then the panel says so. */
export function ReferralPanel({ initialCode }: { initialCode: string }) {
  const code = /^WAL-[A-Z0-9]{8}$/.test(initialCode.trim().toUpperCase()) ? initialCode.trim().toUpperCase() : "";
  return <div className="grid gap-6 lg:grid-cols-2">
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8" aria-labelledby="your-code-title">
      <Users className="size-7 text-forest" aria-hidden />
      <h3 id="your-code-title" className="mt-4 text-2xl">Your referral code</h3>
      <p className="mt-2 text-muted-foreground">For Wall·ette members. Share your own link; friends never see any of your financial data.</p>
      <OpensWithPlans title="Codes arrive with paid plans" body="Every account gets one reusable code when Essential and Plus start. It will show here and in the app." source="spread-refer" />
    </section>

    <section className="rounded-3xl bg-forest-gradient p-6 text-on-forest shadow-soft sm:p-8" aria-labelledby="friend-code-title">
      <Gift className="size-7" aria-hidden />
      <h3 id="friend-code-title" className="mt-4 text-2xl">Have a friend’s code?</h3>
      <p className="mt-2 text-on-forest/75">You’ll attach it to your membership when paid plans start. One referral code per member; self-referrals and repeat redemptions don’t qualify.</p>
      {code && <p className="mt-6 rounded-2xl border border-dashed border-on-forest/40 p-4 text-center"><span className="block text-xs uppercase tracking-[0.16em] text-on-forest/70">Code to keep</span><span className="money mt-1 block text-2xl font-bold tracking-wider">{code}</span></p>}
      <OpensWithPlans tone="forest" title="Not open yet" body="Keep the link your friend sent; it will still work when referrals open." source="spread-friend" />
      <p className="mt-6 border-t border-on-forest/20 pt-5 text-sm text-on-forest/75">Reward: {REFERRAL_REWARD.freeMonths} month of each person’s current Essential or Plus plan after {REFERRAL_REWARD.qualifiesAfter}. Plus members keep Plus. It does not add another free month to the new-member trial.</p>
    </section>
  </div>;
}
