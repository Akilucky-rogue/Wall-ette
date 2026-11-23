import React, { useMemo, useState, useEffect } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { parseDay } from '../utils/dates';
import { WallEMascot } from './SplashScreen';
import { pulseView, usePulseView, type PulseTab } from './pulseView';
import { tick } from '../utils/haptics';
import { analyzeFinancialHealth, FinancialInsight } from '../services/insightsService';
import { categoryMovers, detectRecurringCharges, monthDailyStats, priceRises, spendingPace, prettyMerchant } from '../services/analyticsService';
import UnsortedTransfers from './UnsortedTransfers';
import styles from './SpendAnalysis.module.css';

/** Pulse is a hub (a summary of the month) with a page for each topic. */
export type PulsePage = 'hub' | 'trends' | 'categories' | 'recurring' | 'health';

interface SpendAnalysisProps {
  onNavigate: (screen: AppScreen) => void;
  page?: PulsePage;
}

const PAGE_TITLE: Record<PulsePage, string> = {
  hub: 'Pulse', trends: 'Trends', categories: 'Categories', recurring: 'Recurring', health: 'Health check',
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const SpendAnalysis: React.FC<SpendAnalysisProps> = ({ onNavigate, page = 'hub' }) => {
  // Pulse analyses real spending and income only: money moved to your own
  // accounts, family or investments is left out (audit H3).
  const { counted, formatAmount, formatAmountCompact, dailyLimit } = useWallet();
  const [chartMode, setChartMode] = useState<'WEEKLY' | 'DAILY'>('DAILY');
  // The month and Expenses/Income, shared with Pulse's pages (pulseView.ts).
  const view = usePulseView();
  const analysisTab = view.tab;
  const setAnalysisTab = (tab: PulseTab) => { if (tab !== analysisTab) tick(); pulseView.setTab(tab); };
  const [heatDay, setHeatDay] = useState<number | null>(null); // selected heatmap day (1-based)
  const [selPoint, setSelPoint] = useState<number | null>(null); // selected trends day/week
  
  // Health check (worked out on the phone)
  const [health, setHealth] = useState<FinancialInsight | null>(null);
  const [checking, setChecking] = useState(false);
  const [showCheck, setShowCheck] = useState(false);

  // Auto-detect the month with most recent transactions
  // (single O(n) max scan instead of copy + sort — audit Phase 2.6)
  const latestTxDate = useMemo(() => {
    if (counted.length === 0) return new Date();
    let maxTs = -Infinity;
    for (const t of counted) {
      const ts = parseDay(t.date).getTime();
      if (ts > maxTs) maxTs = ts;
    }
    return new Date(maxTs);
  }, [counted]);

  // Until a month is picked, Pulse follows the newest data (a new import moves it).
  const selectedDate = view.month ?? latestTxDate;

  // Helper: Get days in month
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  // Filter transactions by selected month + previous-month comparison in ONE
  // pass; each date is parsed exactly once (audit Phase 2 — was 4 scans with
  // up to 8 Date parses per transaction).
  const { filteredExpenses, filteredIncome, totalExpense, totalIncome, prevMonthData } = useMemo(() => {
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    const prevDate = new Date(year, month - 1, 1);
    const prevMonth = prevDate.getMonth();
    const prevYear = prevDate.getFullYear();

    const expensesArr: typeof counted = [];
    const incomeArr: typeof counted = [];
    let expSum = 0, incSum = 0, prevExpSum = 0, prevIncSum = 0;

    for (const t of counted) {
      const d = parseDay(t.date);
      const m = d.getMonth();
      const y = d.getFullYear();
      const isExpense = t.type === TransactionType.EXPENSE;

      if (m === month && y === year) {
        if (isExpense) { expensesArr.push(t); expSum += t.amount; }
        else { incomeArr.push(t); incSum += t.amount; }
      } else if (m === prevMonth && y === prevYear) {
        if (isExpense) prevExpSum += t.amount;
        else prevIncSum += t.amount;
      }
    }

    return {
      filteredExpenses: expensesArr,
      filteredIncome: incomeArr,
      totalExpense: expSum,
      totalIncome: incSum,
      prevMonthData: {
        expense: prevExpSum,
        income: prevIncSum,
        monthName: prevDate.toLocaleDateString('en-US', { month: 'short' })
      }
    };
  }, [counted, selectedDate]);

  const netFlow = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  // ── New insight sections (expense tab) ─────────────────────────────────────

  // Month-over-month category movers for the active tab (noise floor: ₹100 delta)
  const movers = useMemo(
    () => categoryMovers(counted, selectedDate, analysisTab === 'EXPENSE' ? TransactionType.EXPENSE : TransactionType.INCOME),
    [counted, selectedDate, analysisTab]
  );

  // Recurring charges / subscriptions (whole history, cadence-validated)
  const recurring = useMemo(() => detectRecurringCharges(counted), [counted]);
  const recurringMonthlyTotal = useMemo(() => recurring.reduce((s, r) => s + r.monthlyCost, 0), [recurring]);

  // Daily heatmap + weekday averages for the selected month — follows the
  // active tab (spend days vs income days)
  const dayStats = useMemo(
    () => monthDailyStats(analysisTab === 'EXPENSE' ? filteredExpenses : filteredIncome, selectedDate),
    [analysisTab, filteredExpenses, filteredIncome, selectedDate]
  );
  const maxWeekdayAvg = useMemo(() => Math.max(...dayStats.weekdayAvg, 1), [dayStats]);
  // Expense pace needs expense-only daily stats regardless of tab
  const expenseDayStats = useMemo(() => monthDailyStats(filteredExpenses, selectedDate), [filteredExpenses, selectedDate]);

  // Budget pace — only meaningful for the live (current) month
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear();
  }, [selectedDate]);
  const pace = useMemo(() => {
    if (!isCurrentMonth) return null;
    return spendingPace(expenseDayStats.cumulative, expenseDayStats.daysInMonth, new Date(), dailyLimit, prevMonthData.expense);
  }, [isCurrentMonth, expenseDayStats, dailyLimit, prevMonthData.expense]);

  // Reset selections when the context changes
  useEffect(() => { setHeatDay(null); }, [selectedDate, analysisTab]);
  useEffect(() => { setSelPoint(null); }, [selectedDate, analysisTab, chartMode]);

  // Calculate percentage changes
  const expenseChange = prevMonthData.expense > 0 
    ? ((totalExpense - prevMonthData.expense) / prevMonthData.expense) * 100 
    : 0;
  const incomeChange = prevMonthData.income > 0 
    ? ((totalIncome - prevMonthData.income) / prevMonthData.income) * 100 
    : 0;

  // Category breakdown for current tab
  const categoryBreakdown = useMemo(() => {
    const data = analysisTab === 'EXPENSE' ? filteredExpenses : filteredIncome;
    const total = analysisTab === 'EXPENSE' ? totalExpense : totalIncome;
    
    const cats: Record<string, { amount: number; count: number }> = {};
    data.forEach(t => {
      if (!cats[t.category]) cats[t.category] = { amount: 0, count: 0 };
      cats[t.category].amount += t.amount;
      cats[t.category].count += 1;
    });

    const sorted = Object.entries(cats).sort(([, a], [, b]) => b.amount - a.amount);
    const maxVal = sorted.length > 0 ? sorted[0][1].amount : 1;

    return sorted.map(([name, data]) => ({
      name,
      amount: data.amount,
      count: data.count,
      percentOfTotal: total > 0 ? Math.round((data.amount / total) * 100) : 0,
      barWidth: Math.round((data.amount / maxVal) * 100),
      avgPerTx: data.count > 0 ? data.amount / data.count : 0
    }));
  }, [filteredExpenses, filteredIncome, totalExpense, totalIncome, analysisTab]);

  // Chart data for trends
  const chartData = useMemo(() => {
    const data = analysisTab === 'EXPENSE' ? filteredExpenses : filteredIncome;
    const daysInMonth = getDaysInMonth(selectedDate);
    
    if (chartMode === 'DAILY') {
      const daily = new Array(daysInMonth).fill(0);
      data.forEach(t => {
        const d = parseDay(t.date).getDate() - 1;
        if (d >= 0 && d < daysInMonth) daily[d] += t.amount;
      });
      return daily.map((val, i) => ({ label: (i+1).toString(), val }));
    } else {
      // Weekly
      const weekly = [0, 0, 0, 0, 0];
      data.forEach(t => {
        const d = parseDay(t.date).getDate();
        const weekIdx = Math.min(Math.floor((d - 1) / 7), 4);
        weekly[weekIdx] += t.amount;
      });
      return weekly.map((val, i) => ({ label: `W${i+1}`, val }));
    }
  }, [filteredExpenses, filteredIncome, chartMode, selectedDate, analysisTab]);

  // SVG paths for daily chart
  const sparklinePath = useMemo(() => {
    if (chartMode !== 'DAILY' || chartData.length === 0) return "";
    const max = Math.max(...chartData.map(d => d.val)) || 100;
    const points = chartData.map((d, i) => {
      const x = (i / (chartData.length - 1)) * 100;
      const y = 100 - ((d.val / max) * 100);
      return `${x},${y}`;
    });
    return `M0,100 L${points.join(' L')} L100,100 Z`;
  }, [chartData, chartMode]);

  const sparklineStroke = useMemo(() => {
    if (chartMode !== 'DAILY' || chartData.length === 0) return "";
    const max = Math.max(...chartData.map(d => d.val)) || 100;
    const points = chartData.map((d, i) => {
      const x = (i / (chartData.length - 1)) * 100;
      const y = 100 - ((d.val / max) * 100);
      return `${x},${y}`;
    });
    return `M${points.join(' L')}`;
  }, [chartData, chartMode]);

  // Weekly insights
  const weeklyInsights = useMemo(() => {
    if (chartMode !== 'WEEKLY') return null;
    const maxWeek = chartData.reduce((max, d, i) => d.val > (chartData[max]?.val || 0) ? i : max, 0);
    const minWeek = chartData.reduce((min, d, i) => d.val < (chartData[min]?.val || Infinity) && d.val > 0 ? i : min, 0);
    const avgWeekly = chartData.reduce((sum, d) => sum + d.val, 0) / chartData.filter(d => d.val > 0).length || 0;
    
    return { maxWeek: maxWeek + 1, minWeek: minWeek + 1, avgWeekly };
  }, [chartData, chartMode]);

  // Transaction statistics
  const txStats = useMemo(() => {
    const data = analysisTab === 'EXPENSE' ? filteredExpenses : filteredIncome;
    if (data.length === 0) return null;
    
    const amounts = data.map(t => t.amount).sort((a, b) => a - b);
    const total = analysisTab === 'EXPENSE' ? totalExpense : totalIncome;
    
    return {
      count: data.length,
      avg: total / data.length,
      median: amounts[Math.floor(amounts.length / 2)],
      max: amounts[amounts.length - 1],
      min: amounts[0],
      dailyAvg: total / getDaysInMonth(selectedDate)
    };
  }, [filteredExpenses, filteredIncome, totalExpense, totalIncome, analysisTab, selectedDate]);

  // Smart insights generator
  const insights = useMemo(() => {
    const insightsList: { icon: string; text: string; type: 'good' | 'warning' | 'info' }[] = [];
    
    // Savings rate insight
    if (totalIncome > 0) {
      if (savingsRate >= 30) {
        insightsList.push({ icon: 'savings', text: `Excellent! You saved ${savingsRate.toFixed(0)}% of your income this month.`, type: 'good' });
      } else if (savingsRate >= 10) {
        insightsList.push({ icon: 'trending_up', text: `You saved ${savingsRate.toFixed(0)}% of income. Aim for 30% for faster wealth building.`, type: 'info' });
      } else if (savingsRate > 0) {
        insightsList.push({ icon: 'warning', text: `Low savings rate at ${savingsRate.toFixed(0)}%. Review discretionary spending.`, type: 'warning' });
      } else {
        insightsList.push({ icon: 'trending_down', text: `You spent more than you earned. Net outflow: ${formatAmount(Math.abs(netFlow))}`, type: 'warning' });
      }
    }

    // Expense change insight
    if (prevMonthData.expense > 0 && totalExpense > 0) {
      if (expenseChange > 20) {
        insightsList.push({ icon: 'arrow_upward', text: `Spending up ${expenseChange.toFixed(0)}% from ${prevMonthData.monthName}. Check for unusual expenses.`, type: 'warning' });
      } else if (expenseChange < -10) {
        insightsList.push({ icon: 'arrow_downward', text: `Great job! Spending down ${Math.abs(expenseChange).toFixed(0)}% from last month.`, type: 'good' });
      }
    }

    // Category concentration insight
    if (categoryBreakdown.length > 0 && analysisTab === 'EXPENSE') {
      const topCategory = categoryBreakdown[0];
      if (topCategory.percentOfTotal > 50) {
        insightsList.push({ icon: 'pie_chart', text: `${topCategory.name} dominates at ${topCategory.percentOfTotal}% of spending. Consider diversifying.`, type: 'info' });
      }
    }

    // Transaction frequency insight
    if (txStats && analysisTab === 'EXPENSE') {
      const daysInMonth = getDaysInMonth(selectedDate);
      const txPerDay = txStats.count / daysInMonth;
      if (txPerDay > 3) {
        insightsList.push({ icon: 'speed', text: `High transaction frequency: ${txStats.count} transactions (${txPerDay.toFixed(1)}/day). Small purchases add up.`, type: 'info' });
      }
    }

    // Large transaction insight
    if (txStats && txStats.max > txStats.avg * 3) {
      insightsList.push({ icon: 'money_off', text: `Largest ${analysisTab === 'EXPENSE' ? 'expense' : 'income'}: ${formatAmount(txStats.max)} — ${(txStats.max / (analysisTab === 'EXPENSE' ? totalExpense : totalIncome) * 100).toFixed(0)}% of total.`, type: 'info' });
    }

    return insightsList.slice(0, 3); // Show top 3 insights
  }, [savingsRate, totalIncome, totalExpense, netFlow, expenseChange, prevMonthData, categoryBreakdown, analysisTab, txStats, formatAmount, selectedDate]);

  const getIcon = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes('salary') || lower.includes('income')) return 'payments';
    if (lower.includes('invest') || lower.includes('dividend')) return 'trending_up';
    if (lower.includes('house') || lower.includes('rent') || lower.includes('emi')) return 'home';
    if (lower.includes('food') || lower.includes('dining') || lower.includes('grocer') || lower.includes('swiggy') || lower.includes('zomato')) return 'restaurant';
    if (lower.includes('health') || lower.includes('medical') || lower.includes('pharma')) return 'medication';
    if (lower.includes('transport') || lower.includes('uber') || lower.includes('ola') || lower.includes('fuel')) return 'commute';
    if (lower.includes('shop') || lower.includes('amazon') || lower.includes('flipkart')) return 'shopping_bag';
    if (lower.includes('entertain') || lower.includes('movie') || lower.includes('netflix')) return 'movie';
    if (lower.includes('utility') || lower.includes('electric') || lower.includes('bill')) return 'receipt_long';
    if (lower.includes('transfer') || lower.includes('upi')) return 'swap_horiz';
    if (lower.includes('recharge') || lower.includes('mobile')) return 'smartphone';
    if (lower.includes('education') || lower.includes('course')) return 'school';
    if (lower.includes('insurance')) return 'shield';
    if (lower.includes('travel') || lower.includes('flight') || lower.includes('hotel')) return 'flight';
    if (lower.includes('subscription')) return 'subscriptions';
    return 'category';
  };

  const handleMonthChange = (offset: number) => {
    pulseView.setMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1));
  };

  // Price rises across the whole history (Recurring page)
  const rises = useMemo(() => (page === 'recurring' ? priceRises(counted) : []), [page, counted]);

  const currentTotal = analysisTab === 'EXPENSE' ? totalExpense : totalIncome;
  const currentData = analysisTab === 'EXPENSE' ? filteredExpenses : filteredIncome;
  const chartColor = analysisTab === 'EXPENSE' ? 'var(--rose-strong)' : 'var(--sage)';

  // The hub's rows, each with a line from its page.
  const pageRows = (() => {
    const isExp = analysisTab === 'EXPENSE';
    const busiest = dayStats.maxDaily > 0
      ? dayStats.daily.reduce((best, v, i) => (v > dayStats.daily[best] ? i : best), 0)
      : -1;
    const top = categoryBreakdown[0];
    return [
      {
        screen: AppScreen.PULSE_TRENDS, title: 'Trends', icon: 'show_chart', tint: 'bg-ocean-light text-ocean',
        preview: busiest >= 0
          ? `Biggest day ${busiest + 1} ${selectedDate.toLocaleDateString('en-GB', { month: 'short' })} · ${formatAmountCompact(dayStats.daily[busiest])}`
          : 'Day by day, week by week',
      },
      {
        screen: AppScreen.PULSE_CATEGORIES, title: 'Categories', icon: 'donut_large', tint: 'bg-sage-light text-sage',
        preview: top ? `${top.name} leads at ${top.percentOfTotal}%` : `Where your ${isExp ? 'money goes' : 'money comes from'}`,
      },
      {
        screen: AppScreen.PULSE_RECURRING, title: 'Recurring', icon: 'autorenew', tint: 'bg-lavender-light text-lavender',
        preview: recurring.length > 0
          ? `${recurring.length} ${recurring.length === 1 ? 'charge' : 'charges'} · ${formatAmountCompact(recurringMonthlyTotal)} a month`
          : 'Bills and subscriptions',
      },
      {
        screen: AppScreen.PULSE_HEALTH, title: 'Health check', icon: 'monitor_heart', tint: 'bg-rose-light text-rose',
        preview: totalIncome > 0 ? `You kept ${Math.round(Math.max(0, savingsRate))}% of what came in` : 'What stands out this month',
      },
    ];
  })();

  // Health check for the selected month, when asked for
  const runHealthCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const monthTransactions = counted.filter(t => {
        const txDate = parseDay(t.date);
        return txDate.getMonth() === selectedDate.getMonth() &&
               txDate.getFullYear() === selectedDate.getFullYear();
      }).map(t => ({
        ...t,
        merchant: t.merchant || ''
      }));
      setHealth(await analyzeFinancialHealth(monthTransactions, totalIncome));
      setShowCheck(true);
    } catch (err) {
      console.error('Health check failed:', err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] lg:max-w-3xl mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      {/* Header: Pulse, or the page's title with a way back; the month */}
      <div className="flex items-center gap-2 bg-zen-bg/85 backdrop-blur-md px-5 pt-6 pb-3 sticky top-0 z-30">
        {page !== 'hub' && (
          <button
            onClick={() => onNavigate(AppScreen.ANALYSIS)}
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
            aria-label="Back to Pulse"
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">arrow_back</span>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-premium-charcoal text-[22px] font-serif font-semibold tracking-tight leading-tight truncate">{PAGE_TITLE[page]}</h2>
          {page !== 'hub' && page !== 'recurring' && (
            <p className="text-[12px] text-muted-taupe">{analysisTab === 'EXPENSE' ? 'Spending' : 'Income'}</p>
          )}
        </div>
        {page !== 'recurring' && (
          <div className="flex items-center rounded-full bg-white shadow-soft border border-black/[0.03] px-1 py-1 shrink-0">
            <button
              onClick={() => handleMonthChange(-1)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-taupe hover:text-sage hover:bg-zen-cream"
              aria-label="Previous month"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_left</span>
            </button>
            <button
              onClick={() => pulseView.setMonth(null)}
              className="px-1.5 text-[12px] font-semibold text-premium-charcoal tabular-nums"
              title="Go to the newest data"
            >
              {selectedDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </button>
            <button
              onClick={() => handleMonthChange(1)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-taupe hover:text-sage hover:bg-zen-cream"
              aria-label="Next month"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
            </button>
          </div>
        )}
      </div>

      {/* Expenses / Income: the hub only; its pages follow it */}
      {page === 'hub' && (
        <div className="px-6 pt-1 pb-4">
          <div className="bg-black/[0.04] shadow-pressed rounded-2xl p-1 flex" role="group" aria-label="Show">
            {(['EXPENSE', 'INCOME'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setAnalysisTab(tab)}
                aria-pressed={analysisTab === tab}
                className={`flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  analysisTab === tab ? 'bg-white shadow-soft text-premium-charcoal' : 'text-muted-taupe hover:text-premium-charcoal'
                }`}
              >
                <span className={`material-symbols-outlined icon-fill text-[16px] ${analysisTab === tab ? (tab === 'EXPENSE' ? 'text-rose' : 'text-sage') : ''}`} aria-hidden="true">
                  {tab === 'EXPENSE' ? 'north_east' : 'south_west'}
                </span>
                {tab === 'EXPENSE' ? 'Expenses' : 'Income'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Stats */}
      {page === 'hub' && (<>
      <div className="flex flex-col items-center pb-4">
        <p className="text-muted-taupe text-[12px] font-medium mb-1">
          {analysisTab === 'EXPENSE' ? 'Spent in' : 'Came in during'} {selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
        <h1 className={`font-serif text-[40px] leading-tight px-4 text-center tabular-nums ${analysisTab === 'EXPENSE' ? 'text-premium-charcoal' : 'text-sage'}`}>
          {formatAmount(currentTotal).split('.')[0]}
        </h1>
        
        {/* Comparison Badge */}
        {((analysisTab === 'EXPENSE' && prevMonthData.expense > 0) || (analysisTab === 'INCOME' && prevMonthData.income > 0)) && currentTotal > 0 && (
          <div className={`mt-2 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium ${
            (analysisTab === 'EXPENSE' ? expenseChange : incomeChange) > 0 
              ? (analysisTab === 'EXPENSE' ? 'bg-rose/10 text-rose' : 'bg-sage/10 text-sage')
              : (analysisTab === 'EXPENSE' ? 'bg-sage/10 text-sage' : 'bg-rose/10 text-rose')
          }`}>
            <span className="material-symbols-outlined text-[14px]">
              {(analysisTab === 'EXPENSE' ? expenseChange : incomeChange) > 0 ? 'arrow_upward' : 'arrow_downward'}
            </span>
            {Math.abs(analysisTab === 'EXPENSE' ? expenseChange : incomeChange).toFixed(0)}% vs {prevMonthData.monthName}
          </div>
        )}

        {currentData.length === 0 && (
          <div className="mt-4 flex flex-col items-center py-2">
            <WallEMascot mood="thinking" size="sm" />
            <div className="mt-2 flex items-center gap-2 px-4 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
              <span className="text-amber-700 text-[11px] font-medium">
                No {analysisTab.toLowerCase()} data for this month
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Transfers to unsorted payees count as spending until sorted (audit H3) */}
      <UnsortedTransfers onNavigate={onNavigate} className="px-6 pb-4" />
      </>)}

      {/* Desktop: sections flow into two columns; phones/APK keep one column */}
      <div className="lg:columns-2 lg:gap-x-0">

      {/* TODAY — daily spend analysis, front and center */}
      {page === 'hub' && (() => {
        const now = new Date();
        const isExp = analysisTab === 'EXPENSE';
        const todayTxs = counted
          .filter(t => {
            const d = parseDay(t.date);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() &&
              d.getDate() === now.getDate() &&
              t.type === (isExp ? TransactionType.EXPENSE : TransactionType.INCOME);
          })
          .sort((a, b) => b.amount - a.amount);
        const todayTotal = todayTxs.reduce((s, t) => s + t.amount, 0);
        const viewingCurrentMonth =
          selectedDate.getMonth() === now.getMonth() && selectedDate.getFullYear() === now.getFullYear();
        if (!viewingCurrentMonth) return null;
        const avg = txStats ? txStats.dailyAvg : 0;
        const vsAvg = avg > 0 ? Math.round(((todayTotal - avg) / avg) * 100) : null;
        return (
          <div className="px-6 pb-4 break-inside-avoid">
            <div className="bg-white rounded-[28px] p-5 shadow-soft border border-black/[0.02]">
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">
                  Today · {now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
                <p className={`text-[16px] font-serif font-bold ${isExp ? 'text-rose' : 'text-sage'}`}>
                  {isExp ? '-' : '+'}{formatAmount(todayTotal).split('.')[0]}
                </p>
              </div>
              {todayTxs.length === 0 ? (
                <p className="text-[11px] text-muted-taupe italic mt-1">
                  {isExp ? 'Nothing spent yet today — keep it going.' : 'No income recorded today.'}
                </p>
              ) : (
                <>
                  <p className="text-[10px] text-muted-taupe mb-3">
                    {todayTxs.length} transaction{todayTxs.length === 1 ? '' : 's'}
                    {vsAvg !== null ? ` · ${Math.abs(vsAvg)}% ${vsAvg >= 0 ? 'above' : 'below'} your daily average` : ''}
                  </p>
                  <div className="space-y-2">
                    {todayTxs.slice(0, 4).map(t => (
                      <div key={t.id} className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isExp ? 'bg-rose' : 'bg-sage'}`} />
                        <span className="text-[11px] text-premium-charcoal truncate flex-1" title={t.merchant || t.category}>
                          {prettyMerchant(t.merchant || t.category)}
                        </span>
                        <span className="text-[9px] text-muted-taupe shrink-0 uppercase tracking-wide">{t.category}</span>
                        <span className={`text-[11px] font-semibold shrink-0 tabular-nums ${isExp ? 'text-rose' : 'text-sage'}`}>
                          {isExp ? '-' : '+'}{formatAmount(t.amount).split('.')[0]}
                        </span>
                      </div>
                    ))}
                    {todayTxs.length > 4 && (
                      <p className="text-[9px] text-muted-taupe">+{todayTxs.length - 4} more — tap today in the heatmap below</p>
                    )}
                  </div>
                </>
              )}
              {/* Daily spend limit usage — the limit set in Self, tracked live */}
              {isExp && dailyLimit > 0 && (
                <div className="mt-3 pt-3 border-t border-black/5">
                  <div className="flex justify-between text-[10px] text-muted-taupe mb-1.5">
                    <span className="uppercase tracking-wider font-bold">Daily limit</span>
                    <span className={`tabular-nums ${todayTotal > dailyLimit ? 'text-rose font-bold' : ''}`}>
                      {formatAmount(todayTotal).split('.')[0]} / {formatAmount(dailyLimit).split('.')[0]}
                    </span>
                  </div>
                  <div className="h-1.5 bg-zen-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${todayTotal > dailyLimit ? 'bg-rose' : todayTotal > dailyLimit * 0.8 ? 'bg-sand' : 'bg-sage'}`}
                      style={{ width: `${Math.min(100, (todayTotal / dailyLimit) * 100)}%` }}
                    />
                  </div>
                  {todayTotal > dailyLimit && (
                    <p className="text-[9px] text-rose font-semibold mt-1">
                      Over today's limit by {formatAmount(todayTotal - dailyLimit).split('.')[0]}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Pages: each topic on its own screen */}
      {page === 'hub' && (
        <nav className="px-6 pb-4 break-inside-avoid" aria-label="More in Pulse">
          <ul className="bg-white rounded-3xl shadow-soft border border-black/[0.02] overflow-hidden divide-y divide-black/[0.05]">
            {pageRows.map(row => (
              <li key={row.screen}>
                <button
                  onClick={() => onNavigate(row.screen)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zen-cream transition-colors"
                >
                  <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${row.tint}`}>
                    <span className="material-symbols-outlined icon-fill text-[20px]" aria-hidden="true">{row.icon}</span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold text-premium-charcoal">{row.title}</span>
                    <span className="block text-[12px] text-muted-taupe truncate">{row.preview}</span>
                  </span>
                  <span className="material-symbols-outlined text-muted-taupe/60 text-[20px] shrink-0" aria-hidden="true">chevron_right</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Quick Stats Row */}
      {page === 'trends' && txStats && (
        <div className="px-6 pb-4 break-inside-avoid">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-black/5">
              <p className="text-[9px] uppercase tracking-wider text-muted-taupe font-medium mb-1">Transactions</p>
              <p className="text-lg font-serif font-bold text-premium-charcoal">{txStats.count}</p>
            </div>
            <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-black/5">
              <p className="text-[9px] uppercase tracking-wider text-muted-taupe font-medium mb-1">Daily Avg</p>
              <p className="text-lg font-serif font-bold text-premium-charcoal">{formatAmount(txStats.dailyAvg)}</p>
            </div>
            <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-black/5">
              <p className="text-[9px] uppercase tracking-wider text-muted-taupe font-medium mb-1">Per Txn</p>
              <p className="text-lg font-serif font-bold text-premium-charcoal">{formatAmount(txStats.avg)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Net Flow Card — relevant on both tabs */}
      {page === 'hub' && totalIncome > 0 && (
        <div className="px-6 pb-4 break-inside-avoid">
          <div className={`rounded-2xl p-4 border ${netFlow >= 0 ? 'bg-sage/5 border-sage/20' : 'bg-rose/5 border-rose/20'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-taupe font-medium mb-0.5">Net Cash Flow</p>
                <p className={`text-xl font-serif font-bold ${netFlow >= 0 ? 'text-sage' : 'text-rose'}`}>
                  {netFlow >= 0 ? '+' : ''}{formatAmount(netFlow)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-taupe font-medium mb-0.5">Savings Rate</p>
                <p className={`text-xl font-serif font-bold ${savingsRate >= 20 ? 'text-sage' : savingsRate >= 0 ? 'text-amber-600' : 'text-rose'}`}>
                  {savingsRate.toFixed(0)}%
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 w-full bg-black/5 rounded-full overflow-hidden">
              <div
                className={
                  `${styles.savingsBar} ` +
                  (savingsRate >= 20 ? styles.savingsBarSage : savingsRate >= 0 ? styles.savingsBarAmber : styles.savingsBarRose) + ' ' + styles[`w${Math.round(Math.max(0, Math.min(100, savingsRate)))}p`]
                }
              />
            </div>
            <p className="text-[9px] text-muted-taupe mt-2 text-center">
              {savingsRate >= 30 ? '🎯 Target achieved! 30%+ savings' : savingsRate >= 20 ? '📈 Good progress' : savingsRate >= 0 ? '⚠️ Try to save 20%+' : '🚨 Spending exceeds income'}
            </p>
          </div>
        </div>
      )}

      {/* Interactive Chart Section */}
      {page === 'trends' && (
      <div className="px-6 py-2 break-inside-avoid">
        <div className="bg-white rounded-[28px] p-5 shadow-soft border border-black/[0.02]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif text-base font-semibold text-premium-charcoal">Trends</h3>
            <div className="flex bg-zen-bg rounded-xl p-1">
              <button 
                onClick={() => setChartMode('DAILY')}
                className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  chartMode === 'DAILY' ? 'bg-white shadow-sm text-premium-charcoal' : 'text-muted-taupe'
                }`}
              >
                Daily
              </button>
              <button 
                onClick={() => setChartMode('WEEKLY')}
                className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  chartMode === 'WEEKLY' ? 'bg-white shadow-sm text-premium-charcoal' : 'text-muted-taupe'
                }`}
              >
                Weekly
              </button>
            </div>
          </div>
          
          {(() => {
            const maxVal = Math.max(...chartData.map(d => d.val), 0);
            const avgVal = chartMode === 'DAILY'
              ? currentTotal / Math.max(chartData.length, 1)
              : currentTotal / Math.max(chartData.filter(d => d.val > 0).length, 1);
            const peakIdx = chartData.reduce((mi, d, i) => (d.val > chartData[mi].val ? i : mi), 0);
            const avgY = maxVal > 0 ? Math.min(98, 100 - (avgVal / maxVal) * 100) : 100;
            const sel = selPoint !== null ? chartData[selPoint] : null;
            const xTicks = chartMode === 'DAILY'
              ? [0, Math.floor(chartData.length / 4), Math.floor(chartData.length / 2), Math.floor((3 * chartData.length) / 4), chartData.length - 1]
              : null;
            return (
              <>
                <div className="flex gap-2">
                  {/* Y axis (₹, compact) */}
                  <div className="flex flex-col justify-between h-32 w-11 shrink-0 text-right">
                    <span className="text-[8px] text-muted-taupe leading-none">{maxVal > 0 ? formatAmountCompact(maxVal) : ''}</span>
                    <span className="text-[8px] text-muted-taupe leading-none">{maxVal > 0 ? formatAmountCompact(maxVal / 2) : ''}</span>
                    <span className="text-[8px] text-muted-taupe leading-none">0</span>
                  </div>
                  <div className="relative h-32 flex-1">
                    {/* Gridlines */}
                    <div className="absolute inset-x-0 top-0 border-t border-black/[0.06]" />
                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-black/[0.06]" />
                    <div className="absolute inset-x-0 bottom-0 border-t border-black/10" />
                    {/* Average reference line */}
                    {maxVal > 0 && (
                      <div
                        className="absolute inset-x-0 border-t border-dashed opacity-50"
                        style={{ top: `${avgY}%`, borderColor: chartColor }}
                        title={`Average: ${formatAmount(avgVal)}`}
                      />
                    )}

                    {chartMode === 'DAILY' ? (
                      <>
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id={`gradient-${analysisTab}`} x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor={chartColor} stopOpacity="0.4"/>
                              <stop offset="100%" stopColor={chartColor} stopOpacity="0"/>
                            </linearGradient>
                          </defs>
                          <path d={sparklinePath} fill={`url(#gradient-${analysisTab})`} />
                          <path d={sparklineStroke} fill="none" stroke={chartColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                        </svg>
                        {/* Peak marker (HTML so it stays round) */}
                        {maxVal > 0 && chartData.length > 1 && (
                          <div
                            className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow pointer-events-none"
                            style={{
                              left: `${(peakIdx / (chartData.length - 1)) * 100}%`,
                              top: `${100 - (chartData[peakIdx].val / maxVal) * 100}%`,
                              backgroundColor: chartColor,
                            }}
                          />
                        )}
                        {/* Tap-to-inspect columns */}
                        <div className="absolute inset-0 flex">
                          {chartData.map((d, i) => (
                            <button
                              key={i}
                              onClick={() => setSelPoint(selPoint === i ? null : i)}
                              className={`flex-1 ${selPoint === i ? 'bg-black/[0.06] rounded' : ''}`}
                              aria-label={`Day ${d.label}: ${formatAmount(d.val)}`}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-end justify-between gap-2 px-1">
                        {chartData.map((d, i) => (
                          <button key={i} onClick={() => setSelPoint(selPoint === i ? null : i)} className="flex-1 h-full flex items-end" aria-label={`Week ${i + 1}: ${formatAmount(d.val)}`}>
                            <div
                              className={`w-full rounded-t-md transition-opacity ${selPoint === null || selPoint === i ? '' : 'opacity-40'}`}
                              style={{ height: `${d.val > 0 ? Math.max(4, (d.val / (maxVal || 1)) * 100) : 2}%`, backgroundColor: chartColor }}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* X axis */}
                <div className="flex justify-between mt-1.5 ml-[52px]">
                  {xTicks
                    ? xTicks.map((di, i) => (
                        <span key={i} className="text-[8px] font-semibold text-muted-taupe">{chartData[di]?.label}</span>
                      ))
                    : chartData.map((d, i) => (
                        <span key={i} className={`flex-1 text-center text-[8px] font-bold uppercase ${selPoint === i ? 'text-premium-charcoal' : 'text-muted-taupe'}`}>{d.label}</span>
                      ))}
                </div>

                {/* Readout: selected point, or peak + average summary */}
                <div className="mt-3 pt-3 border-t border-black/5 text-[10px] text-muted-taupe leading-relaxed">
                  {selPoint !== null && sel ? (
                    <span>
                      <span className="font-bold text-premium-charcoal">
                        {chartMode === 'DAILY'
                          ? `${sel.label} ${selectedDate.toLocaleString('default', { month: 'short' })}`
                          : `Week ${selPoint + 1}`}
                        :
                      </span>{' '}
                      <span className="font-bold" style={{ color: chartColor }}>{formatAmount(sel.val)}</span>
                      {avgVal > 0 && sel.val > 0 ? ` · ${(sel.val / avgVal).toFixed(1)}× the ${chartMode === 'DAILY' ? 'daily' : 'weekly'} average` : ''}
                    </span>
                  ) : maxVal > 0 ? (
                    <span>
                      <span className="font-medium">Peak:</span> {formatAmount(chartData[peakIdx].val)} on {chartMode === 'DAILY' ? `day ${chartData[peakIdx].label}` : `week ${peakIdx + 1}`}
                      <span className="mx-2">•</span>
                      <span className="font-medium">Avg:</span> {formatAmount(avgVal)}/{chartMode === 'DAILY' ? 'day' : 'week'}
                      <span className="mx-2">•</span>
                      tap the chart to inspect
                    </span>
                  ) : (
                    <span>No {analysisTab.toLowerCase()} activity this month.</span>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>
      )}

      {/* Budget pace (current month only) */}
      {page === 'hub' && analysisTab === 'EXPENSE' && pace && (
        <div className="px-6 py-2 break-inside-avoid">
          <div className={`rounded-[28px] p-5 border ${pace.onTrack ? 'bg-sage/5 border-sage/20' : 'bg-rose/5 border-rose/20'}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">Month Pace</p>
                <p className="text-[11px] text-muted-taupe mt-0.5">
                  Day {pace.elapsedDays} of {pace.daysInMonth} · {formatAmount(pace.spentSoFar).split('.')[0]} spent
                </p>
              </div>
              <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${pace.onTrack ? 'bg-sage-light text-sage' : 'bg-rose-light text-rose'}`}>
                {pace.onTrack ? 'On track' : 'Over pace'}
              </span>
            </div>
            <p className="text-[13px] text-premium-charcoal">
              Projected: <span className={`font-serif font-bold ${pace.onTrack ? 'text-sage' : 'text-rose'}`}>{formatAmount(pace.projected).split('.')[0]}</span>
              <span className="text-muted-taupe text-[11px]"> vs {formatAmount(pace.reference).split('.')[0]} {pace.referenceKind === 'LIMIT' ? '(your daily limit)' : '(last month)'}</span>
            </p>
            <div className="mt-3 h-2 w-full bg-black/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${pace.onTrack ? 'bg-sage' : 'bg-rose'}`}
                style={{ width: `${Math.min(100, (pace.projected / pace.reference) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Top movers vs last month — both tabs. Colors flip meaning per tab:
          spending up = bad (rose), income up = good (sage). */}
      {page === 'categories' && movers.hasPrevData && (movers.up.length > 0 || movers.down.length > 0) && (() => {
        const upCls = analysisTab === 'EXPENSE' ? 'text-rose bg-rose-light' : 'text-sage bg-sage-light';
        const upText = analysisTab === 'EXPENSE' ? 'text-rose' : 'text-sage';
        const downCls = analysisTab === 'EXPENSE' ? 'text-sage bg-sage-light' : 'text-rose bg-rose-light';
        const downText = analysisTab === 'EXPENSE' ? 'text-sage' : 'text-rose';
        return (
          <div className="px-6 py-2 break-inside-avoid">
            <div className="bg-white rounded-[28px] p-5 shadow-soft border border-black/[0.02]">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-1">What Changed</p>
              <p className="text-[10px] text-muted-taupe mb-3">
                {analysisTab === 'EXPENSE' ? 'spending' : 'income'} vs {prevMonthData.monthName} · biggest category shifts
              </p>
              <div className="space-y-2">
                {movers.up.map((m, i) => (
                  <div key={`u${i}`} className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[18px] rounded-full p-1 ${upCls}`}>arrow_upward</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-premium-charcoal truncate">{m.category}</p>
                      <p className="text-[9px] text-muted-taupe">{formatAmount(m.previous).split('.')[0]} → {formatAmount(m.current).split('.')[0]}</p>
                    </div>
                    <span className={`text-[12px] font-bold shrink-0 ${upText}`}>
                      +{formatAmount(m.delta).split('.')[0]}{m.pctChange !== null ? ` (${m.pctChange > 0 ? '+' : ''}${m.pctChange}%)` : ' (new)'}
                    </span>
                  </div>
                ))}
                {movers.down.map((m, i) => (
                  <div key={`d${i}`} className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[18px] rounded-full p-1 ${downCls}`}>arrow_downward</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-premium-charcoal truncate">{m.category}</p>
                      <p className="text-[9px] text-muted-taupe">{formatAmount(m.previous).split('.')[0]} → {formatAmount(m.current).split('.')[0]}</p>
                    </div>
                    <span className={`text-[12px] font-bold shrink-0 ${downText}`}>
                      −{formatAmount(Math.abs(m.delta)).split('.')[0]}{m.pctChange !== null ? ` (${m.pctChange}%)` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Daily heatmap calendar — spend days or income days, per tab */}
      {page === 'trends' && dayStats.maxDaily > 0 && (() => {
        const isExp = analysisTab === 'EXPENSE';
        const rgb = isExp ? '229, 115, 115' : '155, 174, 147'; // rose / sage
        const zeroDays = dayStats.daily.filter(v => v === 0).length;
        return (
          <div className="px-6 py-2 break-inside-avoid">
            <div className="bg-white rounded-[28px] p-5 shadow-soft border border-black/[0.02]">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">Daily Heatmap</p>
                {heatDay !== null && (
                  <p className="text-[11px] font-semibold text-premium-charcoal">
                    {heatDay} {selectedDate.toLocaleString('default', { month: 'short' })}: <span className={`font-bold ${isExp ? 'text-rose' : 'text-sage'}`}>{formatAmount(dayStats.daily[heatDay - 1]).split('.')[0]}</span>
                  </p>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAY_LABELS.map((d, i) => (
                  <span key={i} className="text-center text-[8px] font-bold text-muted-taupe uppercase">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: dayStats.firstWeekday }, (_, i) => <span key={`pad${i}`} />)}
                {dayStats.daily.map((v, i) => {
                  const intensity = dayStats.maxDaily > 0 ? v / dayStats.maxDaily : 0;
                  const selected = heatDay === i + 1;
                  return (
                    <button
                      key={i}
                      onClick={() => setHeatDay(selected ? null : i + 1)}
                      className={`aspect-square rounded-md flex items-center justify-center text-[8px] font-semibold transition-all ${selected ? (isExp ? 'ring-2 ring-rose' : 'ring-2 ring-sage') : ''} ${intensity > 0.55 ? 'text-white' : 'text-muted-taupe'}`}
                      style={{ backgroundColor: v > 0 ? `rgba(${rgb}, ${0.15 + intensity * 0.75})` : 'var(--line)' }}
                      title={`${i + 1}: ${formatAmount(v)}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              {/* Day drill-down: tap a date to see exactly what happened */}
              {heatDay !== null && (() => {
                const y = selectedDate.getFullYear(), mo = selectedDate.getMonth();
                const dayTxs = counted
                  .filter(t => {
                    const d = parseDay(t.date);
                    return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === heatDay
                      && t.type === (isExp ? TransactionType.EXPENSE : TransactionType.INCOME);
                  })
                  .sort((a, b) => b.amount - a.amount);
                if (dayTxs.length === 0) {
                  return (
                    <p className="text-[10px] text-muted-taupe mt-3 pt-3 border-t border-black/5 italic">
                      No {isExp ? 'spending' : 'income'} on this day.
                    </p>
                  );
                }
                return (
                  <div className="mt-3 pt-3 border-t border-black/5 space-y-2">
                    {dayTxs.slice(0, 6).map(t => (
                      <div key={t.id} className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isExp ? 'bg-rose' : 'bg-sage'}`} />
                        <span className="text-[11px] text-premium-charcoal truncate flex-1" title={t.merchant || t.category}>
                          {prettyMerchant(t.merchant || t.category)}
                        </span>
                        <span className="text-[9px] text-muted-taupe shrink-0 uppercase tracking-wide">{t.category}</span>
                        <span className={`text-[11px] font-semibold shrink-0 tabular-nums ${isExp ? 'text-rose' : 'text-sage'}`}>
                          {isExp ? '-' : '+'}{formatAmount(t.amount).split('.')[0]}
                        </span>
                      </div>
                    ))}
                    {dayTxs.length > 6 && (
                      <p className="text-[9px] text-muted-taupe">+{dayTxs.length - 6} more — see Vault for the full day</p>
                    )}
                  </div>
                );
              })()}
              <p className="text-[9px] text-muted-taupe mt-3">
                {isExp
                  ? `Darker = more spent · ${zeroDays} no-spend day${zeroDays === 1 ? '' : 's'} this month · tap a day for details`
                  : `Darker = more received · income arrived on ${dayStats.daysInMonth - zeroDays} day${dayStats.daysInMonth - zeroDays === 1 ? '' : 's'} this month · tap a day for details`}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Weekday pattern — per tab (income needs fewer events to qualify) */}
      {page === 'trends' && dayStats.txCount >= (analysisTab === 'EXPENSE' ? 5 : 3) && maxWeekdayAvg > 1 && (() => {
        const isExp = analysisTab === 'EXPENSE';
        return (
          <div className="px-6 py-2 break-inside-avoid">
            <div className="bg-white rounded-[28px] p-5 shadow-soft border border-black/[0.02]">
              <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold mb-3">Weekday Pattern</p>
              <div className="flex items-end justify-between gap-2 h-20">
                {dayStats.weekdayAvg.map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-16 flex items-end">
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${v > 0 ? Math.max(6, (v / maxWeekdayAvg) * 100) : 2}%`,
                          backgroundColor: chartColor,
                          opacity: i === dayStats.busiestWeekday ? 1 : 0.3,
                        }}
                      />
                    </div>
                    <span className={`text-[9px] font-bold uppercase ${i === dayStats.busiestWeekday ? (isExp ? 'text-rose' : 'text-sage') : 'text-muted-taupe'}`}>{WEEKDAY_LABELS[i]}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-taupe mt-3">
                {['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][dayStats.busiestWeekday]}
                {isExp
                  ? ` are your heaviest spend days (~${formatAmount(dayStats.weekdayAvg[dayStats.busiestWeekday]).split('.')[0]} on average).`
                  : ` bring in the most income (~${formatAmount(dayStats.weekdayAvg[dayStats.busiestWeekday]).split('.')[0]} on average).`}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Recurring: bills and subscriptions found across the whole history,
          and the ones that went up in price */}
      {page === 'recurring' && (
        <div className="px-6 py-2 space-y-4 break-inside-avoid">
          {recurring.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 shadow-soft border border-black/[0.02] text-center">
              <span className="material-symbols-outlined icon-fill text-lavender text-[28px]" aria-hidden="true">autorenew</span>
              <p className="font-serif text-[16px] font-semibold text-premium-charcoal mt-2">No regular charges yet</p>
              <p className="text-[12px] text-muted-taupe mt-1 leading-relaxed">
                Bills and subscriptions show up here once a payee charges you about the same amount at least three times.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02] flex items-end justify-between gap-3">
                <div>
                  <p className="text-[12px] text-muted-taupe">Every month, about</p>
                  <p className="font-serif text-[30px] leading-tight text-premium-charcoal tabular-nums">{formatAmount(recurringMonthlyTotal).split('.')[0]}</p>
                </div>
                <p className="text-[12px] text-muted-taupe text-right">
                  {recurring.length} {recurring.length === 1 ? 'charge' : 'charges'}<br />
                  {formatAmountCompact(recurringMonthlyTotal * 12)} a year
                </p>
              </div>
              <ul className="bg-white rounded-3xl shadow-soft border border-black/[0.02] overflow-hidden divide-y divide-black/[0.05]">
                {[...recurring].sort((a, b) => a.nextExpected.getTime() - b.nextExpected.getTime()).map((r, i) => {
                  const days = Math.round((new Date(r.nextExpected).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
                  const next = days < 0 ? 'was due ' + r.nextExpected.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : days === 0 ? 'due today' : days === 1 ? 'due tomorrow'
                    : 'next ' + r.nextExpected.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  return (
                    <li key={i} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-9 h-9 rounded-2xl bg-lavender-light text-lavender flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined icon-fill text-[18px]" aria-hidden="true">{getIcon(r.category)}</span>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold text-premium-charcoal truncate" title={r.name}>{prettyMerchant(r.name)}</span>
                        <span className={`block text-[11px] truncate ${days >= 0 && days <= 3 ? 'text-premium-charcoal font-medium' : 'text-muted-taupe'}`}>
                          {r.cadence.charAt(0) + r.cadence.slice(1).toLowerCase()} · {next}
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-[14px] font-semibold text-premium-charcoal tabular-nums">{formatAmount(r.amount).split('.')[0]}</span>
                        {r.cadence !== 'MONTHLY' && (
                          <span className="block text-[11px] text-muted-taupe tabular-nums">{formatAmountCompact(r.monthlyCost)} a month</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {rises.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-black/[0.02]">
              <p className="text-[13px] font-semibold text-premium-charcoal">Gone up in price</p>
              <p className="text-[12px] text-muted-taupe mb-3">Same payee, same rhythm, a higher amount than before.</p>
              <ul className="space-y-3">
                {rises.slice(0, 6).map(rise => (
                  <li key={rise.key} className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-2xl bg-rose-light text-rose flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined icon-fill text-[18px]" aria-hidden="true">trending_up</span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold text-premium-charcoal truncate" title={rise.name}>{prettyMerchant(rise.name)}</span>
                      <span className="block text-[11px] text-muted-taupe tabular-nums">
                        {formatAmountCompact(rise.from)} → {formatAmountCompact(rise.to)} a month
                      </span>
                    </span>
                    <span className="text-[12px] font-semibold text-rose tabular-nums shrink-0">+{formatAmountCompact(rise.annualExtra)} a year</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Category Breakdown */}
      {page === 'categories' && (
      <div className="px-6 py-4 break-inside-avoid">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-premium-charcoal text-base font-serif font-semibold">
            {analysisTab === 'EXPENSE' ? 'Where Money Goes' : 'Income Sources'}
          </h3>
          {categoryBreakdown.length > 0 && (
            <button 
              onClick={() => onNavigate(AppScreen.CATEGORY_SPLIT)}
              className="text-sage text-[10px] font-serif font-medium underline underline-offset-4"
            >
              View Pie
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          {categoryBreakdown.length > 0 ? categoryBreakdown.slice(0, 5).map((cat, i) => (
            <div key={i} className="bg-white rounded-2xl p-3 shadow-sm border border-black/5">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${analysisTab === 'EXPENSE' ? 'bg-rose/10 text-rose' : 'bg-sage/10 text-sage'}`}>
                    <span className="material-symbols-outlined text-[16px]">{getIcon(cat.name)}</span>
                  </div>
                  <div>
                    <span className="text-[12px] font-medium text-premium-charcoal block">{cat.name}</span>
                    <span className="text-[9px] text-muted-taupe">{cat.count} transactions • Avg {formatAmount(cat.avgPerTx)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[13px] font-bold text-premium-charcoal block">{formatAmount(cat.amount)}</span>
                  <span className="text-[10px] text-muted-taupe">{cat.percentOfTotal}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                <div
                  className={
                    `${styles.savingsBar} ` +
                    (analysisTab === 'EXPENSE' ? styles.expenseBar : styles.incomeBar) + ' ' + styles[`w${Math.round(cat.barWidth)}p`]
                  }
                />
              </div>
            </div>
          )) : (
            <div className="text-center text-muted-taupe text-xs italic py-6 bg-white rounded-2xl">
              No {analysisTab.toLowerCase()} data for this month
            </div>
          )}
          
          {categoryBreakdown.length > 5 && (
            <button className="w-full text-center text-sage text-[10px] font-medium py-2 hover:underline">
              +{categoryBreakdown.length - 5} more categories
            </button>
          )}
        </div>
      </div>
      )}

      {/* Smart Insights */}
      {page === 'health' && insights.length > 0 && (
        <div className="px-6 py-4 break-inside-avoid">
          <h3 className="text-premium-charcoal text-base font-serif font-semibold mb-3">Smart Insights</h3>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div 
                key={i} 
                className={`rounded-2xl p-4 flex items-start gap-3 ${
                  insight.type === 'good' ? 'bg-sage/10 border border-sage/20' :
                  insight.type === 'warning' ? 'bg-rose/10 border border-rose/20' :
                  'bg-amber-50 border border-amber-200'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${
                  insight.type === 'good' ? 'text-sage' :
                  insight.type === 'warning' ? 'text-rose' :
                  'text-amber-600'
                }`}>
                  {insight.icon}
                </span>
                <p className="text-[11px] leading-relaxed text-premium-charcoal flex-1">{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health check: worked out on the phone (services/insightsService.ts),
          no AI service involved, so nothing here says AI. */}
      {page === 'health' && currentData.length > 0 && (
        <div className="px-6 py-4 break-inside-avoid">
          <div className="bg-white rounded-[24px] p-5 shadow-soft border border-black/[0.02]">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-sage-light text-sage flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">monitor_heart</span>
                </div>
                <h3 className="text-premium-charcoal text-base font-serif font-semibold">Health check</h3>
              </div>
              {!showCheck && (
                <button
                  onClick={runHealthCheck}
                  disabled={checking}
                  className="px-4 py-2 bg-sage text-white rounded-full text-[12px] font-semibold shadow-soft active:scale-95 transition-all disabled:opacity-50 shrink-0"
                >
                  {checking ? 'Checking…' : 'Check this month'}
                </button>
              )}
            </div>

            {!showCheck && !checking && (
              <p className="text-[12px] text-muted-taupe leading-relaxed">
                What you kept, where most of it went, unusual payments and where you could save. Worked out on your phone.
              </p>
            )}

            {showCheck && health && (() => {
              const score = Math.max(0, Math.min(100, 100 - health.riskScore));
              const tone = score >= 70 ? 'text-sage' : score >= 30 ? 'text-amber-600' : 'text-rose';
              const bar = score >= 70 ? styles.riskScoreLow : score >= 30 ? styles.riskScoreMed : styles.riskScoreHigh;
              const list = (icon: string, iconCls: string, title: string, items: string[]) => items.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`material-symbols-outlined text-[18px] ${iconCls}`} aria-hidden="true">{icon}</span>
                    <h4 className="text-[12px] font-semibold text-premium-charcoal">{title}</h4>
                  </div>
                  <ul className="space-y-1.5 pl-7">
                    {items.map((item, i) => (
                      <li key={i} className="text-[12px] leading-relaxed text-premium-charcoal list-disc marker:text-muted-taupe">{item}</li>
                    ))}
                  </ul>
                </div>
              );
              return (
                <div className="space-y-4 animate-slide-up">
                  <p className="text-[13px] leading-relaxed text-premium-charcoal">{health.summary}</p>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-semibold text-premium-charcoal">Health score</span>
                      <span className={`text-sm font-bold tabular-nums ${tone}`}>{score}/100</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`${styles.riskScoreBar} ${bar} ${styles[`w${score}p`]}`} />
                    </div>
                  </div>
                  {list('lightbulb', 'text-sage', 'What stands out', health.keyFindings)}
                  {list('check_circle', 'text-sage', 'Worth doing', health.recommendations)}
                  {list('warning', 'text-amber-600', 'Unusual payments', health.anomalies)}
                  {list('savings', 'text-sage', 'Where you could save', health.savingsOpportunities)}
                  <div className="bg-sage-light rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-[18px] text-sage" aria-hidden="true">account_balance_wallet</span>
                      <h4 className="text-[12px] font-semibold text-premium-charcoal">A budget to try</h4>
                    </div>
                    <p className="text-[12px] leading-relaxed text-premium-charcoal">{health.budgetSuggestion}</p>
                  </div>
                  <button
                    onClick={() => setShowCheck(false)}
                    className="w-full px-4 py-2.5 bg-gray-100 text-muted-taupe rounded-full text-[12px] font-semibold hover:text-premium-charcoal transition-all"
                  >
                    Close
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Range Stats */}
      {page === 'trends' && txStats && (
        <div className="px-6 pb-6 break-inside-avoid">
          <div className="bg-gradient-to-br from-premium-charcoal to-premium-charcoal/90 rounded-[24px] p-5 text-white">
            <h4 className="text-[10px] uppercase tracking-widest font-medium text-white/60 mb-3">
              {analysisTab === 'EXPENSE' ? 'Spending' : 'Income'} Range
            </h4>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-white/50 mb-0.5">Minimum</p>
                <p className="text-lg font-serif font-bold">{formatAmount(txStats.min)}</p>
              </div>
              <div className="flex-1 mx-4 h-px bg-white/20 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/10 rounded-full px-2 py-0.5">
                  <span className="text-[8px] text-white/70">median {formatAmount(txStats.median)}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider text-white/50 mb-0.5">Maximum</p>
                <p className="text-lg font-serif font-bold">{formatAmount(txStats.max)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>{/* /lg:columns-2 */}
    </div>
  );
};

export default SpendAnalysis;
