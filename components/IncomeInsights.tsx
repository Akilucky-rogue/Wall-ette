import React, { useMemo } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { WallEMascot, FloatingLeaf, LotusFlower, RangoliCorner, Diya, MandalaDots } from './SplashScreen';

interface IncomeInsightsProps {
  onNavigate: (screen: AppScreen) => void;
}

const IncomeInsights: React.FC<IncomeInsightsProps> = ({ onNavigate }) => {
  const { transactions, currency, formatAmount } = useWallet();

  const latestTxDate = useMemo(() => {
    if (transactions.length === 0) return null;
    const latest = transactions.reduce((acc, t) => {
      const tDate = new Date(t.date);
      return tDate > acc ? tDate : acc;
    }, new Date(transactions[0].date));
    return Number.isNaN(latest.getTime()) ? null : latest;
  }, [transactions]);

  const effectiveDate = latestTxDate || new Date();

  const totalFlow = useMemo(() => {
    const m = effectiveDate.getMonth();
    const y = effectiveDate.getFullYear();
    return transactions
      .filter(t => t.type === TransactionType.INCOME && new Date(t.date).getMonth() === m && new Date(t.date).getFullYear() === y)
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions, effectiveDate]);

  const totalExpense = useMemo(() => {
    const m = effectiveDate.getMonth();
    const y = effectiveDate.getFullYear();
    return transactions
      .filter(t => t.type === TransactionType.EXPENSE && new Date(t.date).getMonth() === m && new Date(t.date).getFullYear() === y)
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions, effectiveDate]);
  
  const savingsRate = useMemo(() => {
      if (totalFlow === 0) return 0;
      const saved = totalFlow - totalExpense;
      return Math.max(0, Math.round((saved / totalFlow) * 100));
  }, [totalFlow, totalExpense]);

  const incomeSources = useMemo(() => {
      const sources: Record<string, { total: number; count: number }> = {};
      transactions
        .filter(t => t.type === TransactionType.INCOME)
        .forEach(t => {
            if (!sources[t.category]) {
                sources[t.category] = { total: 0, count: 0 };
            }
            sources[t.category].total += t.amount;
            sources[t.category].count += 1;
        });
      
      return Object.entries(sources)
        .map(([name, stats]) => ({ 
            name, 
            val: stats.total,
            count: stats.count,
            avg: stats.total / stats.count
        }))
        .sort((a, b) => b.val - a.val);
  }, [transactions]);

  // Determine consistency based on number of sources and frequency
  const consistencyStatus = useMemo(() => {
      if (incomeSources.length === 0) return { label: 'No Data', color: 'text-muted-taupe' };
      if (incomeSources.length === 1) return { label: 'Focused', color: 'text-sage' };
      return { label: 'Diversified', color: 'text-sage' };
  }, [incomeSources]);

  // Dynamic Chart Data: Last 7 days with Smooth Curve
  const dailyIncomeData = useMemo(() => {
    const days = 7;
    const data = [];
    const now = new Date(effectiveDate);
    
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dayStr = d.toLocaleDateString('en-GB', { weekday: 'narrow' });
        
        // Sum income for this day
        const sum = transactions
            .filter(t => 
                t.type === TransactionType.INCOME && 
                new Date(t.date).toDateString() === d.toDateString()
            )
            .reduce((acc, t) => acc + t.amount, 0);
        
        data.push({ day: dayStr, amount: sum });
    }
    return data;
  }, [transactions, effectiveDate]);

  // Generate Bezier Curve Path for the Chart
  const chartPath = useMemo(() => {
      if (dailyIncomeData.every(d => d.amount === 0)) return "";
      
      const max = Math.max(...dailyIncomeData.map(d => d.amount)) || 100;
      const width = 400;
      const height = 120;
      const paddingY = 20;
      const effectiveHeight = height - paddingY * 2;
      
      const points = dailyIncomeData.map((d, i) => {
          const x = i * (width / (dailyIncomeData.length - 1));
          const normalizedAmount = d.amount / max;
          const y = (height - paddingY) - (normalizedAmount * effectiveHeight);
          return { x, y };
      });

      // Start path
      let d = `M${points[0].x},${points[0].y}`;

      for (let i = 0; i < points.length - 1; i++) {
        const x_mid = (points[i].x + points[i + 1].x) / 2;
        const y_mid = (points[i].y + points[i + 1].y) / 2;
        const cp_x1 = (x_mid + points[i].x) / 2;
        const cp_x2 = (x_mid + points[i + 1].x) / 2;
        
        // Simple smoothing using quadratic curves could work, but lets try a basic cubic control point strategy or just catmull-rom if we had a lib. 
        // For simplicity without libs, simple lines or basic curve:
        // Let's use simple Cubic Bezier connecting points
        d += ` C ${points[i].x + 20},${points[i].y} ${points[i+1].x - 20},${points[i+1].y} ${points[i+1].x},${points[i+1].y}`;
      }

      return d;
  }, [dailyIncomeData]);

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-6 opacity-40" delay={0.4} />
      <FloatingLeaf className="top-56 left-4 opacity-30" delay={1.5} color="#A8B89E" />
      <RangoliCorner className="absolute top-20 left-2 opacity-20" color="#8B9E82" />
      <LotusFlower className="absolute top-40 right-4 opacity-35" size="sm" color="#D4B896" />
      <MandalaDots className="absolute bottom-44 left-6 opacity-20" />
      <Diya className="absolute bottom-36 right-8 opacity-40" />
      
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        <button 
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="flex w-10 items-center justify-start text-muted-taupe hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </button>
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">Income Insights</h2>
        <div className="flex w-10 items-center justify-end text-muted-taupe">
          <button className="flex items-center justify-center rounded-full h-10 w-10 bg-white/50 border border-black/5 hover:bg-white transition-colors">
            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center py-8 px-6">
        <p className="text-muted-taupe text-[10px] font-medium uppercase tracking-[0.2em] mb-1">Total Monthly Flow</p>
        <p className="text-muted-taupe text-[9px] font-medium uppercase tracking-[0.2em] mb-2">
          {effectiveDate.toLocaleDateString('en-GB')}
        </p>
        <div className="flex items-baseline gap-2">
          <h1 className="text-premium-charcoal font-serif text-[44px] leading-tight text-center">{formatAmount(totalFlow)}</h1>
        </div>
        
        {/* Dynamic Chart Visualization */}
        <div className="w-full mt-8 h-32 relative flex items-end justify-between px-2">
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 120">
                 <defs>
                    <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#9BAE93" stopOpacity="1" />
                        <stop offset="100%" stopColor="#9BAE93" stopOpacity="0.2" />
                    </linearGradient>
                 </defs>
                 {chartPath ? (
                     <path d={chartPath} fill="none" stroke="url(#chartGrad)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke"></path>
                 ) : (
                     <line x1="0" y1="60" x2="400" y2="60" stroke="#E3EAE0" strokeWidth="2" strokeDasharray="5,5" />
                 )}
            </svg>
            {dailyIncomeData.map((d, i) => (
                <div key={i} className={`flex flex-col items-center gap-1 z-10 transition-opacity ${i >= dailyIncomeData.length - 3 ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-1 h-1 ${d.amount > 0 ? 'bg-sage scale-150' : 'bg-muted-taupe'} rounded-full`}></div>
                    <span className={`text-[8px] uppercase tracking-tighter ${d.amount > 0 ? 'font-bold text-sage' : ''}`}>{d.day}</span>
                </div>
            ))}
        </div>
      </div>

      {/* Financial Harmony / Savings Rate */}
      <div className="px-6 py-4">
          <h3 className="text-premium-charcoal text-[13px] font-serif font-semibold tracking-tight mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">balance</span>
            Financial Harmony
          </h3>
          <div className="bg-white p-6 rounded-3xl border border-black/[0.02] shadow-soft flex items-center gap-6">
              <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 36 36">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E3EAE0" strokeWidth="4" />
                      <path 
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                        fill="none" 
                        stroke={savingsRate > 20 ? "#9BAE93" : savingsRate > 0 ? "#D6C6B2" : "#D4A5A5"} 
                        strokeWidth="4" 
                        strokeDasharray={`${savingsRate}, 100`} 
                      />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-[12px] font-bold text-premium-charcoal">{savingsRate}%</span>
                  </div>
              </div>
              <div>
                  <h4 className="font-serif font-semibold text-premium-charcoal text-base">Savings Rate</h4>
                  <p className="text-[11px] text-muted-taupe leading-relaxed mt-1">
                      {savingsRate > 20 ? "Excellent balance. You are retaining a healthy portion of income." : "Tight margin. Focus on reducing variable expenses."}
                  </p>
              </div>
          </div>
      </div>

      <div className="px-6 py-6">
        <div className="flex justify-between items-end mb-6">
          <h3 className="text-premium-charcoal text-[15px] font-serif font-semibold tracking-tight">Active Streams</h3>
        </div>
        <div className="space-y-4">
          {incomeSources.length > 0 ? incomeSources.map((item, i) => (
             <div key={i} className={`bg-white p-5 rounded-3xl border border-black/[0.02] flex flex-col gap-4 shadow-soft`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`bg-sage-light/40 p-3 rounded-2xl text-sage`}>
                            <span className="material-symbols-outlined text-[22px]">savings</span>
                        </div>
                        <div>
                            <p className="text-premium-charcoal font-serif font-semibold text-[15px]">{item.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`w-1.5 h-1.5 rounded-full bg-sage`}></span>
                                <p className="text-muted-taupe text-[10px] font-medium uppercase tracking-wide">Active</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-premium-charcoal font-serif font-bold text-lg">{formatAmount(item.val)}</p>
                        <p className="text-muted-taupe text-[10px]">Total Received</p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-zen-bg rounded-2xl p-3 flex flex-col items-center justify-center">
                        <span className="text-muted-taupe text-[10px] uppercase tracking-wider font-bold mb-1">Frequency</span>
                        <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-sage">repeat</span>
                            <span className="text-premium-charcoal font-semibold text-sm">{item.count}</span>
                        </div>
                    </div>
                    <div className="bg-zen-bg rounded-2xl p-3 flex flex-col items-center justify-center">
                        <span className="text-muted-taupe text-[10px] uppercase tracking-wider font-bold mb-1">Avg. Amount</span>
                         <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-sage">functions</span>
                            <span className="text-premium-charcoal font-semibold text-sm">{formatAmount(item.avg)}</span>
                        </div>
                    </div>
                </div>
              </div> 
          )) : (
              <div className="flex flex-col items-center py-8">
                <WallEMascot mood="thinking" message="Where's the income?" size="sm" />
                <p className="text-muted-taupe text-xs mt-3">No income sources found</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncomeInsights;