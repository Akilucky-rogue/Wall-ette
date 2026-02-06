import React, { useState, useMemo } from 'react';
import { AppScreen, Transaction, TransactionType } from '../types';
import { useWallet } from '../context/WalletContext';
import CurrencySelector from './CurrencySelector';
import { WallEMascot, WallEEyes, FloatingLeaf, VineDecoration, RangoliCorner, Paisley } from './SplashScreen';

interface TransactionHistoryProps {
  onNavigate: (screen: AppScreen) => void;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ onNavigate }) => {
  const { transactions, deleteTransaction, editTransaction, clearAllTransactions, formatAmount } = useWallet();
  const [activeType, setActiveType] = useState<'ALL' | TransactionType>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<'ALL' | '7_DAYS' | '30_DAYS' | '90_DAYS' | 'THIS_MONTH'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>('DATE_DESC');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  
  // Clear All Confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearInput, setClearInput] = useState('');

  // Edit Transaction State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState({
    merchant: '',
    amount: '',
    category: '',
    date: '',
    note: '',
    type: TransactionType.EXPENSE as TransactionType
  });
  const [editSaving, setEditSaving] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category));
    return ['ALL', ...Array.from(cats).sort()];
  }, [transactions]);

  // Get category stats for filter badges
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    transactions.forEach(t => {
      if (!stats[t.category]) stats[t.category] = { count: 0, total: 0 };
      stats[t.category].count++;
      stats[t.category].total += t.amount;
    });
    return stats;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Type Filter
      if (activeType !== 'ALL' && t.type !== activeType) return false;
      
      // Category Filter
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;

      // Date Filter
      if (dateFilter !== 'ALL') {
        const date = new Date(t.date);
        const now = new Date();
        
        if (dateFilter === 'THIS_MONTH') {
          if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return false;
        } else {
          const diffTime = Math.abs(now.getTime() - date.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          if (dateFilter === '7_DAYS' && diffDays > 7) return false;
          if (dateFilter === '30_DAYS' && diffDays > 30) return false;
          if (dateFilter === '90_DAYS' && diffDays > 90) return false;
        }
      }

      // Amount Range Filter
      const minAmt = parseFloat(minAmount);
      const maxAmt = parseFloat(maxAmount);
      if (!isNaN(minAmt) && t.amount < minAmt) return false;
      if (!isNaN(maxAmt) && t.amount > maxAmt) return false;

      return true;
    });
    
    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'DATE_ASC':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'AMOUNT_DESC':
          return b.amount - a.amount;
        case 'AMOUNT_ASC':
          return a.amount - b.amount;
        case 'DATE_DESC':
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });
  }, [transactions, activeType, dateFilter, categoryFilter, sortBy, minAmount, maxAmount]);

  // Group by date (Today, Yesterday, Date String)
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach(t => {
      const date = new Date(t.date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (date.toDateString() === today.toDateString()) key = 'Today';
      if (date.toDateString() === yesterday.toDateString()) key = 'Yesterday';

      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [filteredTransactions]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dateFilter !== 'ALL') count++;
    if (categoryFilter !== 'ALL') count++;
    if (minAmount || maxAmount) count++;
    if (sortBy !== 'DATE_DESC') count++;
    return count;
  }, [dateFilter, categoryFilter, minAmount, maxAmount, sortBy]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const clearFilters = () => {
    setActiveType('ALL');
    setDateFilter('ALL');
    setCategoryFilter('ALL');
    setSortBy('DATE_DESC');
    setMinAmount('');
    setMaxAmount('');
    setShowFilters(false);
  }

  const requestDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteId(id);
  }

  const confirmDelete = () => {
    if (deleteId) {
        deleteTransaction(deleteId);
        setDeleteId(null);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    }
  }
  
  const handleClearAll = async () => {
      if (clearInput.toUpperCase() === 'DELETE') {
          await clearAllTransactions();
          setShowClearConfirm(false);
          setClearInput('');
      }
  }

  const handleExportCSV = () => {
    const headers = ["Date", "Merchant", "Category", "Amount", "Type", "Note"];
    const csvContent = [
        headers.join(","),
        ...filteredTransactions.map(t => {
            const date = new Date(t.date).toLocaleDateString();
            const merchant = `"${(t.merchant || "").replace(/"/g, '""')}"`;
            const category = `"${t.category.replace(/"/g, '""')}"`;
            const amount = t.amount.toFixed(2);
            const type = t.type;
            const note = `"${(t.note || "").replace(/"/g, '""')}"`;
            return [date, merchant, category, amount, type, note].join(",");
        })
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `transactions_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  // Edit Transaction Handlers
  const openEditModal = (transaction: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTransaction(transaction);
    setEditForm({
      merchant: transaction.merchant || '',
      amount: transaction.amount.toString(),
      category: transaction.category,
      date: new Date(transaction.date).toISOString().split('T')[0],
      note: transaction.note || '',
      type: transaction.type
    });
  };

  const closeEditModal = () => {
    setEditingTransaction(null);
    setEditForm({
      merchant: '',
      amount: '',
      category: '',
      date: '',
      note: '',
      type: TransactionType.EXPENSE
    });
  };

  const handleEditSubmit = async () => {
    if (!editingTransaction) return;
    
    const amount = parseFloat(editForm.amount);
    if (isNaN(amount) || amount <= 0) return;
    
    setEditSaving(true);
    try {
      const updates: Partial<Transaction> = {
        merchant: editForm.merchant.trim(),
        amount: amount,
        category: editForm.category.trim() || 'Uncategorized',
        date: new Date(editForm.date).toISOString(),
        note: editForm.note.trim(),
        type: editForm.type
      };
      
      await editTransaction(editingTransaction.id, updates);
      closeEditModal();
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Failed to edit transaction:', error);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] mx-auto overflow-x-hidden pb-28 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-28 right-4 opacity-35 z-10" delay={0.8} />
      <FloatingLeaf className="top-60 left-3 opacity-25" delay={2.2} color="#A8B89E" />
      <VineDecoration className="absolute top-20 left-0 opacity-20" />
      <RangoliCorner className="absolute top-16 right-0 opacity-15" color="#C4A98E" mirror />
      <Paisley className="absolute bottom-36 right-4 opacity-20" />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zen-bg/90 backdrop-blur-xl px-6 pt-12 pb-4 border-b border-sage-border/20">
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => onNavigate(AppScreen.DASHBOARD)}
            className="w-10 h-10 flex items-center justify-start text-premium-charcoal hover:text-sage transition-colors"
          >
            <span className="material-symbols-outlined text-[28px]">chevron_left</span>
          </button>
          <h1 className="font-serif text-xl font-semibold tracking-tight">History</h1>
          <div className="flex items-center gap-1">
             <button 
                onClick={() => setShowClearConfirm(true)}
                className="w-10 h-10 flex items-center justify-center text-rose hover:bg-rose-light/20 rounded-full transition-colors"
                title="Clear All History"
             >
                <span className="material-symbols-outlined text-[24px]">delete_sweep</span>
             </button>
             <CurrencySelector />
             <button 
                onClick={handleExportCSV}
                className="w-10 h-10 flex items-center justify-center text-muted-taupe hover:text-sage transition-colors"
                title="Export CSV"
             >
                <span className="material-symbols-outlined text-[24px]">download</span>
             </button>
             <button 
                onClick={() => setShowFilters(true)}
                className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-colors ${activeFilterCount > 0 ? 'bg-sage text-white' : 'text-muted-taupe hover:text-sage hover:bg-sage-light/30'}`}
             >
                <span className="material-symbols-outlined text-[22px]">tune</span>
                {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                )}
             </button>
          </div>
        </div>
        
        {/* Quick Type Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button 
            onClick={() => setActiveType('ALL')}
            className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeType === 'ALL' ? 'bg-sage text-white shadow-sm' : 'bg-white border border-black/5 text-muted-taupe hover:bg-white/80'}`}
          >
            <span className="material-symbols-outlined text-[16px]">apps</span>
            All Activity
          </button>
          <button 
            onClick={() => setActiveType(TransactionType.INCOME)}
            className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeType === TransactionType.INCOME ? 'bg-sage text-white shadow-sm' : 'bg-white border border-black/5 text-muted-taupe hover:bg-white/80'}`}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
            Income
          </button>
          <button 
            onClick={() => setActiveType(TransactionType.EXPENSE)}
            className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeType === TransactionType.EXPENSE ? 'bg-rose/90 text-white shadow-sm' : 'bg-white border border-black/5 text-muted-taupe hover:bg-white/80'}`}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            Expenses
          </button>
        </div>
        
        {/* Active Filters Summary */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 pt-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-muted-taupe uppercase tracking-wider flex-shrink-0">Active:</span>
            {dateFilter !== 'ALL' && (
              <span className="px-2 py-1 bg-sage/10 text-sage text-[10px] font-medium rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                {dateFilter === '7_DAYS' ? '7 days' : dateFilter === '30_DAYS' ? '30 days' : dateFilter === '90_DAYS' ? '90 days' : 'This month'}
              </span>
            )}
            {categoryFilter !== 'ALL' && (
              <span className="px-2 py-1 bg-lavender/10 text-lavender text-[10px] font-medium rounded-full flex items-center gap-1 max-w-[100px] truncate">
                <span className="material-symbols-outlined text-[12px]">category</span>
                {categoryFilter}
              </span>
            )}
            {(minAmount || maxAmount) && (
              <span className="px-2 py-1 bg-ocean/10 text-ocean text-[10px] font-medium rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">payments</span>
                {minAmount && maxAmount ? `₹${minAmount}-${maxAmount}` : minAmount ? `≥₹${minAmount}` : `≤₹${maxAmount}`}
              </span>
            )}
            {sortBy !== 'DATE_DESC' && (
              <span className="px-2 py-1 bg-rose/10 text-rose text-[10px] font-medium rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">sort</span>
                {sortBy === 'DATE_ASC' ? 'Oldest' : sortBy === 'AMOUNT_DESC' ? 'Highest' : 'Lowest'}
              </span>
            )}
            <button onClick={clearFilters} className="text-[10px] text-rose font-bold ml-auto flex-shrink-0">Clear</button>
          </div>
        )}
      </header>

      {/* Filter Modal/Drawer */}
      {showFilters && (
        <>
            <div className="fixed inset-0 bg-premium-charcoal/30 z-40 backdrop-blur-sm" onClick={() => setShowFilters(false)}></div>
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[32px] shadow-2xl max-w-[430px] mx-auto animate-slide-up max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 pb-4 border-b border-black/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center">
                        <WallEEyes size="sm" />
                      </div>
                      <div>
                        <h3 className="font-serif text-lg font-semibold text-premium-charcoal">Filter & Sort</h3>
                        <p className="text-[10px] text-muted-taupe">{filteredTransactions.length} transactions match</p>
                      </div>
                    </div>
                    <button 
                      onClick={clearFilters} 
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose uppercase tracking-wider hover:bg-rose-light/20 rounded-full transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                      Reset
                    </button>
                </div>
                
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Time Period */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="material-symbols-outlined text-sage text-[18px]">calendar_month</span>
                          <p className="text-[11px] font-bold text-muted-taupe uppercase tracking-widest">Time Period</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: 'ALL', label: 'All Time', icon: 'all_inclusive' },
                              { value: 'THIS_MONTH', label: 'This Month', icon: 'today' },
                              { value: '7_DAYS', label: '7 Days', icon: 'date_range' },
                              { value: '30_DAYS', label: '30 Days', icon: 'calendar_view_month' },
                              { value: '90_DAYS', label: '90 Days', icon: 'calendar_view_week' },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setDateFilter(opt.value as any)}
                                    className={`flex flex-col items-center gap-1 p-3 rounded-2xl text-xs font-medium border transition-all ${
                                      dateFilter === opt.value 
                                        ? 'bg-sage text-white border-sage shadow-md' 
                                        : 'bg-zen-bg text-premium-charcoal border-transparent hover:border-sage/30'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[20px]">{opt.icon}</span>
                                    <span className="text-[10px]">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sort By */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="material-symbols-outlined text-lavender text-[18px]">sort</span>
                          <p className="text-[11px] font-bold text-muted-taupe uppercase tracking-widest">Sort By</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'DATE_DESC', label: 'Newest First', icon: 'arrow_downward' },
                              { value: 'DATE_ASC', label: 'Oldest First', icon: 'arrow_upward' },
                              { value: 'AMOUNT_DESC', label: 'Highest Amount', icon: 'trending_up' },
                              { value: 'AMOUNT_ASC', label: 'Lowest Amount', icon: 'trending_down' },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSortBy(opt.value as any)}
                                    className={`flex items-center gap-2 p-3 rounded-2xl text-xs font-medium border transition-all ${
                                      sortBy === opt.value 
                                        ? 'bg-lavender text-white border-lavender shadow-md' 
                                        : 'bg-zen-bg text-premium-charcoal border-transparent hover:border-lavender/30'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">{opt.icon}</span>
                                    <span>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Amount Range */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="material-symbols-outlined text-ocean text-[18px]">payments</span>
                          <p className="text-[11px] font-bold text-muted-taupe uppercase tracking-widest">Amount Range</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-1">
                              <label className="text-[10px] text-muted-taupe mb-1 block">Min Amount</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-taupe text-sm">₹</span>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={minAmount}
                                    onChange={(e) => setMinAmount(e.target.value)}
                                    className="w-full bg-zen-bg rounded-xl pl-7 pr-3 py-3 text-sm text-premium-charcoal outline-none focus:ring-1 focus:ring-ocean border border-transparent focus:border-ocean/30"
                                />
                              </div>
                            </div>
                            <div className="flex items-end pb-3 text-muted-taupe">—</div>
                            <div className="flex-1">
                              <label className="text-[10px] text-muted-taupe mb-1 block">Max Amount</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-taupe text-sm">₹</span>
                                <input
                                    type="number"
                                    placeholder="∞"
                                    value={maxAmount}
                                    onChange={(e) => setMaxAmount(e.target.value)}
                                    className="w-full bg-zen-bg rounded-xl pl-7 pr-3 py-3 text-sm text-premium-charcoal outline-none focus:ring-1 focus:ring-ocean border border-transparent focus:border-ocean/30"
                                />
                              </div>
                            </div>
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose text-[18px]">category</span>
                            <p className="text-[11px] font-bold text-muted-taupe uppercase tracking-widest">Category</p>
                          </div>
                          <span className="text-[10px] text-muted-taupe">{categories.length - 1} categories</span>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto">
                            {categories.map((cat) => {
                                const stats = categoryStats[cat];
                                return (
                                  <button
                                      key={cat}
                                      onClick={() => setCategoryFilter(cat)}
                                      className={`px-3 py-2 rounded-2xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                        categoryFilter === cat 
                                          ? 'bg-rose text-white border-rose shadow-md' 
                                          : 'bg-zen-bg text-premium-charcoal border-transparent hover:border-rose/30'
                                      }`}
                                  >
                                      {cat === 'ALL' ? (
                                        <span className="material-symbols-outlined text-[14px]">select_all</span>
                                      ) : null}
                                      <span>{cat === 'ALL' ? 'All Categories' : cat}</span>
                                      {cat !== 'ALL' && stats && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                          categoryFilter === cat ? 'bg-white/20' : 'bg-black/5'
                                        }`}>
                                          {stats.count}
                                        </span>
                                      )}
                                  </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-4 border-t border-black/5 bg-white">
                    <button 
                        onClick={() => setShowFilters(false)}
                        className="w-full bg-premium-charcoal text-white py-4 rounded-3xl font-serif text-lg font-medium active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">check</span>
                        Show {filteredTransactions.length} Results
                    </button>
                </div>
            </div>
        </>
      )}

      {/* List */}
      <main className="px-6 space-y-6 mt-4">
        {Object.entries(groupedTransactions).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
                <WallEMascot 
                  mood="thinking" 
                  message="Nothing here yet..."
                  size="md"
                />
                <p className="mt-4 text-muted-taupe text-sm">No transactions match your filters</p>
                <button 
                  onClick={clearFilters}
                  className="mt-3 text-sage text-xs font-semibold hover:underline"
                >
                  Clear all filters
                </button>
            </div>
        ) : (
            Object.entries(groupedTransactions).map(([dateLabel, groupTxs]: [string, Transaction[]]) => (
            <section key={dateLabel}>
                <h3 className="text-muted-taupe text-[11px] font-medium uppercase tracking-[0.2em] mb-4 pl-1">{dateLabel}</h3>
                <div className="space-y-3">
                {groupTxs.map(t => (
                    <div 
                        key={t.id} 
                        onClick={() => toggleExpand(t.id)}
                        className={`bg-white rounded-3xl shadow-soft border border-black/[0.02] overflow-hidden transition-all duration-300 ${expandedId === t.id ? 'ring-1 ring-sage/30' : 'active:scale-[0.98]'}`}
                    >
                        {/* Main Row */}
                        <div className="p-4 flex items-center justify-between cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${t.type === TransactionType.EXPENSE ? 'bg-rose-light text-rose' : 'bg-sage-light text-sage'}`}>
                                <span className="material-symbols-outlined text-[22px]">
                                    {getIconForCategory(t.category)}
                                </span>
                                </div>
                                <div>
                                <p className="font-serif font-semibold text-[15px] text-premium-charcoal">{t.merchant || "Unknown Merchant"}</p>
                                <p className="text-[11px] text-muted-taupe uppercase tracking-wider">{t.category}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`font-serif font-bold ${t.type === TransactionType.EXPENSE ? 'text-rose' : 'text-sage'}`}>
                                {t.type === TransactionType.EXPENSE ? '-' : '+'}{formatAmount(t.amount)}
                                </p>
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedId === t.id && (
                            <div className="px-4 pb-4 pt-0 bg-white">
                                <div className="pt-4 border-t border-dashed border-gray-100 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] text-muted-taupe font-bold uppercase tracking-wider mb-1">Note</p>
                                            <p className="text-[13px] text-premium-charcoal font-serif italic">{t.note || "No notes added."}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-1">
                                         <div>
                                            <p className="text-[10px] text-muted-taupe font-bold uppercase tracking-wider mb-1">Time</p>
                                            <p className="text-[13px] text-premium-charcoal">{new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={(e) => openEditModal(t, e)}
                                                className="text-[10px] bg-sage-light text-sage px-3 py-1.5 rounded-full font-bold uppercase tracking-wider hover:bg-sage/20 transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={(e) => requestDelete(t.id, e)}
                                                className="text-[10px] bg-rose-light text-rose px-3 py-1.5 rounded-full font-bold uppercase tracking-wider hover:bg-rose/20 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                </div>
            </section>
            ))
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-premium-charcoal/20 backdrop-blur-sm" onClick={() => setDeleteId(null)}>
            <div className="bg-white rounded-[32px] p-6 w-full max-w-[320px] shadow-2xl border border-white/50 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-rose-light text-rose rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-[24px]">delete</span>
                    </div>
                    <h3 className="text-premium-charcoal font-serif text-xl font-semibold mb-2">Delete Transaction?</h3>
                    <p className="text-muted-taupe text-xs mb-6 leading-relaxed">
                        This action cannot be undone. The transaction will be permanently removed.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteId(null)}
                            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold bg-white border border-black/5 text-premium-charcoal hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold bg-rose text-white shadow-soft hover:bg-rose/90 transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rose/10 backdrop-blur-md">
            <div className="bg-white rounded-[32px] p-6 w-full max-w-[320px] shadow-2xl border-2 border-rose/20 animate-slide-up">
                <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-rose-light text-rose rounded-full flex items-center justify-center mb-4 animate-pulse">
                        <span className="material-symbols-outlined text-[32px]">warning</span>
                    </div>
                    <h3 className="text-rose font-serif text-xl font-bold mb-2">Clear All History?</h3>
                    <p className="text-premium-charcoal text-xs mb-4 leading-relaxed font-medium">
                        This will permanently delete <span className="underline decoration-rose">ALL</span> transactions. This action is irreversible.
                    </p>
                    
                    <p className="text-[10px] text-muted-taupe uppercase tracking-widest mb-2">Type "DELETE" to confirm</p>
                    <input 
                        type="text" 
                        value={clearInput}
                        onChange={(e) => setClearInput(e.target.value)}
                        className="w-full bg-zen-bg border border-rose/20 rounded-xl px-4 py-3 text-center text-sm font-bold text-rose outline-none focus:ring-2 focus:ring-rose/30 mb-6 uppercase"
                        placeholder="DELETE"
                    />

                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => { setShowClearConfirm(false); setClearInput(''); }}
                            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold bg-white border border-black/5 text-premium-charcoal hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleClearAll}
                            disabled={clearInput.toUpperCase() !== 'DELETE'}
                            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold bg-rose text-white shadow-soft hover:bg-rose/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Clear All
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-premium-charcoal/20 backdrop-blur-sm" onClick={closeEditModal}>
            <div className="bg-white rounded-[32px] p-6 w-full max-w-[380px] shadow-2xl border border-white/50 animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-sage-light text-sage rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-[24px]">edit</span>
                            </div>
                            <h3 className="text-premium-charcoal font-serif text-xl font-semibold">Edit Transaction</h3>
                        </div>
                        <button onClick={closeEditModal} className="text-muted-taupe hover:text-premium-charcoal">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Transaction Type Toggle */}
                    <div className="mb-4">
                        <label className="text-[11px] text-muted-taupe font-bold uppercase tracking-wider mb-2 block">Type</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setEditForm(prev => ({ ...prev, type: TransactionType.EXPENSE }))}
                                className={`flex-1 py-3 rounded-2xl text-[13px] font-semibold transition-all ${
                                    editForm.type === TransactionType.EXPENSE 
                                        ? 'bg-rose text-white' 
                                        : 'bg-white border border-black/5 text-muted-taupe hover:bg-gray-50'
                                }`}
                            >
                                Expense
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditForm(prev => ({ ...prev, type: TransactionType.INCOME }))}
                                className={`flex-1 py-3 rounded-2xl text-[13px] font-semibold transition-all ${
                                    editForm.type === TransactionType.INCOME 
                                        ? 'bg-sage text-white' 
                                        : 'bg-white border border-black/5 text-muted-taupe hover:bg-gray-50'
                                }`}
                            >
                                Income
                            </button>
                        </div>
                    </div>

                    {/* Merchant */}
                    <div className="mb-4">
                        <label className="text-[11px] text-muted-taupe font-bold uppercase tracking-wider mb-2 block">Merchant / Description</label>
                        <input
                            type="text"
                            value={editForm.merchant}
                            onChange={(e) => setEditForm(prev => ({ ...prev, merchant: e.target.value }))}
                            placeholder="Enter merchant name"
                            className="w-full px-4 py-3 rounded-2xl border border-black/5 bg-white text-[14px] text-premium-charcoal placeholder:text-muted-taupe/50 focus:outline-none focus:ring-2 focus:ring-sage/30"
                        />
                    </div>

                    {/* Amount */}
                    <div className="mb-4">
                        <label className="text-[11px] text-muted-taupe font-bold uppercase tracking-wider mb-2 block">Amount</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editForm.amount}
                            onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0.00"
                            className="w-full px-4 py-3 rounded-2xl border border-black/5 bg-white text-[14px] text-premium-charcoal placeholder:text-muted-taupe/50 focus:outline-none focus:ring-2 focus:ring-sage/30"
                        />
                    </div>

                    {/* Category */}
                    <div className="mb-4">
                        <label className="text-[11px] text-muted-taupe font-bold uppercase tracking-wider mb-2 block">Category</label>
                        <select
                            value={editForm.category}
                            onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full px-4 py-3 rounded-2xl border border-black/5 bg-white text-[14px] text-premium-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 appearance-none cursor-pointer"
                        >
                            {categories.filter(c => c !== 'ALL').map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value="Uncategorized">Uncategorized</option>
                        </select>
                    </div>

                    {/* Date */}
                    <div className="mb-4">
                        <label className="text-[11px] text-muted-taupe font-bold uppercase tracking-wider mb-2 block">Date</label>
                        <input
                            type="date"
                            value={editForm.date}
                            onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full px-4 py-3 rounded-2xl border border-black/5 bg-white text-[14px] text-premium-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                        />
                    </div>

                    {/* Note */}
                    <div className="mb-6">
                        <label className="text-[11px] text-muted-taupe font-bold uppercase tracking-wider mb-2 block">Note</label>
                        <textarea
                            value={editForm.note}
                            onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                            placeholder="Add a note (optional)"
                            rows={2}
                            className="w-full px-4 py-3 rounded-2xl border border-black/5 bg-white text-[14px] text-premium-charcoal placeholder:text-muted-taupe/50 focus:outline-none focus:ring-2 focus:ring-sage/30 resize-none"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button 
                            onClick={closeEditModal}
                            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold bg-white border border-black/5 text-premium-charcoal hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleEditSubmit}
                            disabled={editSaving || !editForm.amount || parseFloat(editForm.amount) <= 0}
                            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold bg-sage text-white shadow-soft hover:bg-sage/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {editSaving ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Success Toast */}
      {showToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-premium-charcoal text-white px-6 py-3 rounded-full shadow-xl z-50 animate-slide-up flex items-center gap-2">
              <span className="material-symbols-outlined text-sage text-[20px]">check_circle</span>
              <span className="text-[13px] font-medium font-serif">Transaction updated</span>
          </div>
      )}
    </div>
  );
};

const getIconForCategory = (category: string) => {
    const normalize = category.toLowerCase().trim();

    // Standard Application Categories
    if (normalize === 'groceries') return 'shopping_basket';
    if (normalize === 'transport') return 'commute';
    if (normalize === 'housing') return 'home';
    if (normalize === 'dining') return 'restaurant';
    if (normalize === 'health') return 'medical_services';
    if (normalize === 'entertainment') return 'movie';
    if (normalize === 'salary') return 'work';
    if (normalize === 'freelance') return 'laptop_mac';
    if (normalize === 'investment') return 'trending_up';
    
    // Derived/Broad Categories (for imported/inferred data)
    if (normalize.includes('shop') || normalize.includes('store')) return 'shopping_bag';
    if (normalize.includes('food') || normalize.includes('eat')) return 'fastfood';
    if (normalize.includes('coffee') || normalize.includes('cafe')) return 'coffee';
    if (normalize.includes('bill') || normalize.includes('utility') || normalize.includes('electric')) return 'receipt';
    if (normalize.includes('school') || normalize.includes('edu')) return 'school';
    if (normalize.includes('gym') || normalize.includes('fitness')) return 'fitness_center';
    if (normalize.includes('travel') || normalize.includes('flight')) return 'flight';
    if (normalize.includes('car') || normalize.includes('fuel')) return 'directions_car';
    if (normalize.includes('tech') || normalize.includes('app')) return 'smartphone';
    if (normalize.includes('pet')) return 'pets';
    if (normalize.includes('gift')) return 'card_giftcard';

    return 'category'; // Default fallback
}

export default TransactionHistory;