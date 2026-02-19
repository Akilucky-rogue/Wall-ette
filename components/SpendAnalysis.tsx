import React, { useMemo, useState, useEffect } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { WallEMascot, FloatingLeaf, RangoliCorner, LotusFlower, Paisley } from './SplashScreen';
import { analyzeFinancialHealth, FinancialInsight } from '../services/geminiService';
import styles from './SpendAnalysis.module.css';

interface SpendAnalysisProps {
  onNavigate: (screen: AppScreen) => void;
}

const SpendAnalysis: React.FC<SpendAnalysisProps> = ({ onNavigate }) => {
  const { transactions, formatAmount } = useWallet();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [chartMode, setChartMode] = useState<'WEEKLY' | 'DAILY'>('DAILY');
  const [analysisTab, setAnalysisTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  
  // AI Insights State
  const [aiInsights, setAiInsights] = useState<FinancialInsight | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showAiInsights, setShowAiInsights] = useState(false);

  // Auto-detect the month with most recent transactions
  const latestTxDate = useMemo(() => {
    if (transactions.length === 0) return new Date();
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return new Date(sorted[0].date);
  }, [transactions]);

  const [selectedDate, setSelectedDate] = useState(latestTxDate);
  
  // Update selectedDate when latestTxDate changes (e.g., new import)
  useEffect(() => {
    setSelectedDate(latestTxDate);
  }, [latestTxDate]);

  // Helper: Get days in month
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  // Filter transactions by selected month
  const filteredExpenses = useMemo(() => {
    return transactions.filter(t => 
      t.type === TransactionType.EXPENSE && 
      new Date(t.date).getMonth() === selectedDate.getMonth() &&
      new Date(t.date).getFullYear() === selectedDate.getFullYear()
    );
  }, [transactions, selectedDate]);

  const filteredIncome = useMemo(() => {
    return transactions.filter(t => 
      t.type === TransactionType.INCOME && 
      new Date(t.date).getMonth() === selectedDate.getMonth() &&
      new Date(t.date).getFullYear() === selectedDate.getFullYear()
    );
  }, [transactions, selectedDate]);

  const totalExpense = filteredExpenses.reduce((acc, t) => acc + t.amount, 0);
  const totalIncome = filteredIncome.reduce((acc, t) => acc + t.amount, 0);
  const netFlow = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  // Previous month comparison
  const prevMonthData = useMemo(() => {
    const prevDate = new Date(selectedDate);
    prevDate.setMonth(prevDate.getMonth() - 1);
    
    const prevExpenses = transactions.filter(t => 
      t.type === TransactionType.EXPENSE && 
      new Date(t.date).getMonth() === prevDate.getMonth() &&
      new Date(t.date).getFullYear() === prevDate.getFullYear()
    );
    const prevIncome = transactions.filter(t => 
      t.type === TransactionType.INCOME && 
      new Date(t.date).getMonth() === prevDate.getMonth() &&
      new Date(t.date).getFullYear() === prevDate.getFullYear()
    );
    
    return {
      expense: prevExpenses.reduce((acc, t) => acc + t.amount, 0),
      income: prevIncome.reduce((acc, t) => acc + t.amount, 0),
      monthName: prevDate.toLocaleDateString('en-US', { month: 'short' })
    };
  }, [transactions, selectedDate]);

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
  const chartColor = analysisTab === 'EXPENSE' ? '#E57373' : '#9BAE93';

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
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-5 opacity-35" delay={0.6} />
      <FloatingLeaf className="top-64 left-4 opacity-25" delay={1.8} color="#A8B89E" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="#8B9E82" />
      <Paisley className="absolute bottom-40 right-5 opacity-25" color="#C4A98E" />
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

      {/* Quick Stats Row */}
      {txStats && (
        <div className="px-6 pb-4">
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

      {/* Net Flow Card (when viewing expenses) */}
      {analysisTab === 'EXPENSE' && totalIncome > 0 && (
        <div className="px-6 pb-4">
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
      <div className="px-6 py-2">
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
          
          <div className="h-32 w-full relative flex items-end justify-between gap-1">
            {chartMode === 'DAILY' ? (
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`gradient-${analysisTab}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity="0.4"/>
                    <stop offset="100%" stopColor={chartColor} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d={sparklinePath} fill={`url(#gradient-${analysisTab})`} />
                <path d={sparklineStroke} fill="none" stroke={chartColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              </svg>
            ) : (
              chartData.map((d, i) => (
                <div key={i} className="flex flex-col items-center flex-1 gap-1 group">
                  <div className="w-full h-24 flex items-end relative">
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-premium-charcoal text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {formatAmount(d.val)}
                    </div>
                    <div
                      className={`w-full group-hover:opacity-80 ${styles.chartBar} ${analysisTab === 'EXPENSE' ? styles.expenseChartBar : styles.incomeChartBar} ${styles[`h${Math.round(d.val > 0 ? Math.max(8, (d.val / (Math.max(...chartData.map(x => x.val)) || 1)) * 100) : 4)}p`]}`}
                    />
                  </div>
                  <span className="text-[8px] font-bold text-muted-taupe uppercase">{d.label}</span>
                </div>
              ))
            )}
          </div>

          {/* Weekly Insight */}
          {chartMode === 'WEEKLY' && weeklyInsights && chartData.some(d => d.val > 0) && (
            <div className="mt-3 pt-3 border-t border-black/5 text-[10px] text-muted-taupe">
              <span className="font-medium">Peak: </span>Week {weeklyInsights.maxWeek} ({formatAmount(chartData[weeklyInsights.maxWeek - 1]?.val || 0)})
              <span className="mx-2">•</span>
              <span className="font-medium">Avg: </span>{formatAmount(weeklyInsights.avgWeekly)}/week
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="px-6 py-4">
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
        <div className="px-6 py-4">
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
        <div className="px-6 py-4">
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
                  {/* The above code was a broken fragment. No chart bar is needed here; this was a patching error. Remove it. */}
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
        <div className="px-6 pb-6">
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
    </div>
  );
};

export default SpendAnalysis;
