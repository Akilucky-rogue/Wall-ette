import React, { useMemo } from 'react';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { huntSavings } from '../services/analyticsService';
import { WallEMascot, FloatingLeaf, RangoliCorner, MandalaDots } from './SplashScreen';

interface FeeHunterProps {
  onNavigate: (screen: AppScreen) => void;
}

const FeeHunter: React.FC<FeeHunterProps> = ({ onNavigate }) => {
  const { transactions, formatAmount, formatAmountCompact } = useWallet();

  const hunt = useMemo(() => huntSavings(transactions), [transactions]);
  const fmt = (n: number) => formatAmount(n).split('.')[0];
  const dl = (s: string) =>
    new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });

  const hasFindings = hunt.totalFound > 0.5;

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] lg:max-w-3xl mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      <FloatingLeaf className="top-24 right-6 opacity-40" delay={0.4} />
      <FloatingLeaf className="top-56 left-4 opacity-30" delay={1.5} color="#A8B89E" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="#8B9E82" />
      <MandalaDots className="absolute bottom-44 right-6 opacity-20" />

      {/* Header */}
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="flex w-10 items-center justify-start text-muted-taupe hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </button>
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">Hunter</h2>
        <div className="relative flex w-10 items-center justify-end text-muted-taupe"></div>
      </div>

      <div className="px-6 pt-2 space-y-4 lg:columns-2 lg:gap-x-5">
        {/* Hero: total found */}
        <div className={`rounded-3xl p-6 shadow-soft border break-inside-avoid ${hasFindings ? 'bg-premium-charcoal border-black/10' : 'bg-white border-black/[0.02]'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`material-symbols-outlined text-[20px] ${hasFindings ? 'text-amber-300' : 'text-sage'}`}>
              {hasFindings ? 'search_insights' : 'verified'}
            </span>
            <p className={`text-[10px] uppercase tracking-widest font-bold ${hasFindings ? 'text-white/60' : 'text-muted-taupe'}`}>
              {hasFindings ? 'Money leaking out' : 'Leak scan'}
            </p>
          </div>
          {hasFindings ? (
            <>
              <p className="text-white font-serif text-[34px] font-bold leading-tight">{fmt(hunt.totalFound)}</p>
              <p className="text-white/70 text-[12px] mt-1 leading-relaxed">
                {fmt(hunt.fees.total)} in bank charges · {fmt(hunt.doubles.total)} in possible double-charges · {fmt(hunt.creep.annualExtra)}/yr of subscription creep
              </p>
            </>
          ) : (
            <p className="text-premium-charcoal text-[14px] leading-relaxed">
              Nothing leaking — no fees, double-charges, or price hikes found in your history. Wall-ette keeps watching.
            </p>
          )}
        </div>

        {/* Bank fees */}
        {hunt.fees.items.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">Bank fees & charges</p>
              <p className="text-[13px] font-serif font-bold text-rose">{fmt(hunt.fees.total)}</p>
            </div>
            <p className="text-[10px] text-muted-taupe mb-4">{hunt.fees.count} charges across your history. Many are negotiable or avoidable — ask your bank.</p>
            <div className="space-y-3">
              {hunt.fees.items.map((f, i) => (
                <div key={i} className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-rose-light text-rose flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-premium-charcoal truncate" title={f.merchant}>{f.merchant}</p>
                    <p className="text-[10px] text-muted-taupe">{f.count}× · last {dl(f.lastDate)}</p>
                  </div>
                  <p className="text-[12px] font-bold text-rose shrink-0 tabular-nums">{formatAmountCompact(f.total)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Double charges */}
        {hunt.doubles.pairs.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">Possible double charges</p>
              <p className="text-[13px] font-serif font-bold text-amber-600">{fmt(hunt.doubles.total)}</p>
            </div>
            <p className="text-[10px] text-muted-taupe mb-4">
              Same merchant, same amount, same day. Some are legit (two coffees) — the rest are worth disputing.
            </p>
            <div className="space-y-3">
              {hunt.doubles.pairs.map((d, i) => (
                <div key={i} className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-premium-charcoal truncate" title={d.merchant}>{d.merchant}</p>
                    <p className="text-[10px] text-muted-taupe">{d.copies}× {formatAmountCompact(d.amount)} on {dl(d.date)}</p>
                  </div>
                  <p className="text-[12px] font-bold text-amber-600 shrink-0 tabular-nums">+{formatAmountCompact((d.copies - 1) * d.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subscription creep */}
        {hunt.creep.items.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">Subscription creep</p>
              <p className="text-[13px] font-serif font-bold text-rose">{fmt(hunt.creep.annualExtra)}/yr</p>
            </div>
            <p className="text-[10px] text-muted-taupe mb-4">Recurring charges that quietly got more expensive since you first paid them.</p>
            <div className="space-y-3">
              {hunt.creep.items.map((c, i) => (
                <div key={i} className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-rose-light text-rose flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-premium-charcoal truncate" title={c.name}>{c.name}</p>
                    <p className="text-[10px] text-muted-taupe">
                      {formatAmountCompact(c.from)} → {formatAmountCompact(c.to)} <span className="text-rose font-semibold">(+{c.pct}%)</span>
                    </p>
                  </div>
                  <p className="text-[12px] font-bold text-rose shrink-0 tabular-nums">+{formatAmountCompact(c.annualExtra)}/yr</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasFindings && (
          <div className="flex flex-col items-center py-10 break-inside-avoid">
            <WallEMascot mood="happy" size="md" message="All clear!" />
          </div>
        )}
      </div>
    </div>
  );
};

export default FeeHunter;
