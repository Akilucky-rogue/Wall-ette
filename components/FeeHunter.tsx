import React, { useMemo, useState } from 'react';
import { AppScreen, Transaction, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { huntSavings, normalizeMerchant, prettyMerchant } from '../services/analyticsService';
import { WallEMascot, FloatingLeaf, RangoliCorner, MandalaDots } from './SplashScreen';

interface FeeHunterProps {
  onNavigate: (screen: AppScreen) => void;
}

const FeeHunter: React.FC<FeeHunterProps> = ({ onNavigate }) => {
  const { transactions, formatAmount, formatAmountCompact, deleteTransactions } = useWallet();
  const [cleaning, setCleaning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const hunt = useMemo(() => huntSavings(transactions), [transactions]);

  // Exact duplicates INSIDE the wallet (same date + type + amount + merchant,
  // both imported) — usually the result of "Include Anyway" on an overlap.
  const walletDupes = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const key = `${t.date.slice(0, 10)}|${t.type}|${t.amount.toFixed(2)}|${normalizeMerchant(t.merchant || '')}|${(t.merchant || '').slice(0, 60)}`;
      const g = groups.get(key);
      if (g) g.push(t);
      else groups.set(key, [t]);
    }
    const surplus: Transaction[] = [];
    let net = 0, groupCount = 0;
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      groupCount++;
      for (const t of g.slice(1)) {
        surplus.push(t);
        net += t.type === TransactionType.INCOME ? t.amount : -t.amount;
      }
    }
    return { surplus, net, groupCount };
  }, [transactions]);

  const cleanDupes = () => {
    if (cleaning || walletDupes.surplus.length === 0) return;
    const ok = window.confirm(
      `Remove ${walletDupes.surplus.length} duplicate entr${walletDupes.surplus.length === 1 ? 'y' : 'ies'}? ` +
      `One copy of each transaction is kept. This corrects your balance by ${formatAmount(Math.abs(walletDupes.net))}.`
    );
    if (!ok) return;
    setCleaning(true);
    deleteTransactions(walletDupes.surplus.map(t => t.id));
    setToast(`Removed ${walletDupes.surplus.length} duplicates — balance corrected`);
    setTimeout(() => setToast(null), 3500);
    setCleaning(false);
  };
  const fmt = (n: number) => formatAmount(n).split('.')[0];
  const dl = (s: string) =>
    new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });

  const hasFindings = hunt.totalFound > 0.5;

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] lg:max-w-3xl mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      <FloatingLeaf className="top-24 right-6 opacity-40" delay={0.4} />
      <FloatingLeaf className="top-56 left-4 opacity-30" delay={1.5} color="var(--sage-3)" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="var(--sage-2)" />
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
                {fmt(hunt.fees.total)} in bank charges · {fmt(hunt.creep.annualExtra)}/yr of subscription creep
                {hunt.doubles.pairs.length > 0 ? ` · plus ${hunt.doubles.pairs.length} same-day repeats to review` : ''}
              </p>
            </>
          ) : (
            <p className="text-premium-charcoal text-[14px] leading-relaxed">
              Nothing leaking — no bank fees or subscription price hikes found in your history.
              {hunt.doubles.pairs.length > 0 ? ` ${hunt.doubles.pairs.length} same-day repeat payment${hunt.doubles.pairs.length === 1 ? '' : 's'} listed below for review.` : ' Wall-ette keeps watching.'}
            </p>
          )}
        </div>

        {/* Duplicate entries in the wallet — actionable, fix with one tap */}
        {walletDupes.surplus.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border-2 border-rose/20 break-inside-avoid">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-[10px] uppercase tracking-widest text-rose font-bold">Duplicate entries found</p>
              <p className="text-[13px] font-serif font-bold text-rose">{walletDupes.surplus.length}</p>
            </div>
            <p className="text-[10px] text-muted-taupe mb-4 leading-relaxed">
              {walletDupes.groupCount} transaction{walletDupes.groupCount === 1 ? '' : 's'} exist more than once in your wallet
              (identical date, amount & merchant) — usually from importing an overlapping statement with
              "Include Anyway". They skew your balance by {formatAmountCompact(Math.abs(walletDupes.net))}.
            </p>
            <div className="space-y-2 mb-4 max-h-44 overflow-y-auto">
              {walletDupes.surplus.slice(0, 8).map(t => (
                <div key={t.id} className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose shrink-0" />
                  <span className="text-[10px] text-muted-taupe shrink-0">{t.date.slice(0, 10)}</span>
                  <span className="text-[11px] text-premium-charcoal truncate flex-1" title={t.merchant || ''}>{prettyMerchant(t.merchant || t.category)}</span>
                  <span className={`text-[11px] font-semibold shrink-0 tabular-nums ${t.type === TransactionType.EXPENSE ? 'text-rose' : 'text-sage'}`}>
                    {t.type === TransactionType.EXPENSE ? '-' : '+'}{formatAmountCompact(t.amount)}
                  </span>
                </div>
              ))}
              {walletDupes.surplus.length > 8 && (
                <p className="text-[9px] text-muted-taupe">+{walletDupes.surplus.length - 8} more</p>
              )}
            </div>
            <button
              onClick={cleanDupes}
              disabled={cleaning}
              className="w-full bg-rose text-white py-3 rounded-2xl font-serif text-[14px] font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">cleaning_services</span>
              Remove duplicates · keep one of each
            </button>
          </div>
        )}

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
                    <p className="text-[12px] font-semibold text-premium-charcoal truncate" title={f.merchant}>{prettyMerchant(f.merchant)}</p>
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
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">Same-day repeats · review</p>
              <p className="text-[13px] font-serif font-bold text-amber-600">{fmt(hunt.doubles.total)}</p>
            </div>
            <p className="text-[10px] text-muted-taupe mb-4">
              Same merchant, amount & day (transfers, ATM and pay-requests excluded). Often intentional —
              not counted in the headline. Dispute any you don't recognise.
            </p>
            <div className="space-y-3">
              {hunt.doubles.pairs.map((d, i) => (
                <div key={i} className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-premium-charcoal truncate" title={d.merchant}>{prettyMerchant(d.merchant)}</p>
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
                    <p className="text-[12px] font-semibold text-premium-charcoal truncate" title={c.name}>{prettyMerchant(c.name)}</p>
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

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-premium-charcoal text-white px-6 py-3 rounded-full shadow-xl z-50 flex items-center gap-2">
          <span className="material-symbols-outlined text-sage text-[20px]">check_circle</span>
          <span className="text-[13px] font-medium font-serif">{toast}</span>
        </div>
      )}
    </div>
  );
};

export default FeeHunter;
