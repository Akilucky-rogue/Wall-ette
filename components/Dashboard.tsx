import React, { useMemo, useState, useRef, useEffect } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import CurrencySelector from './CurrencySelector';
import { WallEEyes, WallEMascot, FloatingLeaf, LotusFlower, Sprout, RangoliCorner, Diya } from './SplashScreen';
import styles from './Dashboard.module.css';

interface DashboardProps {
  onNavigate: (screen: AppScreen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const {
    getMonthlyIncome, getMonthlyExpense, getDailyIncome, getDailyExpense,
    getTotalIncome, getTotalExpense, transactions, formatAmount,
    formatAmountCompact, isCloudSyncing, refresh, openingBalance
  } = useWallet();

  const [showNotifications, setShowNotifications] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 900);
  };
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
  const notificationRef = useRef<HTMLDivElement>(null);

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
      const d = new Date(t.date);
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

  // --- Income vs Expense Bar Data (single pass) ---
  const { income, expenses, balance, periodLabel } = useMemo(() => {
    if (periodMode === 'ALL') {
      let totalIncome = 0, totalExpenses = 0;
      for (const t of transactions) {
        if (t.type === TransactionType.INCOME) totalIncome += t.amount;
        else totalExpenses += t.amount;
      }
      return {
        income: totalIncome,
        expenses: totalExpenses,
        balance: openingBalance + totalIncome - totalExpenses,
        periodLabel: 'All Time',
      };
    } else {
      const month = selectedDate.getMonth();
      const year = selectedDate.getFullYear();
      const monthStart = new Date(year, month, 1);

      let prevNet = 0;          // net flow of everything before this month
      let monthlyIncome = 0;
      let monthlyExpenses = 0;

      for (const t of transactions) {
        const txDate = new Date(t.date);
        const isIncome = t.type === TransactionType.INCOME;
        if (txDate < monthStart) {
          prevNet += isIncome ? t.amount : -t.amount;
        } else if (txDate.getMonth() === month && txDate.getFullYear() === year) {
          if (isIncome) monthlyIncome += t.amount;
          else monthlyExpenses += t.amount;
        }
      }

      const label = `${selectedDate.toLocaleString('default', { month: 'short' })} ${year}`;
      return {
        income: monthlyIncome,
        expenses: monthlyExpenses,
        balance: openingBalance + prevNet + monthlyIncome - monthlyExpenses,
        periodLabel: label,
      };
    }
  }, [transactions, openingBalance, periodMode, selectedDate]);

  const incomeExpenseBar = useMemo(() => {
    return [
      { label: 'Income', value: income, color: '#9BAE93' },
      { label: 'Expense', value: expenses, color: '#E57373' }
    ];
  }, [income, expenses]);

  // --- Savings Rate ---
  const savingsRate = useMemo(() => {
    if (income === 0) return 0;
    return Math.max(0, Math.round(((income - expenses) / income) * 100));
  }, [income, expenses]);

  // --- Period-scoped stats in ONE pass (audit Phase 2: was 4 separate scans,
  // each re-parsing every transaction date) ---
  const { categoryBreakdown, quickStats, hasMonthlyData, incomeStreams } = useMemo(() => {
    const all = periodMode === 'ALL';
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();

    const cats: Record<string, number> = {};
    const incomeCats: Record<string, number> = {};
    let count = 0;
    let sum = 0;
    let max = 0;

    for (const t of transactions) {
      if (!all) {
        const txDate = new Date(t.date);
        if (txDate.getMonth() !== month || txDate.getFullYear() !== year) continue;
      }
      count++;
      sum += t.amount;
      if (t.amount > max) max = t.amount;
      cats[t.category] = (cats[t.category] || 0) + t.amount;
      if (t.type === TransactionType.INCOME) {
        incomeCats[t.category] = (incomeCats[t.category] || 0) + t.amount;
      }
    }

    return {
      categoryBreakdown: Object.entries(cats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount })),
      quickStats: { count, avg: count > 0 ? sum / count : 0, max },
      hasMonthlyData: all || count > 0,
      incomeStreams: Object.entries(incomeCats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, amount]) => ({ name, amount })),
    };
  }, [transactions, periodMode, selectedDate]);

  // Derived helpers for UI logic
  const showAllTime = periodMode === 'ALL';

  // Recent transactions (latest 5)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [transactions]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // Category colors (using CSS module classes to avoid Tailwind purge issues)
  const CAT_COLORS = ['#9BAE93', '#D4A5A5', '#FBBF24', '#A8B89E', '#94BFCA'] as const;

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
      <FloatingLeaf className="top-48 left-3 opacity-30" delay={1.2} color="#A8B89E" />
      <Sprout className="absolute bottom-32 right-6 opacity-40" />
      <RangoliCorner className="absolute top-16 right-2 opacity-20" color="#C4A98E" mirror />

      {/* Header */}
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 sticky top-0 z-30">
        {/* Left: Logo and Name */}
        <div className="flex items-center gap-3 min-w-0">
          <WallEMascot mood="happy" size="sm" />
          <span className="text-premium-charcoal font-serif text-xl font-bold tracking-tight select-none">Wall-ette</span>
        </div>
        {/* Right: Currency + Notification bell */}
        <div className="relative flex items-center ml-auto min-w-0 gap-2">
          <CurrencySelector />
          <div className="relative" ref={notificationRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`flex items-center justify-center rounded-full h-10 w-10 border border-black/5 transition-colors cursor-pointer ${showNotifications ? 'bg-white text-sage shadow-sm' : 'bg-white/50 text-muted-taupe hover:bg-white'}`}
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose rounded-full"></span>
            </button>
            {showNotifications && (
                <div className="absolute right-0 top-12 w-64 bg-white rounded-2xl shadow-xl border border-black/5 p-4 z-[60] animate-slide-up origin-top-right">
                    <h4 className="text-[11px] font-bold text-muted-taupe uppercase tracking-widest mb-3">Notifications</h4>
                    <div className="space-y-3">
                        <div className="flex gap-3 items-start">
                            <div className="bg-sage-light p-1.5 rounded-lg text-sage">
                                <span className="material-symbols-outlined text-[16px]">shield</span>
                            </div>
                            <div>
                                <p className="text-xs font-serif font-semibold text-premium-charcoal">Security Check</p>
                                <p className="text-[10px] text-muted-taupe">Account is secure. Last login verified.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start">
                            <div className="bg-blue-zen-light p-1.5 rounded-lg text-blue-zen">
                                <span className="material-symbols-outlined text-[16px]">cloud_done</span>
                            </div>
                            <div>
                                <p className="text-xs font-serif font-semibold text-premium-charcoal">Data Synced</p>
                                <p className="text-[10px] text-muted-taupe">Your wallet is up to date.</p>
                            </div>
                        </div>
                         <div className="flex gap-3 items-start opacity-60">
                            <div className="bg-sand-light p-1.5 rounded-lg text-sand">
                                <span className="material-symbols-outlined text-[16px]">handshake</span>
                            </div>
                            <div>
                                <p className="text-xs font-serif font-semibold text-premium-charcoal">Welcome to Wall-ette</p>
                                <p className="text-[10px] text-muted-taupe">Start your mindful journey.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="flex flex-col items-center py-10 relative">
        <div className="absolute top-6 left-8">
          <LotusFlower size="sm" color="#E8A5A5" className="opacity-40" />
        </div>
        <div className="absolute top-8 right-10">
          <LotusFlower size="sm" color="#D4B896" className="opacity-30" />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <p className="text-muted-taupe text-xs font-medium uppercase tracking-[0.2em]">Portfolio Balance</p>
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
        <button
            onClick={handleRefresh}
            className={`mt-4 flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all cursor-pointer active:scale-95 ${isCloudSyncing ? 'bg-sage-light/50 border-sage/10 hover:bg-sage-light' : 'bg-rose-light/50 border-rose/10 hover:bg-rose-light'}`}
            title="Tap to refresh data"
        >
          <span className={`material-symbols-outlined text-sm font-bold ${refreshing ? 'animate-spin' : ''} ${isCloudSyncing ? 'text-sage' : 'text-rose'}`}>
            {refreshing ? 'progress_activity' : isCloudSyncing ? 'cloud_sync' : 'cloud_off'}
          </span>
          <span className={`${isCloudSyncing ? 'text-sage' : 'text-rose'} text-[13px] font-semibold`}>
            {refreshing ? 'Refreshing…' : isCloudSyncing ? 'Live Updates · Tap to Refresh' : 'Local Mode · Tap to Retry'}
          </span>
        </button>
      </div>
      {/* Desktop: cards flow into two columns; phones/APK keep the single
          column (CSS columns are inert below md). */}
      <div className="md:columns-2 md:gap-x-0">

      {/* Income/Expense Summary (Daily, Monthly, All Time) */}
      <div className="grid grid-cols-2 gap-4 px-6 py-2 break-inside-avoid">
        {/* Income Card */}
        <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-soft border border-black/[0.02]">
          <div className="text-sage bg-sage-light w-9 h-9 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">add</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between gap-2 text-xs text-muted-taupe font-semibold">
              <span className="shrink-0">Daily</span>
              <span className="whitespace-nowrap tabular-nums">+{formatAmountCompact(getDailyIncome())}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-taupe font-semibold">
              <span className="shrink-0">Monthly</span>
              <span className="whitespace-nowrap tabular-nums">+{formatAmountCompact(getMonthlyIncome())}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-taupe font-semibold">
              <span className="shrink-0">All Time</span>
              <span className="whitespace-nowrap tabular-nums">+{formatAmountCompact(getTotalIncome())}</span>
            </div>
          </div>
        </div>
        {/* Expense Card */}
        <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-soft border border-black/[0.02]">
          <div className="text-rose bg-rose-light w-9 h-9 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">remove</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between gap-2 text-xs text-muted-taupe font-semibold">
              <span className="shrink-0">Daily</span>
              <span className="whitespace-nowrap tabular-nums">-{formatAmountCompact(getDailyExpense())}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-taupe font-semibold">
              <span className="shrink-0">Monthly</span>
              <span className="whitespace-nowrap tabular-nums">-{formatAmountCompact(getMonthlyExpense())}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-taupe font-semibold">
              <span className="shrink-0">All Time</span>
              <span className="whitespace-nowrap tabular-nums">-{formatAmountCompact(getTotalExpense())}</span>
            </div>
          </div>
        </div>
      </div>
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
        </div>
      </div>
      {/* Balance Trend (12 months) — tap a point for details */}
      {balanceTrend.length > 1 && (() => {
        const vals = balanceTrend.map(m => m.value);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
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
              <div className="relative h-24 mx-1.5">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                  <defs>
                    <linearGradient id="balTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9BAE93" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#9BAE93" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={`0,100 ${linePoints} 100,100`} fill="url(#balTrendFill)" />
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke="#9BAE93"
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
              <div className="flex justify-between mt-1 mx-1.5">
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
                <circle cx="18" cy="18" r="14" fill="none" stroke="#E3EAE0" strokeWidth="4" />
                <circle
                  cx="18" cy="18" r="14" fill="none" stroke="#9BAE93" strokeWidth="4"
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
                  <div key={cat.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                    <span className="text-[11px] text-premium-charcoal font-medium flex-1 truncate">{cat.name}</span>
                    <span className="text-[10px] text-muted-taupe flex-shrink-0">{formatAmount(cat.amount as number).split('.')[0]}</span>
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
                    <p className="text-[13px] font-semibold text-premium-charcoal truncate">{tx.merchant || tx.category}</p>
                    <p className="text-[10px] text-muted-taupe">{tx.category} · {new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
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