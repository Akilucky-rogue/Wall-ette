import React, { useMemo, useState, useEffect } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import { WallEMascot, FloatingLeaf, MandalaDots, RangoliCorner, Paisley } from './SplashScreen';

interface CategorySplitProps {
  onNavigate: (screen: AppScreen) => void;
}

type TimeRange = 'WEEK' | 'MONTH' | 'YEAR';

const CategorySplit: React.FC<CategorySplitProps> = ({ onNavigate }) => {
  const { transactions, formatAmount } = useWallet();
  const [timeRange, setTimeRange] = useState<TimeRange>('MONTH');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Auto-detect the month with most recent transactions
  const latestTxDate = useMemo(() => {
    if (transactions.length === 0) return new Date();
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return new Date(sorted[0].date);
  }, [transactions]);

  const [selectedDate, setSelectedDate] = useState(latestTxDate);
  
  useEffect(() => {
    setSelectedDate(latestTxDate);
  }, [latestTxDate]);

  // Filter transactions based on time range
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.type !== TransactionType.EXPENSE) return false;
      const txDate = new Date(t.date);
      
      if (timeRange === 'WEEK') {
        // Get start of week (Sunday) for selected date
        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return txDate >= startOfWeek && txDate < endOfWeek;
      } else if (timeRange === 'MONTH') {
        return txDate.getMonth() === selectedDate.getMonth() && 
               txDate.getFullYear() === selectedDate.getFullYear();
      } else {
        // YEAR
        return txDate.getFullYear() === selectedDate.getFullYear();
      }
    });
  }, [transactions, selectedDate, timeRange]);

  const totalExpenses = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

  const { categories, gradientString } = useMemo(() => {
    const cats: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      cats[t.category] = (cats[t.category] || 0) + t.amount;
    });
    
    const sorted = Object.entries(cats).sort(([, a], [, b]) => b - a);
    const colors = ["#9BAE93", "#D4A5A5", "#B8B5D0", "#9CB5C1", "#D6C6B2", "#E8C1A0", "#AED5D5", "#C5B8D9"]; 
    const colorNames = ["sage", "rose", "lavender", "ocean", "sand", "peach", "teal", "purple"];
    
    let currentDeg = 0;
    let gradientParts: string[] = [];

    const mapped = sorted.map(([name, val], index) => {
      const percent = totalExpenses > 0 ? (val / totalExpenses) : 0;
      const deg = percent * 360;
      const colorHex = colors[index % colors.length];
      const colorName = colorNames[index % colorNames.length];
      
      gradientParts.push(`${colorHex} ${currentDeg}deg ${currentDeg + deg}deg`);
      currentDeg += deg;

      return { 
        name, 
        val, 
        color: colorName,
        colorHex,
        percent: Math.round(percent * 100),
        txCount: filteredTransactions.filter(t => t.category === name).length
      };
    });

    const finalGradient = gradientParts.length > 0 
      ? `conic-gradient(${gradientParts.join(', ')})`
      : `conic-gradient(#D6C6B2 0deg 360deg)`;

    return { categories: mapped, gradientString: finalGradient };
  }, [filteredTransactions, totalExpenses]);

  const handleMonthChange = (offset: number) => {
    const newDate = new Date(selectedDate);
    if (timeRange === 'YEAR') {
      newDate.setFullYear(newDate.getFullYear() + offset);
    } else {
      newDate.setMonth(newDate.getMonth() + offset);
    }
    setSelectedDate(newDate);
  };

  const getIcon = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes('food') || lower.includes('dining') || lower.includes('restaurant')) return 'restaurant';
    if (lower.includes('grocer')) return 'local_grocery_store';
    if (lower.includes('transport') || lower.includes('uber') || lower.includes('ola') || lower.includes('fuel')) return 'commute';
    if (lower.includes('shop') || lower.includes('amazon') || lower.includes('flipkart')) return 'shopping_bag';
    if (lower.includes('transfer') || lower.includes('upi')) return 'swap_horiz';
    if (lower.includes('atm') || lower.includes('cash')) return 'atm';
    if (lower.includes('bill') || lower.includes('utility') || lower.includes('electric')) return 'receipt_long';
    if (lower.includes('health') || lower.includes('medical') || lower.includes('pharma')) return 'medication';
    if (lower.includes('entertainment') || lower.includes('movie') || lower.includes('netflix')) return 'movie';
    if (lower.includes('education') || lower.includes('book') || lower.includes('course')) return 'school';
    if (lower.includes('rent') || lower.includes('emi') || lower.includes('loan')) return 'home';
    if (lower.includes('invest') || lower.includes('mutual')) return 'trending_up';
    if (lower.includes('insurance')) return 'shield';
    if (lower.includes('subscription')) return 'subscriptions';
    if (lower.includes('travel') || lower.includes('flight') || lower.includes('hotel')) return 'flight';
    if (lower.includes('recharge') || lower.includes('mobile')) return 'smartphone';
    return 'category';
  };

  const getTimeRangeLabel = () => {
    if (timeRange === 'WEEK') {
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else if (timeRange === 'MONTH') {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      return selectedDate.getFullYear().toString();
    }
  };

  // Color mapping for Tailwind classes
  const getColorClasses = (colorName: string, colorHex: string) => {
    const colorMap: Record<string, { bg: string; text: string }> = {
      sage: { bg: 'bg-sage-light', text: 'text-sage' },
      rose: { bg: 'bg-rose-light', text: 'text-rose' },
      lavender: { bg: 'bg-lavender-light', text: 'text-lavender' },
      ocean: { bg: 'bg-ocean-light', text: 'text-ocean' },
      sand: { bg: 'bg-sand-light', text: 'text-sand' },
    };
    return colorMap[colorName] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-5 opacity-35" delay={0.7} />
      <FloatingLeaf className="top-60 left-3 opacity-25" delay={2} color="#A8B89E" />
      <MandalaDots className="absolute top-36 left-4 opacity-20" />
      <RangoliCorner className="absolute top-20 right-2 opacity-20" color="#C4A98E" mirror />
      <Paisley className="absolute bottom-36 left-6 opacity-25" flip />
      
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
            <div className="absolute top-12 right-0 bg-white rounded-2xl shadow-xl border border-black/5 p-4 z-[60] animate-slide-up w-48">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => handleMonthChange(-1)} className="p-1 text-muted-taupe hover:text-sage">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <span className="font-serif font-bold text-premium-charcoal text-sm">
                  {timeRange === 'YEAR' 
                    ? selectedDate.getFullYear()
                    : selectedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  }
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

      {/* Pie Chart */}
      <div className="flex flex-col items-center py-8 px-6">
        <div 
          className="relative w-[200px] h-[200px] rounded-full shadow-lg flex items-center justify-center transition-all duration-500" 
          style={{ background: gradientString }}
        >
          <div className="w-[140px] h-[140px] bg-zen-bg rounded-full flex flex-col items-center justify-center shadow-inner">
            <span className="text-muted-taupe text-[9px] font-medium uppercase tracking-[0.15em]">Expenses</span>
            <span className="text-premium-charcoal font-serif text-2xl font-bold">{formatAmount(totalExpenses).split('.')[0]}</span>
            <span className="text-rose text-[10px] font-semibold mt-0.5">{getTimeRangeLabel()}</span>
          </div>
        </div>
        
        {/* Transaction count */}
        <p className="text-muted-taupe text-[11px] mt-4">
          {filteredTransactions.length} transactions • {categories.length} categories
        </p>
      </div>

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

      {/* Legend */}
      {categories.length > 0 && (
        <div className="px-6 mb-4">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-full border border-black/5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.colorHex }} />
                <span className="text-[10px] text-premium-charcoal font-medium">{item.name}</span>
                <span className="text-[9px] text-muted-taupe">{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="px-6 space-y-3 pb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-premium-charcoal text-[15px] font-serif font-semibold tracking-tight">All Categories</h3>
          <span className="text-[10px] text-muted-taupe">{categories.length} total</span>
        </div>
        
        {categories.length > 0 ? categories.map((item, i) => {
          const colors = getColorClasses(item.color, item.colorHex);
          return (
            <div key={i} className="bg-white p-4 rounded-3xl border border-black/[0.02] flex items-center justify-between shadow-soft">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2.5 rounded-2xl"
                  style={{ backgroundColor: `${item.colorHex}20`, color: item.colorHex }}
                >
                  <span className="material-symbols-outlined text-[20px]">{getIcon(item.name)}</span>
                </div>
                <div>
                  <p className="text-premium-charcoal font-serif font-semibold text-[14px]">{item.name}</p>
                  <p className="text-muted-taupe text-[10px] font-medium">
                    {item.txCount} transaction{item.txCount !== 1 ? 's' : ''} • {item.percent}%
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-premium-charcoal font-serif font-bold text-[15px]">{formatAmount(item.val)}</p>
              </div>
            </div>
          );
        }) : (
          <div className="flex flex-col items-center py-12">
            <WallEMascot mood="sad" message="No expenses here..." size="md" />
            <p className="text-muted-taupe text-sm mt-4">No expenses for this period</p>
            <p className="text-muted-taupe/70 text-xs mt-1">Try selecting a different time range</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategorySplit;
