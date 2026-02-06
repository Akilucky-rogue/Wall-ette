import React, { useMemo, useState, useRef, useEffect } from 'react';
import { AppScreen, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import CurrencySelector from './CurrencySelector';
import { WallEEyes, FloatingLeaf, LotusFlower, Sprout, RangoliCorner, Diya } from './SplashScreen';

interface DashboardProps {
  onNavigate: (screen: AppScreen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { getBalance, getMonthlyIncome, getMonthlyExpense, getTotalIncome, getTotalExpense, transactions, formatAmount, isCloudSyncing, retryCloudConnection } = useWallet();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllTime, setShowAllTime] = useState(true); // Default to All Time
  const notificationRef = useRef<HTMLDivElement>(null);
  
  // Use useMemo to ensure calculations are updated when transactions change
  const balance = useMemo(() => getBalance(), [transactions]);
  const monthlyIncome = useMemo(() => getMonthlyIncome(), [transactions]);
  const monthlyExpenses = useMemo(() => getMonthlyExpense(), [transactions]);
  const totalIncome = useMemo(() => getTotalIncome(), [transactions]);
  const totalExpenses = useMemo(() => getTotalExpense(), [transactions]);
  
  // Check if we have any monthly data
  const hasMonthlyData = monthlyIncome > 0 || monthlyExpenses > 0;
  const togglePeriod = () => setShowAllTime(prev => !prev);
  
  // Display values based on toggle
  const income = showAllTime ? totalIncome : monthlyIncome;
  const expenses = showAllTime ? totalExpenses : monthlyExpenses;
  const periodLabel = showAllTime ? 'All Time' : 'This Month';

  // Debug logging
  useEffect(() => {
    console.log('Dashboard Debug:', {
      totalTransactions: transactions.length,
      balance,
      monthlyIncome,
      monthlyExpenses,
      totalIncome,
      totalExpenses,
      showAllTime,
      hasMonthlyData,
      sampleTransactions: transactions.slice(0, 3).map(t => ({
        date: t.date,
        type: t.type,
        amount: t.amount,
        category: t.category
      }))
    });
  }, [transactions, balance, monthlyIncome, monthlyExpenses, totalIncome, totalExpenses, showAllTime, hasMonthlyData]);

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

  // Aggregate Top Income Categories for the "Income Streams" section
  const incomeStreams = useMemo(() => {
    const streams: Record<string, number> = {};
    transactions
      .filter(t => t.type === TransactionType.INCOME)
      .forEach(t => {
        streams[t.category] = (streams[t.category] || 0) + t.amount;
      });
    
    // Convert to array and sort
    return Object.entries(streams)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3) // Top 3
      .map(([name, amount]) => ({ name, amount }));
  }, [transactions]);

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
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        {/* WALL-E Logo with plant accent */}
        <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center shadow-md">
          <WallEEyes size="sm" />
          {/* Mini sprout instead of coin */}
          <div className="absolute -top-1 -right-1 w-4 h-4">
            <Sprout size="sm" />
          </div>
          {/* Mini coin */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-400 flex items-center justify-center border border-white shadow-sm">
            <span className="text-amber-700 text-[6px] font-bold">₹</span>
          </div>
        </div>
        
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

      {/* Balance */}
      <div className="flex flex-col items-center py-10 relative">
        {/* Decorative lotus */}
        <div className="absolute top-6 left-8">
          <LotusFlower size="sm" color="#E8A5A5" className="opacity-40" />
        </div>
        <div className="absolute top-8 right-10">
          <LotusFlower size="sm" color="#D4B896" className="opacity-30" />
        </div>
        
        <p className="text-muted-taupe text-xs font-medium uppercase tracking-[0.2em] mb-2">Portfolio Balance</p>
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

      {/* Income/Expense Summary */}
      <div className="grid grid-cols-2 gap-4 px-6 py-2">
        <button 
          onClick={togglePeriod}
          className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-soft border border-black/[0.02] text-left active:scale-95 transition-transform"
        >
          <div className="text-sage bg-sage-light w-9 h-9 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">add</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-premium-charcoal text-lg font-serif font-bold tracking-tight">+{formatAmount(income)}</h2>
            <p className="text-muted-taupe text-[11px] font-medium uppercase tracking-wider">Income ({periodLabel})</p>
          </div>
        </button>
        <button 
          onClick={togglePeriod}
          className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-soft border border-black/[0.02] text-left active:scale-95 transition-transform"
        >
          <div className="text-rose bg-rose-light w-9 h-9 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">remove</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-premium-charcoal text-lg font-serif font-bold tracking-tight">-{formatAmount(expenses)}</h2>
            <p className="text-muted-taupe text-[11px] font-medium uppercase tracking-wider">Expenses ({periodLabel})</p>
          </div>
        </button>
      </div>

      {!showAllTime && !hasMonthlyData && (
        <div className="px-6 mt-2">
          <div className="text-center text-rose text-[11px] font-medium">
            No transactions found for the current month. Toggle to All Time to see imported data.
          </div>
        </div>
      )}

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

      {/* Income Streams */}
      <div className="px-6 py-2">
        <div className="flex justify-between items-end mb-6">
          <h3 className="text-premium-charcoal text-[15px] font-serif font-semibold tracking-tight">Top Income Categories</h3>
          <button 
            onClick={() => onNavigate(AppScreen.INCOME_INSIGHTS)}
            className="text-sage text-xs font-semibold tracking-wide hover:underline cursor-pointer transition-colors"
          >
            View History
          </button>
        </div>
        <div className="space-y-4">
          {incomeStreams.length > 0 ? incomeStreams.map((stream, idx) => (
            <div key={idx} className="bg-white p-5 rounded-3xl border border-black/[0.02] flex items-center justify-between shadow-soft">
              <div className="flex items-center gap-4">
                <div className="bg-[#F2F4F8] p-2.5 rounded-2xl text-slate-400">
                  <span className="material-symbols-outlined text-[20px]">{getIconForCategory(stream.name)}</span>
                </div>
                <div>
                  <p className="text-premium-charcoal font-serif font-semibold text-[15px]">{stream.name}</p>
                  <p className="text-muted-taupe text-[10px] font-medium uppercase tracking-wide">Variable Source</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sage font-serif font-bold text-base">{formatAmount(stream.amount)}</p>
                <div className="w-12 h-0.5 bg-sage-light rounded-full mt-1.5 ml-auto overflow-hidden">
                  <div className="bg-sage h-full w-[100%]"></div>
                </div>
              </div>
            </div>
          )) : (
            <div className="flex flex-col items-center py-8">
              {/* Mini WALL-E for empty state */}
              <div className="w-12 h-12 rounded-full bg-sage/20 flex items-center justify-center mb-3">
                <WallEEyes size="sm" expression="sleepy" />
              </div>
              <p className="text-muted-taupe text-xs italic">No income data recorded yet</p>
              <p className="text-[10px] text-muted-taupe/60 mt-1">Import a statement to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Mindful Reminders */}
      <div className="px-6 py-8">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-premium-charcoal text-[15px] font-serif font-semibold tracking-tight">Mindful Reminders</h3>
          <Diya className="opacity-60" />
        </div>
        <div className="relative bg-white rounded-3xl border-l-[6px] border-sage p-5 shadow-soft overflow-hidden">
          {/* Rangoli corner accent */}
          <RangoliCorner className="absolute -top-2 -right-2 opacity-20" color="#8B9E82" mirror />
          <div className="flex gap-4">
            <div className="text-sage">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
            </div>
            <div>
              <p className="text-premium-charcoal text-[14px] font-serif font-semibold mb-1">Financial Health</p>
              <p className="text-muted-taupe text-xs leading-relaxed">
                {balance > 0 ? "You are maintaining a positive balance. Keep nurturing your savings." : "Your balance is low. Review your recent expenses for peace of mind."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;