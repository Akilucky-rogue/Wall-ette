import React, { useMemo, useState, useEffect } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { WallEMascot, FloatingLeaf, RangoliCorner, LotusFlower, Paisley } from './SplashScreen';
import { analyzeFinancialHealth, FinancialInsight } from '../services/insightsService';
import { categoryMovers, detectRecurringCharges, monthDailyStats, spendingPace, prettyMerchant } from '../services/analyticsService';
import styles from './SpendAnalysis.module.css';

interface SpendAnalysisProps {
  onNavigate: (screen: AppScreen) => void;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const SpendAnalysis: React.FC<SpendAnalysisProps> = ({ onNavigate }) => {
  const { transactions, formatAmount, formatAmountCompact, dailyLimit } = useWallet();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [chartMode, setChartMode] = useState<'WEEKLY' | 'DAILY'>('DAILY');
  const [analysisTab, setAnalysisTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [heatDay, setHeatDay] = useState<number | null>(null); // selected heatmap day (1-based)
  const [selPoint, setSelPoint] = useState<number | null>(null); // selected trends day/week
  
  // AI Insights State
  const [aiInsights, setAiInsights] = useState<FinancialInsight | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showAiInsights, setShowAiInsights] = useState(false);

  // Auto-detect the month with most recent transactions
  // (single O(n) max scan instead of copy + sort — audit Phase 2.6)
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
  
  // Update selectedDate when latestTxDate changes (e.g., new import)
  useEffect(() => {
    setSelectedDate(latestTxDate);
  }, [latestTxDate]);

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

    const expensesArr: typeof transactions = [];
    const incomeArr: typeof transactions = [];
    let expSum = 0, incSum = 0, prevExpSum = 0, prevIncSum = 0;

    for (const t of transactions) {
      const d = new Date(t.date);
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
  }, [transactions, selectedDate]);

  const netFlow = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  // ── New insight sections (expense tab) ─────────────────────────────────────

  // Month-over-month category movers for the active tab (noise floor: ₹100 delta)
  const movers = useMemo(
    () => categoryMovers(transactions, selectedDate, analysisTab === 'EXPENSE' ? TransactionType.EXPENSE : TransactionType.INCOME),
    [transactions, selectedDate, analysisTab]
  );

  // Recurring charges / subscriptions (whole history, cadence-validated)
  const recurring = useMemo(() => detectRecurringCharges(transactions), [transactions]);
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
        const d = new Date(t.date).getDate() - 1;
        if (d >= 0 && d < daysInMonth) daily[d] += t.amount;
      });
      return daily.map((val, i) => ({ label: (i+1).toString(), val }));
    } else {
      // Weekly
      const weekly = [0, 0, 0, 0, 0];
      data.forEach(t => {
        const d = new Date(t.date).getDate();
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
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setSelectedDate(newDate);
  };

  const currentTotal = analysisTab === 'EXPENSE' ? totalExpense : totalIncome;
  const currentData = analysisTab === 'EXPENSE' ? filteredExpenses : filteredIncome;
  const chartColor = analysisTab === 'EXPENSE' ? 'var(--rose-strong)' : 'var(--sage)';

  // Fetch AI insights when user requests them
  const fetchAIInsights = async () => {
    if (loadingInsights) return;
    
    setLoadingInsights(true);
    try {
      const monthTransactions = transactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate.getMonth() === selectedDate.getMonth() &&
               txDate.getFullYear() === selectedDate.getFullYear();
      }).map(t => ({
        ...t,
        merchant: t.merchant || ''
      }));
      
      const insights = await analyzeFinancialHealth(monthTransactions, totalIncome);
      setAiInsights(insights);
      setShowAiInsights(true);
    } catch (err) {
      console.error('AI Analysis failed:', err);
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] lg:max-w-3xl mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-5 opacity-35" delay={0.6} />
      <FloatingLeaf className="top-64 left-4 opacity-25" delay={1.8} color="var(--sage-3)" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="var(--sage-2)" />
      <Paisley className="absolute bottom-40 right-5 opacity-25" color="var(--gold-1)" />
      <LotusFlower className="absolute top-44 right-3 opacity-30" size="sm" />
      
      {/* Header */}
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-4 justify-between sticky top-0 z-30">
        <button 
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="flex w-10 items-center justify-start text-muted-taupe hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">chevron_left</span>
        </button>
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">Pulse</h2>
        <div className="flex w-10 items-center justify-end text-muted-taupe relative">
          <button 
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`flex items-center justify-center rounded-full h-10 w-10 border border-black/5 transition-colors ${showDatePicker ? 'bg-sage text-white' : 'bg-white/50 hover:bg-white'}`}
          >
            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
          </button>
          
          {showDatePicker && (
            <div className="absolute top-12 right-0 bg-white rounded-2xl shadow-xl border border-black/5 p-4 z-[60] animate-slide-up w-48">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => handleMonthChange(-1)} className="p-1 text-muted-taupe hover:text-sage">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <span className="font-serif font-bold text-premium-charcoal text-sm">
                  {selectedDate.toLocaleDateString('en-GB')}
                </span>
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

      {/* Analysis Tab Switcher */}
      <div className="px-6 pt-2 pb-4">
        <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-black/5">
          <button 
            onClick={() => setAnalysisTab('EXPENSE')}
            className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              analysisTab === 'EXPENSE' 
                ? 'bg-rose/10 text-rose shadow-sm' 
                : 'text-muted-taupe hover:text-premium-charcoal'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">trending_down</span>
            Expenses
          </button>
          <button 
            onClick={() => setAnalysisTab('INCOME')}
            className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              analysisTab === 'INCOME' 
                ? 'bg-sage/10 text-sage shadow-sm' 
                : 'text-muted-taupe hover:text-premium-charcoal'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            Income
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="flex flex-col items-center pb-4">
        <p className="text-muted-taupe text-[10px] font-serif font-medium uppercase tracking-[0.2em] mb-1">
          {analysisTab === 'EXPENSE' ? 'Total Outflow' : 'Total Inflow'} · {selectedDate.toLocaleDateString('en-GB')}
        </p>
        <h1 className={`font-serif text-[38px] leading-tight px-4 text-center ${analysisTab === 'EXPENSE' ? 'text-rose' : 'text-sage'}`}>
          {formatAmount(currentTotal)}
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

      {/* Desktop: sections flow into two columns; phones/APK keep one column */}
      <div className="lg:columns-2 lg:gap-x-0">

      {/* TODAY — daily spend analysis, front and center */}
      {(() => {
        const now = new Date();
        const isExp = analysisTab === 'EXPENSE';
        const todayTxs = transactions
          .filter(t => {
            const d = new Date(t.date);
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

      {/* Quick Stats Row */}
      {txStats && (
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
      {totalIncome > 0 && (
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

      {/* Budget pace (current month only) */}
      {analysisTab === 'EXPENSE' && pace && (
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
      {movers.hasPrevData && (movers.up.length > 0 || movers.down.length > 0) && (() => {
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
      {dayStats.maxDaily > 0 && (() => {
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
                const dayTxs = transactions
                  .filter(t => {
                    const d = new Date(t.date);
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
      {dayStats.txCount >= (analysisTab === 'EXPENSE' ? 5 : 3) && maxWeekdayAvg > 1 && (() => {
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

      {/* Recurring charges / subscriptions */}
      {analysisTab === 'EXPENSE' && recurring.length > 0 && (
        <div className="px-6 py-2 break-inside-avoid">
          <div className="bg-white rounded-[28px] p-5 shadow-soft border border-black/[0.02]">
            <div className="flex justify-between items-end mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-taupe font-bold">Recurring Charges</p>
                <p className="text-[10px] text-muted-taupe mt-0.5">detected across your history</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-serif font-bold text-rose">{formatAmount(recurringMonthlyTotal).split('.')[0]}/mo</p>
                <p className="text-[9px] text-muted-taupe">≈ {formatAmount(recurringMonthlyTotal * 12).split('.')[0]}/yr</p>
              </div>
            </div>
            <div className="space-y-3">
              {recurring.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-lavender-light text-lavender flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">autorenew</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-premium-charcoal truncate">{r.name}</p>
                    <p className="text-[9px] text-muted-taupe">
                      {r.cadence.toLowerCase()} · {r.occurrences}× · next ~{r.nextExpected.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-bold text-premium-charcoal">{formatAmount(r.amount).split('.')[0]}</p>
                    <p className="text-[9px] text-muted-taupe">{formatAmount(r.monthlyCost).split('.')[0]}/mo</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
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

      {/* Smart Insights */}
      {insights.length > 0 && (
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

      {/* AI-Powered Insights */}
      {currentData.length > 0 && (
        <div className="px-6 py-4 break-inside-avoid">
          <div className="bg-gradient-to-br from-purple-50 to-lavender/20 rounded-[24px] p-5 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-lavender flex items-center justify-center">
                  <WallEMascot mood="happy" size="sm" />
                </div>
                <h3 className="text-premium-charcoal text-base font-serif font-semibold">AI Pulse</h3>
              </div>
              
              {!showAiInsights && (
                <button
                  onClick={fetchAIInsights}
                  disabled={loadingInsights}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-lavender text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  {loadingInsights ? 'Analyzing...' : '✦ Analyze with AI'}
                </button>
              )}
            </div>

            {!showAiInsights && !loadingInsights && (
              <p className="text-[11px] text-muted-taupe leading-relaxed">
                Get personalized AI-powered recommendations, anomaly detection, and savings opportunities based on your spending patterns.
              </p>
            )}

            {loadingInsights && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-lavender flex items-center justify-center animate-pulse">
                  <WallEMascot mood="happy" size="sm" />
                </div>
                <p className="text-[11px] text-muted-taupe animate-pulse">Analyzing your financial health...</p>
              </div>
            )}

            {showAiInsights && aiInsights && (
              <div className="space-y-4 animate-slide-up">
                {/* Summary */}
                <div className="bg-white/80 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[18px] text-purple-600">insights</span>
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-purple-600">Summary</h4>
                  </div>
                  <p className="text-[12px] leading-relaxed text-premium-charcoal">{aiInsights.summary}</p>
                </div>

                {/* Risk Score */}
                <div className="bg-white/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-purple-600">speed</span>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-purple-600">Financial Health</h4>
                    </div>
                    <span className={`text-sm font-bold ${
                      aiInsights.riskScore < 30 ? 'text-sage' :
                      aiInsights.riskScore < 70 ? 'text-amber-600' :
                      'text-rose'
                    }`}>{aiInsights.riskScore}/100</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={
                          `${styles.riskScoreBar} ` +
                          (aiInsights.riskScore < 30
                            ? styles.riskScoreLow
                            : aiInsights.riskScore < 70
                            ? styles.riskScoreMed
                            : styles.riskScoreHigh) + ' ' + styles[`w${Math.round(aiInsights.riskScore)}p`]
                        }
                      />
                    </div>
                    {aiInsights.keyFindings.length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-[18px] text-purple-600">lightbulb</span>
                          <h4 className="text-[10px] uppercase tracking-widest font-bold text-purple-600">Key Findings</h4>
                        </div>
                        {aiInsights.keyFindings.map((finding, i) => (
                          <div key={i} className="bg-white/60 rounded-xl p-3 flex items-start gap-2">
                            <span className="text-purple-500 text-[16px]">•</span>
                            <p className="text-[11px] leading-relaxed text-premium-charcoal flex-1">{finding}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                {/* Recommendations */}
                {aiInsights.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-sage">check_circle</span>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-sage">Recommendations</h4>
                    </div>
                    {aiInsights.recommendations.map((rec, i) => (
                      <div key={i} className="bg-sage/10 rounded-xl p-3 flex items-start gap-2 border border-sage/20">
                        <span className="text-sage text-[16px]">✓</span>
                        <p className="text-[11px] leading-relaxed text-premium-charcoal flex-1">{rec}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Anomalies */}
                {aiInsights.anomalies.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-amber-600">warning</span>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-amber-600">Unusual Patterns</h4>
                    </div>
                    {aiInsights.anomalies.map((anomaly, i) => (
                      <div key={i} className="bg-amber-50 rounded-xl p-3 flex items-start gap-2 border border-amber-200">
                        <span className="text-amber-600 text-[16px]">⚠</span>
                        <p className="text-[11px] leading-relaxed text-premium-charcoal flex-1">{anomaly}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Savings Opportunities */}
                {aiInsights.savingsOpportunities.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-sage">savings</span>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-sage">Savings Opportunities</h4>
                    </div>
                    {aiInsights.savingsOpportunities.map((opp, i) => (
                      <div key={i} className="bg-sage/10 rounded-xl p-3 flex items-start gap-2 border border-sage/20">
                        <span className="text-sage text-[16px]">💰</span>
                        <p className="text-[11px] leading-relaxed text-premium-charcoal flex-1">{opp}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Budget Suggestion */}
                <div className="bg-gradient-to-br from-purple-500 to-lavender rounded-2xl p-4 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                    <h4 className="text-[10px] uppercase tracking-widest font-bold">Budget Suggestion</h4>
                  </div>
                  <p className="text-[11px] leading-relaxed">{aiInsights.budgetSuggestion}</p>
                </div>

                <button
                  onClick={() => setShowAiInsights(false)}
                  className="w-full px-4 py-2 bg-purple-100 text-purple-600 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-purple-200 transition-all"
                >
                  Close Insights
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Range Stats */}
      {txStats && (
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
