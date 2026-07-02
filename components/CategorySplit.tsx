import React, { useMemo, useState, useEffect } from 'react';
import { AppScreen, Transaction, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { prettyMerchant } from '../services/analyticsService';
import { WallEMascot, FloatingLeaf, MandalaDots, RangoliCorner, Paisley } from './SplashScreen';

interface CategorySplitProps {
  onNavigate: (screen: AppScreen) => void;
}

type TimeRange = 'WEEK' | 'MONTH' | 'YEAR';
type View = 'SPEND' | 'MOVED';

// Money moved (transfers/investments) analyzed separately from money spent —
// same rule the reports use, so numbers agree everywhere.
const MOVED_CATS = new Set(['Transfer Out', 'Adjustment', 'Investment']);

const COLORS = ['#9BAE93', '#D4A5A5', '#B8B5D0', '#9CB5C1', '#D6C6B2', '#E8C1A0', '#AED5D5', '#C5B8D9'];

interface CatEntry {
  name: string;
  val: number;
  txCount: number;
  share: number; // 0..1 of the active view total
  color: string;
  merchants: [string, number][]; // top 5 by amount (raw names)
}

const pct = (share: number): string => {
  const p = share * 100;
  if (p === 0) return '0%';
  return p >= 1 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
};

const CategorySplit: React.FC<CategorySplitProps> = ({ onNavigate }) => {
  const { transactions, formatAmount, formatAmountCompact } = useWallet();
  const [timeRange, setTimeRange] = useState<TimeRange>('MONTH');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [view, setView] = useState<View>('SPEND');
  const [selCat, setSelCat] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Auto-detect the month with most recent transactions
  const latestTxDate = useMemo(() => {
    if (transactions.length === 0) return new Date();
    let maxTs = -Infinity;
    for (const t of transactions) {
      const ts = new Date(t.date).getTime();
      if (ts > maxTs) maxTs = ts;
    }
    return new Date(maxTs);
  }, [transactions]);

  const [selectedDate, setSelectedDate] = useState(latestTxDate);
  useEffect(() => { setSelectedDate(latestTxDate); }, [latestTxDate]);
  useEffect(() => { setSelCat(null); setExpanded(null); }, [timeRange, selectedDate, view]);

  // Filter expenses for the period
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (t.type !== TransactionType.EXPENSE) return false;
      const txDate = new Date(t.date);
      if (timeRange === 'WEEK') {
        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return txDate >= startOfWeek && txDate < endOfWeek;
      } else if (timeRange === 'MONTH') {
        return txDate.getMonth() === selectedDate.getMonth() &&
               txDate.getFullYear() === selectedDate.getFullYear();
      }
      return txDate.getFullYear() === selectedDate.getFullYear();
    });
  }, [transactions, selectedDate, timeRange]);

  // One pass: split spend vs moved, aggregate per category with merchants
  const data = useMemo(() => {
    const build = () => new Map<string, { val: number; count: number; merchants: Map<string, number> }>();
    const spendMap = build(), movedMap = build();
    let spendTotal = 0, movedTotal = 0;

    for (const t of filtered) {
      const isMoved = MOVED_CATS.has(t.category);
      const map = isMoved ? movedMap : spendMap;
      if (isMoved) movedTotal += t.amount; else spendTotal += t.amount;
      let e = map.get(t.category);
      if (!e) { e = { val: 0, count: 0, merchants: new Map() }; map.set(t.category, e); }
      e.val += t.amount; e.count++;
      const mer = t.merchant || 'Unknown';
      e.merchants.set(mer, (e.merchants.get(mer) || 0) + t.amount);
    }

    const toEntries = (map: typeof spendMap, total: number): CatEntry[] =>
      [...map.entries()]
        .sort((a, b) => b[1].val - a[1].val)
        .map(([name, e], i) => ({
          name,
          val: e.val,
          txCount: e.count,
          share: total > 0 ? e.val / total : 0,
          color: COLORS[i % COLORS.length],
          merchants: [...e.merchants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
        }));

    return {
      spend: toEntries(spendMap, spendTotal),
      moved: toEntries(movedMap, movedTotal),
      spendTotal,
      movedTotal,
    };
  }, [filtered]);

  const activeCats = view === 'SPEND' ? data.spend : data.moved;
  const activeTotal = view === 'SPEND' ? data.spendTotal : data.movedTotal;
  const selected = selCat ? activeCats.find(c => c.name === selCat) ?? null : null;

  // ── Donut geometry: stroked SVG arcs, tap to select ──
  const R = 74, SW = 26, C = 2 * Math.PI * R;
  const segments = useMemo(() => {
    let acc = 0;
    return activeCats.map(c => {
      const len = c.share * C;
      const seg = { name: c.name, color: c.color, len, offset: acc };
      acc += len;
      return seg;
    });
  }, [activeCats, C]);

  const handleMonthChange = (offset: number) => {
    const newDate = new Date(selectedDate);
    if (timeRange === 'YEAR') newDate.setFullYear(newDate.getFullYear() + offset);
    else newDate.setMonth(newDate.getMonth() + offset);
    setSelectedDate(newDate);
  };

  const getIcon = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes('food') || lower.includes('dining') || lower.includes('restaurant')) return 'restaurant';
    if (lower.includes('grocer')) return 'local_grocery_store';
    if (lower.includes('transport') || lower.includes('taxi') || lower.includes('fuel') || lower.includes('metro') || lower.includes('train') || lower.includes('flight')) return 'commute';
    if (lower.includes('shop') || lower.includes('cloth') || lower.includes('electronic')) return 'shopping_bag';
    if (lower.includes('transfer') || lower.includes('adjust')) return 'swap_horiz';
    if (lower.includes('cash') || lower.includes('atm')) return 'atm';
    if (lower.includes('bill') || lower.includes('utilit') || lower.includes('phone') || lower.includes('internet')) return 'receipt_long';
    if (lower.includes('health') || lower.includes('pharma') || lower.includes('doctor')) return 'medication';
    if (lower.includes('stream') || lower.includes('movie') || lower.includes('music') || lower.includes('game')) return 'movie';
    if (lower.includes('education')) return 'school';
    if (lower.includes('rent') || lower.includes('emi') || lower.includes('loan') || lower.includes('credit')) return 'home';
    if (lower.includes('invest')) return 'trending_up';
    if (lower.includes('insurance')) return 'shield';
    if (lower.includes('subscription') || lower.includes('gym')) return 'subscriptions';
    return 'category';
  };

  const periodLabel = timeRange === 'WEEK'
    ? (() => {
        const s = new Date(selectedDate);
        s.setDate(selectedDate.getDate() - selectedDate.getDay());
        const e = new Date(s); e.setDate(s.getDate() + 6);
        return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
      })()
    : timeRange === 'MONTH'
    ? selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : String(selectedDate.getFullYear());

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] lg:max-w-3xl mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      <FloatingLeaf className="top-24 right-5 opacity-35" delay={0.7} />
      <FloatingLeaf className="top-60 left-3 opacity-25" delay={2} color="#A8B89E" />
      <MandalaDots className="absolute top-36 left-4 opacity-20" />
      <RangoliCorner className="absolute top-20 right-2 opacity-20" color="#C4A98E" mirror />
      <Paisley className="absolute bottom-36 left-6 opacity-25" flip />

      {/* Header */}
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.ANALYSIS)}
          className="text-muted-taupe flex size-10 shrink-0 items-center justify-start hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">chevron_left</span>
        </button>
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">Category Split</h2>
        <div className="flex w-10 items-center justify-end text-muted-taupe relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`flex items-center justify-center rounded-full h-10 w-10 border border-black/5 transition-colors ${showDatePicker ? 'bg-sage text-white' : 'bg-white/50 hover:bg-white'}`}
          >
            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
          </button>
          {showDatePicker && (
            <div className="absolute top-12 right-0 bg-white rounded-2xl shadow-xl border border-black/5 p-4 z-[60] animate-slide-up w-52">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => handleMonthChange(-1)} className="p-1 text-muted-taupe hover:text-sage">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <span className="font-serif font-bold text-premium-charcoal text-sm">{periodLabel}</span>
                <button onClick={() => handleMonthChange(1)} className="p-1 text-muted-taupe hover:text-sage">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
              <button
                onClick={() => { setSelectedDate(latestTxDate); setShowDatePicker(false); }}
                className="w-full mt-2 text-[10px] uppercase tracking-widest font-bold text-sage py-2 hover:bg-sage-light/30 rounded-lg"
              >
                Latest Data
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Donut — real SVG segments, tap a slice to inspect it */}
      <div className="flex flex-col items-center py-6 px-6">
        <div className="relative w-[220px] h-[220px]">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            {segments.length === 0 ? (
              <circle cx="100" cy="100" r={R} fill="none" stroke="#EFEDE8" strokeWidth={SW} />
            ) : segments.map(s => (
              <circle
                key={s.name}
                cx="100" cy="100" r={R} fill="none"
                stroke={s.color}
                strokeWidth={selCat === s.name ? SW + 6 : SW}
                strokeDasharray={`${Math.max(0.5, s.len - 1.5)} ${C - Math.max(0.5, s.len - 1.5)}`}
                strokeDashoffset={-s.offset}
                opacity={selCat && selCat !== s.name ? 0.25 : 1}
                onClick={() => setSelCat(selCat === s.name ? null : s.name)}
                className="cursor-pointer transition-all duration-200"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-8 text-center">
            {selected ? (
              <>
                <span className="text-muted-taupe text-[9px] font-medium uppercase tracking-[0.15em] truncate max-w-full">{selected.name}</span>
                <span className="text-premium-charcoal font-serif text-2xl font-bold">{formatAmount(selected.val).split('.')[0]}</span>
                <span className="text-[10px] font-semibold mt-0.5" style={{ color: selected.color }}>
                  {pct(selected.share)} · {selected.txCount} txn{selected.txCount === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              <>
                <span className="text-muted-taupe text-[9px] font-medium uppercase tracking-[0.15em]">{view === 'SPEND' ? 'Spent' : 'Moved'}</span>
                <span className="text-premium-charcoal font-serif text-2xl font-bold">{formatAmount(activeTotal).split('.')[0]}</span>
                <span className={`text-[10px] font-semibold mt-0.5 ${view === 'SPEND' ? 'text-rose' : 'text-muted-taupe'}`}>{periodLabel}</span>
              </>
            )}
          </div>
        </div>
        <p className="text-muted-taupe text-[11px] mt-3">
          {filtered.length} transactions · tap a slice to inspect
        </p>
      </div>

      {/* Spending vs Moved switch — transfers/investments analyzed separately */}
      {data.movedTotal > 0 && (
        <div className="flex justify-center px-6 mb-4">
          <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-black/5 w-full max-w-[360px]">
            <button
              onClick={() => setView('SPEND')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${view === 'SPEND' ? 'bg-rose/10 text-rose shadow-sm' : 'text-muted-taupe'}`}
            >
              Spending · {formatAmountCompact(data.spendTotal)}
            </button>
            <button
              onClick={() => setView('MOVED')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${view === 'MOVED' ? 'bg-sage/10 text-sage shadow-sm' : 'text-muted-taupe'}`}
            >
              Moved · {formatAmountCompact(data.movedTotal)}
            </button>
          </div>
        </div>
      )}

      {/* Time Range Toggle */}
      <div className="flex justify-center gap-2 px-6 mb-6">
        {(['WEEK', 'MONTH', 'YEAR'] as TimeRange[]).map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-all ${
              timeRange === range
                ? 'bg-sage text-white shadow-soft'
                : 'bg-white border border-black/5 text-muted-taupe hover:bg-white/80'
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Categories List — tap a row to see where it went */}
      <div className="px-6 space-y-3 pb-8 lg:columns-2 lg:gap-x-5">
        <div className="flex justify-between items-center mb-4 break-inside-avoid">
          <h3 className="text-premium-charcoal text-[15px] font-serif font-semibold tracking-tight">
            {view === 'SPEND' ? 'Where it went' : 'Where it moved'}
          </h3>
          <span className="text-[10px] text-muted-taupe">{activeCats.length} categor{activeCats.length === 1 ? 'y' : 'ies'}</span>
        </div>

        {activeCats.length > 0 ? activeCats.map(item => {
          const isOpen = expanded === item.name;
          return (
            <div
              key={item.name}
              onClick={() => { setExpanded(isOpen ? null : item.name); setSelCat(item.name === selCat && isOpen ? null : item.name); }}
              className={`bg-white p-4 rounded-3xl border shadow-soft break-inside-avoid cursor-pointer transition-all ${selCat === item.name ? 'border-black/10 ring-1' : 'border-black/[0.02] active:scale-[0.99]'}`}
              style={selCat === item.name ? { boxShadow: `0 0 0 1.5px ${item.color}` } : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="p-2.5 rounded-2xl shrink-0"
                    style={{ backgroundColor: item.color + '33', color: item.color }}
                  >
                    <span className="material-symbols-outlined text-[20px]">{getIcon(item.name)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-premium-charcoal font-serif font-semibold text-[14px] truncate">{item.name}</p>
                    <p className="text-muted-taupe text-[10px] font-medium">
                      {item.txCount} txn{item.txCount !== 1 ? 's' : ''} · {pct(item.share)} · avg {formatAmountCompact(item.val / item.txCount)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-premium-charcoal font-serif font-bold text-[15px] whitespace-nowrap tabular-nums">
                    {item.val >= 100000 ? formatAmountCompact(item.val) : formatAmount(item.val).split('.')[0]}
                  </p>
                  <span className={`material-symbols-outlined text-[16px] text-muted-taupe/50 transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </div>
              </div>

              {/* Share bar */}
              <div className="h-1.5 bg-zen-bg rounded-full overflow-hidden mt-3">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, item.share * 100)}%`, backgroundColor: item.color }} />
              </div>

              {/* Drill-down: top merchants inside this category */}
              {isOpen && item.merchants.length > 0 && (
                <div className="mt-3 pt-3 border-t border-black/5 space-y-2">
                  {item.merchants.map(([mer, amt]) => (
                    <div key={mer} className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] text-premium-charcoal truncate flex-1" title={mer}>{prettyMerchant(mer)}</span>
                      <span className="text-[11px] font-semibold text-premium-charcoal shrink-0 tabular-nums">{formatAmountCompact(amt)}</span>
                      <span className="text-[9px] text-muted-taupe shrink-0 w-8 text-right">{pct(amt / item.val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }) : (
          <div className="flex flex-col items-center py-12 break-inside-avoid">
            <WallEMascot mood="sad" message={view === 'SPEND' ? 'No spending here...' : 'Nothing moved...'} size="md" />
            <p className="text-muted-taupe text-sm mt-4">No {view === 'SPEND' ? 'expenses' : 'transfers'} for this period</p>
            <p className="text-muted-taupe/70 text-xs mt-1">Try a different time range{data.movedTotal > 0 || data.spendTotal > 0 ? ' or switch the view above' : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategorySplit;
