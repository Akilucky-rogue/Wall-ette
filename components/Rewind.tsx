import React, { useMemo, useState } from 'react';
import { AppScreen, Transaction, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { localDay, parseDay } from '../utils/dates';
import { prettyMerchant } from '../services/analyticsService';
import { percent, wrapYear } from '../services/wrapped';
import { Mascot } from './ui/Brand';
import WrappedStory from './WrappedStory';
import Garden from './ui/Garden';

interface RewindProps {
  onNavigate: (screen: AppScreen) => void;
}

interface YearAgg {
  inc: number;
  out: number;
  count: number;
  spendDays: Set<string>;
  merchants: Map<string, number>; // expense by merchant
  cats: Map<string, number>;
  monthsOut: number[]; // 12 buckets
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Internal transfers / cash movement / pay-requests aren't "spending moments" —
// they'd otherwise dominate records and top-merchant slots.
const TRANSFER_RX = /^(ift|imps|rtgs)[\s\/\-]|payrequest|^atm[\s\/\-]/i;

const Rewind: React.FC<RewindProps> = ({ onNavigate }) => {
  const { transactions, counted, flowOf, formatWhole, formatAmountCompact } = useWallet();
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const fmt = formatWhole;

  // ── One pass: lifetime + per-year aggregates + records ──
  const life = useMemo(() => {
    if (transactions.length === 0) return null;

    const years = new Map<number, YearAgg>();
    let totalInc = 0, totalOut = 0;
    let first = transactions[0].date, last = transactions[0].date;
    let maxExp: Transaction | null = null, maxInc: Transaction | null = null;
    const spendDates: string[] = [];

    for (const t of transactions) {
      const d = parseDay(t.date);
      const y = d.getFullYear();
      let ya = years.get(y);
      if (!ya) {
        ya = { inc: 0, out: 0, count: 0, spendDays: new Set(), merchants: new Map(), cats: new Map(), monthsOut: Array(12).fill(0) };
        years.set(y, ya);
      }
      ya.count++;
      if (t.date < first) first = t.date;
      if (t.date > last) last = t.date;
      // Money moved to your own accounts, family or investments is neither
      // income nor spending (audit H3): it counts as an entry, nothing more.
      if (flowOf(t).flow === 'moved') continue;
      const isTransfer = TRANSFER_RX.test(t.merchant || '');
      if (t.type === TransactionType.INCOME) {
        totalInc += t.amount; ya.inc += t.amount;
        if (!isTransfer && (!maxInc || t.amount > maxInc.amount)) maxInc = t;
      } else {
        totalOut += t.amount; ya.out += t.amount;
        ya.monthsOut[d.getMonth()] += t.amount;
        ya.spendDays.add(t.date.slice(0, 10));
        spendDates.push(t.date.slice(0, 10));
        const mer = t.merchant || t.category;
        if (!isTransfer) ya.merchants.set(mer, (ya.merchants.get(mer) || 0) + t.amount);
        ya.cats.set(t.category, (ya.cats.get(t.category) || 0) + t.amount);
        if (!isTransfer && (!maxExp || t.amount > maxExp.amount)) maxExp = t;
      }
    }

    // Longest no-spend streak — measured over the last 24 months only, where
    // the record is dense. (Sparse early years would fake huge streaks.)
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 24);
    const cutoffKey = localDay(cutoff);
    const uniq = [...new Set(spendDates)].filter(d => d >= cutoffKey).sort();
    let streak = 0, streakFrom = '', streakTo = '';
    for (let i = 1; i < uniq.length; i++) {
      const gap = (Date.parse(uniq[i]) - Date.parse(uniq[i - 1])) / 86400000 - 1;
      if (gap > streak) { streak = gap; streakFrom = uniq[i - 1]; streakTo = uniq[i]; }
    }

    const yearRows = [...years.entries()].sort((a, b) => a[0] - b[0]);
    const maxYearFlow = Math.max(...yearRows.map(([, v]) => Math.max(v.inc, v.out)), 1);

    // "On this day" across previous years
    const now = new Date();
    const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const onThisDay = transactions
      .filter(t => t.date.slice(5, 10) === md && parseDay(t.date).getFullYear() < now.getFullYear())
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 4);

    const spanDays = Math.round((Date.parse(last) - Date.parse(first)) / 86400000) + 1;

    return {
      first, last, spanDays,
      yearsCount: yearRows.length,
      totalInc, totalOut,
      lifeRate: totalInc > 0 ? Math.round(((totalInc - totalOut) / totalInc) * 100) : 0,
      txCount: transactions.length,
      maxExp, maxInc,
      streak: streak > 0 ? { days: streak, from: streakFrom, to: streakTo } : null,
      yearRows, maxYearFlow,
      onThisDay,
    };
  }, [transactions, flowOf]);

  const wrapYears = useMemo(() => (life ? life.yearRows.map(([y]) => y).reverse() : []), [life]);
  const activeWrapYear = pickedYear ?? (wrapYears[0] ?? null);
  // Wall·ette Wrapped for the year picked (services/wrapped.ts), played as a
  // story that ends on the card to share (components/WrappedStory.tsx).
  const wrapped = useMemo(
    () => (activeWrapYear === null ? null : wrapYear(transactions, counted, activeWrapYear)),
    [transactions, counted, activeWrapYear],
  );

  return (
    <div className="relative flex h-auto min-h-page w-full flex-col max-w-[430px] md:max-w-3xl lg:max-w-5xl mx-auto overflow-x-hidden pb-32 lg:pb-12 bg-zen-bg">
      <Garden />

      {/* Header */}
      <div className="flex items-center gap-2 bg-zen-bg/85 backdrop-blur-md px-5 pt-6 pb-3 sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
          aria-label="Back to Home"
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
        </button>
        <h2 className="text-premium-charcoal text-[22px] font-display font-bold tracking-tight leading-tight flex-1 truncate">Rewind</h2>
      </div>

      {!life ? (
        <div className="flex flex-col items-center py-16 px-6 text-center">
          <Mascot pose="think" height={112} />
          <p className="text-premium-charcoal font-display text-lg font-bold mt-4">No history yet</p>
          <p className="text-muted-taupe text-[13px] mt-2 max-w-xs">Import your bank statements and Wall-ette will rebuild your entire money timeline.</p>
        </div>
      ) : (
        <div className="px-6 pt-2 space-y-4 lg:columns-2 lg:gap-x-5">
          {/* Wall·ette Wrapped */}
          {wrapped && (
            <section className="wallet rounded-[30px] px-6 pt-6 pb-5 shadow-raised overflow-hidden break-inside-avoid" aria-labelledby="wrapped-title">
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-denim-mut">Wall·ette Wrapped</p>
                    <h3 id="wrapped-title" className="wallet-emboss font-display font-extrabold text-[40px] leading-none mt-1">
                      {wrapped.year}{wrapped.current && <span className="text-[16px] font-sans font-medium text-denim-mut"> so far</span>}
                    </h3>
                  </div>
                  <Mascot pose={wrapped.kept >= 0 ? 'celebrate' : 'encourage'} height={84} className="-mt-1 -mr-1 shrink-0" />
                </div>
                {wrapYears.length > 1 && (
                  <div className="denim-track inline-flex rounded-full p-0.5 mt-4 max-w-full overflow-x-auto no-scrollbar" role="group" aria-label="Year">
                    {wrapYears.slice(0, 5).map(y => (
                      <button
                        key={y}
                        onClick={() => setPickedYear(y)}
                        aria-pressed={activeWrapYear === y}
                        className={`px-3 py-1 rounded-full text-[12px] font-semibold shrink-0 transition-all ${activeWrapYear === y ? 'denim-on' : 'text-denim-mut'}`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2.5 mt-4">
                  <div className="wallet-pocket rounded-2xl px-3 py-2.5 min-w-0">
                    <p className="text-[11px] text-denim-mut">Came in</p>
                    <p className="text-[15px] font-semibold tabular-nums truncate">{formatAmountCompact(wrapped.inc)}</p>
                  </div>
                  <div className="wallet-pocket rounded-2xl px-3 py-2.5 min-w-0">
                    <p className="text-[11px] text-denim-mut">Went out</p>
                    <p className="text-[15px] font-semibold tabular-nums truncate">{formatAmountCompact(wrapped.out)}</p>
                  </div>
                  <div className="wallet-pocket rounded-2xl px-3 py-2.5 min-w-0">
                    <p className="text-[11px] text-denim-mut">Kept</p>
                    <p className="text-[15px] font-semibold tabular-nums truncate">{wrapped.rate === null ? '—' : percent(Math.max(0, wrapped.rate) / 100)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPlaying(true)}
                  className="mt-4 w-full bg-[#FBFAF6] text-[#3E5430] py-3.5 rounded-2xl text-[15px] font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">play_circle</span>
                  Play your {wrapped.year} Wrapped
                </button>
                <p className="mt-2 text-center text-[12px] text-denim-mut">Ends on a card you can share. Amounts stay off it unless you add them.</p>
              </div>
            </section>
          )}

          {/* Lifetime hero */}
          <div className="bg-white rounded-3xl p-6 shadow-soft border border-black/[0.02] break-inside-avoid">
            <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-1">Your money since {parseDay(life.first).getFullYear()}</p>
            <p className="text-premium-charcoal font-display text-[26px] font-bold leading-tight">
              {life.yearsCount} {life.yearsCount === 1 ? 'year' : 'years'} · {life.txCount.toLocaleString('en-IN')} entries
            </p>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div>
                <p className="text-[9px] text-muted-taupe uppercase tracking-wider">Earned</p>
                <p className="text-[14px] font-semibold text-sage whitespace-nowrap tabular-nums">{formatAmountCompact(life.totalInc)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-taupe uppercase tracking-wider">Spent</p>
                <p className="text-[14px] font-semibold text-rose whitespace-nowrap tabular-nums">{formatAmountCompact(life.totalOut)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-taupe uppercase tracking-wider">Kept</p>
                <p className="text-[14px] font-semibold text-premium-charcoal whitespace-nowrap tabular-nums">{life.lifeRate}%</p>
              </div>
            </div>
          </div>

          {/* Year by year */}
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
            <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-4">Year by year</p>
            <div className="space-y-2.5">
              {life.yearRows.map(([y, v]) => (
                <div key={y} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-taupe w-9 shrink-0">{y}</span>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="h-1.5 bg-zen-bg rounded-full overflow-hidden">
                      <div className="h-full bg-sage rounded-full" style={{ width: `${Math.max(2, (v.inc / life.maxYearFlow) * 100)}%` }} />
                    </div>
                    <div className="h-1.5 bg-zen-bg rounded-full overflow-hidden">
                      <div className="h-full bg-rose/70 rounded-full" style={{ width: `${Math.max(2, (v.out / life.maxYearFlow) * 100)}%` }} />
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold shrink-0 tabular-nums w-16 text-right ${v.inc - v.out >= 0 ? 'text-sage' : 'text-rose'}`}>
                    {v.inc - v.out >= 0 ? '+' : '−'}{formatAmountCompact(Math.abs(v.inc - v.out))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Records */}
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
            <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-4">All-time records</p>
            <div className="space-y-3">
              {life.maxExp && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-rose-light text-rose flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                  </div>
                  <p className="text-[12px] text-premium-charcoal leading-relaxed pt-1 min-w-0 break-words">
                    Biggest spend ever: <b>{fmt(life.maxExp.amount)}</b> — {prettyMerchant(life.maxExp.merchant || life.maxExp.category)}, {parseDay(life.maxExp.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
              {life.maxInc && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-sage-light text-sage flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[14px]">emoji_events</span>
                  </div>
                  <p className="text-[12px] text-premium-charcoal leading-relaxed pt-1 min-w-0 break-words">
                    Biggest credit ever: <b>{fmt(life.maxInc.amount)}</b> — {prettyMerchant(life.maxInc.merchant || life.maxInc.category)}, {parseDay(life.maxInc.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
              {life.streak && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-sand-light text-sand flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[14px]">self_improvement</span>
                  </div>
                  <p className="text-[12px] text-premium-charcoal leading-relaxed pt-1 min-w-0">
                    Longest no-spend streak: <b>{life.streak.days} days</b> ({parseDay(life.streak.from).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} · last 2 yrs)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* On this day */}
          {life.onThisDay.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] break-inside-avoid">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-4">On this day</p>
              <div className="space-y-2.5">
                {life.onThisDay.map(t => (
                  <div key={t.id} className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-muted-taupe w-9 shrink-0">{parseDay(t.date).getFullYear()}</span>
                    <span className="text-[11px] text-premium-charcoal truncate flex-1" title={t.merchant || t.category}>{prettyMerchant(t.merchant || t.category)}</span>
                    <span className={`text-[11px] font-semibold shrink-0 tabular-nums ${t.type === TransactionType.EXPENSE ? 'text-rose' : 'text-sage'}`}>
                      {t.type === TransactionType.EXPENSE ? '-' : '+'}{formatAmountCompact(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {playing && wrapped && (
        <WrappedStory year={wrapped} money={formatWhole} onClose={() => setPlaying(false)} />
      )}
    </div>
  );
};

export default Rewind;
