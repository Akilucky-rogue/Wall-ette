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
    isCloudSyncing, retryCloudConnection, openingBalance
  } = useWallet();

  const [showNotifications, setShowNotifications] = useState(false);
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

    const net = new Array(12).fill(0);
    let beforeWindow = 0;

    for (const t of transactions) {
      const d = new Date(t.date);
      const k = d.getFullYear() * 12 + d.getMonth();
      const signed = t.type === TransactionType.INCOME ? t.amount : -t.amount;
      if (k < firstKey) beforeWindow += signed;
      else if (k <= lastKey) net[k - firstKey] += signed;
      // Transactions after the selected month are excluded (as before).
    }

    let running = openingBalance + beforeWindow;
    const months: { label: string; value: number }[] = [];
    for (let i = 0; i < 12; i++) {
      running += net[i];
      const d = new Date(endYear, endMonth - (11 - i), 1);
      months.push({
        label: d.toLocaleString('default', { month: 'short' }),
        value: running
      });
    }
    return months;
  }, [transactions, openingBalance, selectedDate]);

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
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] mx-auto overflow-x-hidden pb-24 bg-zen-bg">
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
          <span className="text-premium-charcoal font-serif text-xl font-bold tracking-tight select-none">WALL-E</span>
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
                                <p className="text-xs font-serif font-semibold text-premium-charcoal">Welcome to WALL-E</p>
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
            onClick={!isCloudSyncing ? retryCloudConnection : undefined}
            className={`mt-4 flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${isCloudSyncing ? 'bg-sage-light/50 border-sage/10 cursor-default' : 'bg-rose-light/50 border-rose/10 cursor-pointer hover:bg-rose-light'}`}
            title={!isCloudSyncing ? "Tap to retry connection" : "Connected"}
        >
          <span className={`material-symbols-outlined text-sm font-bold ${isCloudSyncing ? 'text-sage' : 'text-rose'}`}>
            {isCloudSyncing ? 'cloud_sync' : 'cloud_off'}
          </span>
          <span className={`${isCloudSyncing ? 'text-sage' : 'text-rose'} text-[13px] font-semibold`}>
            {isCloudSyncing ? 'Live Updates' : 'Local Mode (Tap to Retry)'}
          </span>
        </button>
      </div>
      {/* Income/Expense Summary (Daily, Monthly, All Time) */}
      <div className="grid grid-cols-2 gap-4 px-6 py-2">
        {/* Income Card */}
        <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-soft border border-black/[0.02]">
          <div className="text-sage bg-sage-light w-9 h-9 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">add</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-muted-taupe font-semibold">
              <span>Daily</span>
              <span>+{formatAmount(getDailyIncome())}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-taupe font-semibold">
              <span>Monthly</span>
              <span>+{formatAmount(getMonthlyIncome())}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-taupe font-semibold">
              <span>All Time</span>
              <span>+{formatAmount(getTotalIncome())}</span>
            </div>
          </div>
        </div>
        {/* Expense Card */}
        <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-soft border border-black/[0.02]">
          <div className="text-rose bg-rose-light w-9 h-9 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">remove</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-muted-taupe font-semibold">
              <span>Daily</span>
              <span>-{formatAmount(getDailyExpense())}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-taupe font-semibold">
              <span>Monthly</span>
              <span>-{formatAmount(getMonthlyExpense())}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-taupe font-semibold">
              <span>All Time</span>
              <span>-{formatAmount(getTotalExpense())}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Quick Services */}
      <div className="px-6 py-8">
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
            onClick={() => onNavigate(AppScreen.ANALYSIS)}
            className="flex flex-col items-center gap-3 bg-white p-4 rounded-3xl border border-black/[0.02] shadow-soft active:scale-95 transition-transform"
          >
            <div className="bg-blue-50 text-blue-300 p-3 rounded-2xl">
              <span className="material-symbols-outlined">bubble_chart</span>
            </div>
            <span className="text-[11px] font-semibold text-muted-taupe uppercase tracking-tighter">Flow</span>
          </button>
        </div>
      </div>
      {/* Balance Trend Sparkline (12 months) */}
      {balanceTrend.length > 1 && (
        <div className="px-6 py-2 mb-2">
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02]">
            <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-4">12-Month Balance Trend</p>
            <div className="relative h-16">
              {(() => {
                const vals = balanceTrend.map(m => m.value);
                const min = Math.min(...vals);
                const max = Math.max(...vals);
                const range = max - min || 1;
                const w = 100 / (vals.length - 1);
                const points = vals.map((v, i) => `${i * w},${100 - ((v - min) / range) * 100}`).join(' ');
                return (
                  <svg viewBox={`0 0 100 100`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <polyline
                      points={points}
                      fill="none"
                      stroke="#9BAE93"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    {vals.map((v, i) => (
                      <circle
                        key={i}
                        cx={i * w}
                        cy={100 - ((v - min) / range) * 100}
                        r="4"
                        fill="white"
                        stroke="#9BAE93"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                );
              })()}
            </div>
            <div className="flex justify-between mt-2">
              {balanceTrend.filter((_, i) => i % 3 === 0 || i === balanceTrend.length - 1).map((m, i) => (
                <span key={i} className="text-[9px] text-muted-taupe font-medium">{m.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Savings Rate + Category Breakdown */}
      {(income > 0 || categoryBreakdown.length > 0) && (
        <div className="px-6 py-2 mb-2 grid grid-cols-2 gap-4">
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
        <div className="px-6 py-2 mb-2">
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
        <div className="px-6 py-8 flex flex-col items-center gap-4 text-center">
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
    </div>
  );
};

export default Dashboard;