import React, { useMemo, useState } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { byNewest, localDay, parseDay } from '../utils/dates';
import { huntSavings, prettyMerchant } from '../services/analyticsService';
import { paymentRail } from '../utils/names';
import { openAt } from '../utils/screenSection';
import CurrencySelector from './CurrencySelector';
import UnsortedTransfers from './UnsortedTransfers';
import NotificationCenter from './NotificationCenter';
import { WallEEyes, WallEMascot, FloatingLeaf, LotusFlower, Sprout, RangoliCorner, Diya } from './SplashScreen';
import styles from './Dashboard.module.css';

interface DashboardProps {
  onNavigate: (screen: AppScreen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const {
    getDailyIncome, getDailyExpense, transactions, counted, flowOf, formatAmount,
    formatAmountCompact, isCloudSyncing, isOnline, refresh, openingBalance, budgets,
  } = useWallet();

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 900);
  };

  // Hunter teaser (single pass, memoized) + lifetime hook for Rewind.
  const hunt = useMemo(() => huntSavings(counted), [counted]);
  // Sorted desc — the last element is the earliest transaction.
  const sinceYear = transactions.length > 0
    ? parseDay(transactions[transactions.length - 1].date).getFullYear()
    : null;
  const [periodMode, setPeriodMode] = useState<'MONTH' | 'ALL'>('MONTH'); // 'MONTH' or 'ALL'
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Helper: today's month start
  const currentMonthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  // --- Balance Trend Data (last 12 months) ---
  // Single pass: bucket net flow by calendar month, then cumulative-sum across
  // the 12-month window (audit Phase 2.5 — was 12x3 full scans).
  const balanceTrend = useMemo(() => {
    const endYear = selectedDate.getFullYear();
    const endMonth = selectedDate.getMonth();
    const lastKey = endYear * 12 + endMonth;
    const firstKey = lastKey - 11;

    const inc = new Array(12).fill(0);
    const exp = new Array(12).fill(0);
    let beforeWindow = 0;

    for (const t of transactions) {
      const d = parseDay(t.date);
      const k = d.getFullYear() * 12 + d.getMonth();
      const isIncome = t.type === TransactionType.INCOME;
      if (k < firstKey) beforeWindow += isIncome ? t.amount : -t.amount;
      else if (k <= lastKey) {
        if (isIncome) inc[k - firstKey] += t.amount;
        else exp[k - firstKey] += t.amount;
      }
      // Transactions after the selected month are excluded (as before).
    }

    let running = openingBalance + beforeWindow;
    const months: { label: string; fullLabel: string; value: number; income: number; expense: number; net: number }[] = [];
    for (let i = 0; i < 12; i++) {
      running += inc[i] - exp[i];
      const d = new Date(endYear, endMonth - (11 - i), 1);
      months.push({
        label: d.toLocaleString('default', { month: 'short' }),
        fullLabel: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
        value: running,
        income: inc[i],
        expense: exp[i],
        net: inc[i] - exp[i],
      });
    }
    return months;
  }, [transactions, openingBalance, selectedDate]);

  // Interactive trend selection (audit follow-up: tappable points).
  // Default to the most recent month that actually had activity.
  const [trendIdx, setTrendIdx] = useState<number | null>(null);
  const defaultTrendIdx = useMemo(() => {
    for (let i = balanceTrend.length - 1; i >= 0; i--) {
      if (balanceTrend[i].income > 0 || balanceTrend[i].expense > 0) return i;
    }
    return balanceTrend.length - 1;
  }, [balanceTrend]);

  // --- Period figures (single pass) ---
  // The balance counts every transaction. Income and expenses count only
  // real income and spending: money moved to your own accounts, family or
  // investments is left out (audit H3), so the savings rate means something.
  const { income, expenses, credits, payments, balance, periodLabel } = useMemo(() => {
    const all = periodMode === 'ALL';
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    const monthStart = new Date(year, month, 1);

    let net = 0;              // every transaction up to the end of the period
    let periodIncome = 0;
    let periodExpenses = 0;
    let credits = 0;
    let payments = 0;

    for (const t of transactions) {
      const txDate = parseDay(t.date);
      const inPeriod = all || (txDate.getMonth() === month && txDate.getFullYear() === year);
      if (!inPeriod && txDate >= monthStart) continue; // after the selected month
      const isIncome = t.type === TransactionType.INCOME;
      net += isIncome ? t.amount : -t.amount;
      if (inPeriod && flowOf(t).flow !== 'moved') {
        if (isIncome) { periodIncome += t.amount; credits++; }
        else { periodExpenses += t.amount; payments++; }
      }
    }

    return {
      income: periodIncome,
      expenses: periodExpenses,
      credits,
      payments,
      balance: openingBalance + net,
      periodLabel: all ? 'All Time' : `${selectedDate.toLocaleString('default', { month: 'short' })} ${year}`,
    };
  }, [transactions, flowOf, openingBalance, periodMode, selectedDate]);

  // Today's figures belong under the cards only while they show this month.
  const showingThisMonth = periodMode === 'MONTH' && selectedDate.getTime() === currentMonthStart.getTime();

  // --- Budgets: this calendar month's spending against each category's budget ---
  const budgetRows = useMemo(() => {
    const month = localDay().slice(0, 7);
    const spent = new Map<string, number>();
    for (const t of counted) {
      if (t.type !== TransactionType.EXPENSE || !t.date.startsWith(month)) continue;
      spent.set(t.category, (spent.get(t.category) ?? 0) + t.amount);
    }
    return Object.entries(budgets)
      .filter(([, budget]) => budget > 0)
      .map(([category, budget]) => ({ category, budget, used: spent.get(category) ?? 0 }))
      .sort((a, b) => b.used / b.budget - a.used / a.budget);
  }, [counted, budgets]);
  const openGoals = () => { openAt('goals'); onNavigate(AppScreen.INCOME_INSIGHTS); };

  // --- Savings Rate ---
  const savingsRate = useMemo(() => {
    if (income === 0) return 0;
    return Math.max(0, Math.round(((income - expenses) / income) * 100));
  }, [income, expenses]);

  // --- Top Spend for the period: spending only (audit M7 — it used to add
  // up income too, so Transfer In topped the card) ---
  const categoryBreakdown = useMemo(() => {
    const all = periodMode === 'ALL';
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();

    const cats: Record<string, number> = {};
    for (const t of counted) {
      if (t.type !== TransactionType.EXPENSE) continue;
      if (!all) {
        const txDate = parseDay(t.date);
        if (txDate.getMonth() !== month || txDate.getFullYear() !== year) continue;
      }
      cats[t.category] = (cats[t.category] || 0) + t.amount;
    }

    return Object.entries(cats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));
  }, [counted, periodMode, selectedDate]);

  // Derived helpers for UI logic
  const showAllTime = periodMode === 'ALL';

  // Recent transactions (latest 5)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort(byNewest)
      .slice(0, 5);
  }, [transactions]);


  // Category colors (using CSS module classes to avoid Tailwind purge issues)
  const CAT_COLORS = ['var(--sage)', 'var(--rose)', 'var(--amber)', 'var(--sage-3)', '#94BFCA'] as const;

  // Icons helper
  const getIconForCategory = (cat: string) => {
    const lower = cat.toLowerCase();
    if(lower.includes('salary')) return 'business_center';
    if(lower.includes('freelance')) return 'brush';
    if(lower.includes('invest') || lower.includes('stak')) return 'token';
    return 'payments';
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] md:max-w-3xl mx-auto overflow-x-hidden pb-24 bg-zen-bg">
      {/* Eco decorative elements */}
      <FloatingLeaf className="top-20 right-4 opacity-40 z-10" delay={0} />
      <FloatingLeaf className="top-48 left-3 opacity-30" delay={1.2} color="var(--sage-3)" />
      <Sprout className="absolute bottom-32 right-6 opacity-40" />
      <RangoliCorner className="absolute top-16 right-2 opacity-20" color="var(--gold-1)" mirror />

      {/* Header */}
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 sticky top-0 z-30">
        {/* Left: Logo and Name */}
        <div className="flex items-center gap-3 min-w-0">
          <WallEMascot mood="happy" size="sm" />
          <span className="text-premium-charcoal font-serif text-xl font-bold tracking-tight select-none">Wall-ette</span>
        </div>
        {/* Right: currency and the notification bell */}
        <div className="relative flex items-center ml-auto min-w-0 gap-2">
          <CurrencySelector />
          <NotificationCenter onNavigate={onNavigate} />
        </div>
      </div>

      {/* Balance Summary */}
      <div className="flex flex-col items-center py-10 relative">
        <div className="absolute top-6 left-8">
          <LotusFlower size="sm" color="var(--rose-2)" className="opacity-40" />
        </div>
        <div className="absolute top-8 right-10">
          <LotusFlower size="sm" color="var(--gold-2)" className="opacity-30" />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <p className="text-muted-taupe text-xs font-medium uppercase tracking-[0.2em]">Balance</p>
        </div>
        <div className="flex bg-white/70 border border-sage/10 rounded-full overflow-hidden text-xs font-semibold items-center mb-4">
          <button
            className={`px-3 py-1 min-w-[70px] transition-all ${periodMode === 'MONTH' ? 'bg-sage-light text-sage' : 'text-muted-taupe hover:text-sage'}`}
            onClick={() => {
              setPeriodMode('MONTH');
              setSelectedDate(currentMonthStart); // Reset to current month when switching
            }}
            disabled={periodMode === 'MONTH'}
          >
            Month
          </button>
          <button
            className={`px-3 py-1 min-w-[70px] transition-all ${periodMode === 'ALL' ? 'bg-sage-light text-sage' : 'text-muted-taupe hover:text-sage'}`}
            onClick={() => setPeriodMode('ALL')}
            disabled={periodMode === 'ALL'}
          >
            All Time
          </button>
          {periodMode === 'MONTH' && (
            <>
              <button
                className="ml-2 px-2 py-1 text-muted-taupe hover:text-sage transition-colors"
                onClick={() => setSelectedDate(prev => {
                  // Prevent going before earliest transaction month if needed
                  return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
                })}
                title="Previous Month"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <span className="px-2 text-premium-charcoal font-semibold select-none">{periodLabel}</span>
              <button
                className="px-2 py-1 text-muted-taupe hover:text-sage transition-colors"
                onClick={() => setSelectedDate(prev => {
                  // Prevent going to future months
                  const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
                  const now = currentMonthStart;
                  if (next > now) return prev;
                  return next;
                })}
                title="Next Month"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </>
          )}
        </div>
        <h1 className="text-premium-charcoal font-serif text-[40px] leading-tight px-4 text-center">
            {formatAmount(balance)}
        </h1>
        {/* Sync status: a quiet line under the balance; tap to refresh */}
        <button
          onClick={handleRefresh}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-muted-taupe hover:bg-white/70 active:scale-95 transition-all"
          title="Refresh"
        >
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full ${refreshing ? 'bg-sage motion-safe:animate-pulse' : isCloudSyncing ? 'bg-sage' : isOnline ? 'bg-rose' : 'bg-muted-taupe'}`}
          />
          {refreshing ? 'Refreshing…'
            : isCloudSyncing ? 'Synced'
            : isOnline ? 'Not syncing · Retry'
            : 'Offline · saved on this phone'}
        </button>
      </div>
      {/* Desktop: cards flow into two columns; phones/APK keep the single
          column (CSS columns are inert below md). */}
      <div className="md:columns-2 md:gap-x-0">

      {/* Income and spending for the period picked above */}
      <div className="grid grid-cols-2 gap-4 px-6 py-2 break-inside-avoid">
        {([
          { label: 'Income', amount: income, sign: '+', icon: 'add', tint: 'bg-sage-light text-sage', today: getDailyIncome(), count: credits, noun: 'credit' },
          { label: 'Spending', amount: expenses, sign: '−', icon: 'remove', tint: 'bg-rose-light text-rose', today: getDailyExpense(), count: payments, noun: 'payment' },
        ] as const).map(card => (
          <div key={card.label} className="flex flex-col gap-2 rounded-3xl bg-white p-5 shadow-soft border border-black/[0.02] min-w-0">
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${card.tint}`}>
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{card.icon}</span>
              </span>
              <span className="text-[12px] font-semibold text-muted-taupe">{card.label}</span>
            </div>
            <p className="font-serif text-[22px] leading-tight text-premium-charcoal tabular-nums truncate">
              {card.sign}{formatAmountCompact(card.amount)}
            </p>
            <p className="text-[11px] text-muted-taupe tabular-nums truncate">
              {showingThisMonth
                ? `Today ${card.sign}${formatAmountCompact(card.today)}`
                : `${card.count.toLocaleString('en-IN')} ${card.noun}${card.count === 1 ? '' : 's'}`}
            </p>
          </div>
        ))}
      </div>

      {/* Budgets this month (set in Flow → Goals) */}
      {budgetRows.length > 0 ? (
        <div className="px-6 pt-2 break-inside-avoid">
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">
                Budgets · {new Date().toLocaleString('en-GB', { month: 'long' })}
              </p>
              <button onClick={openGoals} className="text-[10px] text-sage font-semibold uppercase tracking-wider hover:underline">Edit</button>
            </div>
            <div className="space-y-3">
              {budgetRows.slice(0, 4).map(r => {
                const pct = r.used / r.budget;
                const over = r.used > r.budget;
                return (
                  <button key={r.category} onClick={openGoals} className="block w-full text-left">
                    <span className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="font-semibold text-premium-charcoal truncate">{r.category}</span>
                      <span className={`tabular-nums shrink-0 ${over ? 'text-rose font-semibold' : 'text-muted-taupe'}`}>
                        {over
                          ? `${formatAmountCompact(r.used - r.budget)} over`
                          : `${formatAmountCompact(r.used)} of ${formatAmountCompact(r.budget)}`}
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <span
                        className={`block h-full rounded-full ${over ? 'bg-rose' : pct >= 0.8 ? 'bg-sand' : 'bg-sage'}`}
                        style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
            {budgetRows.length > 4 && (
              <button onClick={openGoals} className="mt-3 text-[11px] text-muted-taupe hover:text-sage">
                {budgetRows.length - 4} more in Flow
              </button>
            )}
          </div>
        </div>
      ) : transactions.length > 0 && (
        <div className="px-6 pt-2 break-inside-avoid">
          <button
            onClick={openGoals}
            className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-sage/30 px-4 py-3 text-left hover:bg-white/60 transition-colors"
          >
            <span className="material-symbols-outlined text-sage text-[20px] shrink-0" aria-hidden="true">donut_large</span>
            <span className="flex-1 min-w-0 text-[12px] text-muted-taupe leading-snug">Set monthly budgets, and see how each category is doing here.</span>
            <span className="material-symbols-outlined text-muted-taupe text-[18px] shrink-0" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      )}
      {/* Transfers to unsorted payees count as spending until sorted (audit H3) */}
      <UnsortedTransfers onNavigate={onNavigate} className="px-6 pt-2 break-inside-avoid" />
      {/* Hunter + Rewind teasers — the USP, front and center */}
      {(hunt.totalFound > 0.5 || (sinceYear !== null && transactions.length > 50)) && (
        <div className="px-6 pt-2 pb-1 space-y-3 break-inside-avoid">
          {hunt.totalFound > 0.5 && (
            <button
              onClick={() => onNavigate(AppScreen.HUNTER)}
              className="w-full bg-premium-charcoal rounded-3xl p-4 shadow-soft flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">search_insights</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[13px] font-semibold whitespace-nowrap">
                  {formatAmountCompact(hunt.totalFound)} quietly leaking out
                </p>
                <p className="text-white/50 text-[10px] truncate">fees · double charges · subscription creep</p>
              </div>
              <span className="material-symbols-outlined text-white/40 text-[18px] shrink-0">chevron_right</span>
            </button>
          )}
          {sinceYear !== null && transactions.length > 50 && (
            <button
              onClick={() => onNavigate(AppScreen.REWIND)}
              className="w-full bg-white rounded-3xl p-4 shadow-soft border border-black/[0.02] flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-10 h-10 rounded-2xl bg-sage-light text-sage flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">history</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-premium-charcoal text-[13px] font-semibold">Your money since {sinceYear}</p>
                <p className="text-muted-taupe text-[10px] truncate">{transactions.length.toLocaleString('en-IN')} entries · all-time records · Wrapped</p>
              </div>
              <span className="material-symbols-outlined text-muted-taupe/50 text-[18px] shrink-0">chevron_right</span>
            </button>
          )}
        </div>
      )}
      {/* Quick Services */}
      <div className="px-6 py-8 break-inside-avoid">
        <h3 className="text-premium-charcoal text-[15px] font-serif font-semibold tracking-tight mb-5">Quick Services</h3>
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate(AppScreen.NEW_ENTRY)}
            className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
          >
            <div className="bg-sage-light text-sage p-3 rounded-2xl">
              <span className="material-symbols-outlined">add_box</span>
            </div>
            <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Add</span>
          </button>
          <button
            onClick={() => onNavigate(AppScreen.EXPORT)}
            className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
          >
            <div className="bg-rose-light text-rose p-3 rounded-2xl">
              <span className="material-symbols-outlined">description</span>
            </div>
            <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Report</span>
          </button>
          <button
            onClick={() => onNavigate(AppScreen.INCOME_INSIGHTS)}
            className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
          >
            <div className="bg-blue-50 text-blue-300 p-3 rounded-2xl">
              <span className="material-symbols-outlined">bubble_chart</span>
            </div>
            <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Flow</span>
          </button>
          <button
            onClick={() => onNavigate(AppScreen.IMPORT)}
            className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
          >
            <div className="bg-sand-light text-sand p-3 rounded-2xl">
              <span className="material-symbols-outlined">upload_file</span>
            </div>
            <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Import</span>
          </button>
          <button
            onClick={() => onNavigate(AppScreen.HUNTER)}
            className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
          >
            <div className="bg-amber-50 text-amber-500 p-3 rounded-2xl">
              <span className="material-symbols-outlined">search_insights</span>
            </div>
            <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Hunter</span>
          </button>
          <button
            onClick={() => onNavigate(AppScreen.REWIND)}
            className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
          >
            <div className="bg-lavender/10 text-lavender p-3 rounded-2xl">
              <span className="material-symbols-outlined">history</span>
            </div>
            <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Rewind</span>
          </button>
        </div>
      </div>
      {/* Balance Trend (12 months) — tap a point for details */}
      {balanceTrend.length > 1 && (() => {
        const vals = balanceTrend.map(m => m.value);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const mid = (max + min) / 2;
        const range = max - min || 1;
        const w = 100 / (vals.length - 1);
        // y in 8..92% so points never clip at the card edges
        const ys = vals.map(v => 92 - ((v - min) / range) * 84);
        const linePoints = ys.map((y, i) => `${i * w},${y}`).join(' ');
        const selIdx = trendIdx !== null ? trendIdx : defaultTrendIdx;
        const sel = balanceTrend[selIdx];
        const quiet = sel.income === 0 && sel.expense === 0;
        return (
          <div className="px-6 py-2 mb-2 break-inside-avoid">
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02]">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">12-Month Balance Trend</p>
                <p className="text-[9px] text-muted-taupe/70">tap a point</p>
              </div>
              <div className="flex gap-2">
              {/* Y axis — balance at the top, middle, and bottom gridlines */}
              <div className="relative h-24 w-9 shrink-0">
                <span className="absolute right-0 top-[8%] -translate-y-1/2 text-[8px] text-muted-taupe tabular-nums">{formatAmountCompact(max)}</span>
                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[8px] text-muted-taupe/70 tabular-nums">{formatAmountCompact(mid)}</span>
                <span className="absolute right-0 top-[92%] -translate-y-1/2 text-[8px] text-muted-taupe tabular-nums">{formatAmountCompact(min)}</span>
              </div>
              <div className="relative h-24 flex-1">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                  <defs>
                    <linearGradient id="balTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--sage)" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="var(--sage)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* gridlines matching the axis labels */}
                  <line x1="0" y1="8" x2="100" y2="8" stroke="var(--line-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
                  <line x1="0" y1="50" x2="100" y2="50" stroke="var(--line-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
                  <line x1="0" y1="92" x2="100" y2="92" stroke="var(--line-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
                  <polygon points={`0,100 ${linePoints} 100,100`} fill="url(#balTrendFill)" />
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke="var(--sage)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                {/* Points as HTML so they stay perfectly round (SVG stretching
                    turned them into ovals) and get real 28px tap targets */}
                {balanceTrend.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setTrendIdx(trendIdx === i ? null : i)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center"
                    style={{ left: `${i * w}%`, top: `${ys[i]}%` }}
                    aria-label={`${m.fullLabel}: ${formatAmount(m.value)}`}
                  >
                    <span className={`rounded-full border-2 border-sage transition-all ${i === selIdx ? 'w-3.5 h-3.5 bg-sage shadow-sm' : 'w-2 h-2 bg-white'}`} />
                  </button>
                ))}
              </div>
              </div>
              <div className="flex justify-between mt-1 ml-11 mr-1.5">
                {balanceTrend.filter((_, i) => i % 3 === 0 || i === balanceTrend.length - 1).map((m, i) => (
                  <span key={i} className="text-[9px] text-muted-taupe font-medium">{m.label}</span>
                ))}
              </div>
              {/* Selected month detail */}
              <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between gap-2">
                <div className="shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-taupe">{sel.fullLabel}</p>
                  <p className="text-[14px] font-serif font-bold text-premium-charcoal">{formatAmount(sel.value).split('.')[0]}</p>
                </div>
                {quiet ? (
                  <p className="text-[10px] text-muted-taupe italic">No activity this month — balance unchanged</p>
                ) : (
                  <>
                    <div className="text-right text-[10px] font-semibold">
                      <p className="text-sage">+{formatAmount(sel.income).split('.')[0]} in</p>
                      <p className="text-rose">−{formatAmount(sel.expense).split('.')[0]} out</p>
                    </div>
                    <div className={`text-[11px] font-bold px-3 py-1.5 rounded-full shrink-0 ${sel.net >= 0 ? 'bg-sage-light text-sage' : 'bg-rose-light text-rose'}`}>
                      {sel.net >= 0 ? '+' : '−'}{formatAmount(Math.abs(sel.net)).split('.')[0]}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Savings Rate + Category Breakdown */}
      {(income > 0 || categoryBreakdown.length > 0) && (
        <div className="px-6 py-2 mb-2 grid grid-cols-2 gap-4 break-inside-avoid">
          {/* Savings Rate */}
          {income > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] flex flex-col items-center gap-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold self-start">Savings</p>
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="var(--sage-soft)" strokeWidth="4" />
                <circle
                  cx="18" cy="18" r="14" fill="none" stroke="var(--sage)" strokeWidth="4"
                  strokeDasharray={`${(savingsRate / 100) * 88} 88`}
                  strokeLinecap="round"
                  className={styles.savingsGauge}
                />
              </svg>
              <p className="text-premium-charcoal font-serif text-xl font-bold -mt-2">{savingsRate}%</p>
              <p className="text-[10px] text-muted-taupe">of income saved</p>
            </div>
          )}
          {/* Top Categories */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02]">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-3">Top Spend</p>
              <div className="space-y-2">
                {categoryBreakdown.slice(0, income > 0 ? 3 : 5).map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                    <span className="text-[11px] text-premium-charcoal font-medium flex-1 truncate" title={cat.name}>{cat.name}</span>
                    <span className="text-[10px] text-muted-taupe flex-shrink-0 tabular-nums">{formatAmountCompact(cat.amount as number)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Transactions */}
      {recentTransactions.length > 0 && (
        <div className="px-6 py-2 mb-2 break-inside-avoid">
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">Recent</p>
              <button
                onClick={() => onNavigate(AppScreen.HISTORY)}
                className="text-[10px] text-sage font-semibold uppercase tracking-wider hover:underline"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === TransactionType.INCOME ? 'bg-sage-light text-sage' : 'bg-rose-light text-rose'}`}>
                    <span className="material-symbols-outlined text-[15px]">
                      {tx.type === TransactionType.INCOME ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-premium-charcoal truncate" title={tx.merchant || undefined}>
                      {tx.merchant ? prettyMerchant(tx.merchant) : tx.category}
                    </p>
                    <p className="text-[10px] text-muted-taupe truncate">
                      {[paymentRail(tx.merchant), tx.category, parseDay(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={`text-[13px] font-bold flex-shrink-0 ${tx.type === TransactionType.INCOME ? 'text-sage' : 'text-rose'}`}>
                    {tx.type === TransactionType.INCOME ? '+' : '-'}{formatAmount(tx.amount).split('.')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state when no transactions */}
      {transactions.length === 0 && (
        <div className="px-6 py-8 flex flex-col items-center gap-4 text-center break-inside-avoid">
          <div className="w-16 h-16 rounded-full bg-sage-light flex items-center justify-center">
            <span className="material-symbols-outlined text-sage text-[28px]">account_balance_wallet</span>
          </div>
          <div>
            <p className="text-premium-charcoal font-serif text-lg font-semibold">Start your journey</p>
            <p className="text-muted-taupe text-sm mt-1">Add a transaction or import a bank statement to begin.</p>
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => onNavigate(AppScreen.NEW_ENTRY)}
              className="px-5 py-2.5 bg-sage text-white rounded-full text-sm font-semibold shadow-soft active:scale-95 transition-transform"
            >
              Add Entry
            </button>
            <button
              onClick={() => onNavigate(AppScreen.IMPORT)}
              className="px-5 py-2.5 bg-white border border-sage/30 text-sage rounded-full text-sm font-semibold shadow-soft active:scale-95 transition-transform"
            >
              Import
            </button>
          </div>
        </div>
      )}

      </div>{/* /md:columns-2 */}
    </div>
  );
};

export default Dashboard;