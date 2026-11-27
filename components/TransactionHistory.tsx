import React, { useState, useMemo } from 'react';
import { AppScreen, Transaction, TransactionType, categoryOptions } from '../types';
import { useWallet } from '../context/WalletContext';
import { getSymbol, inputDigits, toBase, toShown } from '../utils/currencyUtils';
import { addDays, byNewest, isDay, localDay, parseDay, toDay } from '../utils/dates';
import { MOVED_LABELS } from '../services/spend';
import { bankWords } from '../services/narration';
import { Mascot } from './ui/Brand';
import { prettyMerchant } from '../services/analyticsService';
import { paymentRail } from '../utils/names';
import DuplicateEntries from './DuplicateEntries';
import WalletArriving from './WalletArriving';
import { removed } from '../utils/haptics';
import { useBackHandler } from '../utils/backStack';
import { accountSummaries, entryAccount, legacyAccount } from '../services/accounts';
import { takeVaultAccount } from '../utils/vaultAccount';
import { viaName } from '../services/paymentAlerts';
import { bankReference } from '../services/statementImport';

// The list draws this many entries at a time, and the next lot on request:
// thousands of rows at once made Vault slow to open and to scroll. The
// totals, the count and the CSV export still cover every match.
const PAGE = 100;

interface TransactionHistoryProps {
  onNavigate: (screen: AppScreen) => void;
}

// The time an entry was added, when it was added on the day it is dated.
// Imported rows and back-dated entries have no time of their own.
const entryTime = (t: Transaction): string | null =>
  t.createdAt && toDay(t.createdAt) === t.date
    ? new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ onNavigate }) => {
  const { transactions, flowOf, deleteTransaction, editTransaction, clearAllTransactions, formatAmount, formatAmountCompact, formatEntry, shownRate, shownCurrency, walletLoaded, isOnline, accounts, unassignedOpening } = useWallet();
  // A saved amount as the edit box and the amount filter see it: as typed
  // when typed in the currency shown, else converted, to the decimals that
  // currency can hold.
  const shownOf = (t: Transaction): number =>
    t.typedCurrency === shownCurrency && typeof t.typedAmount === 'number'
      ? t.typedAmount
      : toShown(t.amount, shownRate, inputDigits(shownCurrency, shownRate));
  // Amounts typed here (filters, edits) are in the currency shown; saved amounts are rupees.
  const symbol = getSymbol(shownCurrency);
  const [activeType, setActiveType] = useState<'ALL' | TransactionType>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<'ALL' | '7_DAYS' | '30_DAYS' | '90_DAYS' | 'THIS_MONTH'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  // One bank account's entries (services/accounts.ts), or 'ALL'.
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  // Opened from Bank accounts: just that account's entries.
  React.useEffect(() => {
    const key = takeVaultAccount();
    if (key) setAccountFilter(key);
  }, []);
  // The accounts to filter by, once there's more than one place entries are.
  const accountChoices = useMemo(() => {
    const { accounts: list, other } = accountSummaries(transactions, accounts, unassignedOpening);
    const all = other ? [...list, other] : list;
    return all.length > 1 || accountFilter !== 'ALL' ? all : [];
  }, [transactions, accounts, unassignedOpening, accountFilter]);
  const legacy = useMemo(() => legacyAccount(accounts), [accounts]);
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>('DATE_DESC');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('Transaction updated');
  
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
    const q = searchQuery.trim().toLowerCase();
    const today = localDay();
    const filtered = transactions.filter(t => {
      // Search filter
      if (q) {
        const inMerchant = (t.merchant || '').toLowerCase().includes(q);
        const inCategory = t.category.toLowerCase().includes(q);
        const inNote = (t.note || '').toLowerCase().includes(q);
        const inAmount = String(t.amount).includes(q) || String(shownOf(t)).includes(q);
        if (!inMerchant && !inCategory && !inNote && !inAmount) return false;
      }
      // Type Filter
      if (activeType !== 'ALL' && t.type !== activeType) return false;
      
      // Category Filter
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;

      // Account Filter
      if (accountFilter !== 'ALL' && entryAccount(t, legacy) !== accountFilter) return false;

      // Date Filter: this month, or the last N days counting today
      if (dateFilter === 'THIS_MONTH') {
        if (t.date.slice(0, 7) !== today.slice(0, 7)) return false;
      } else if (dateFilter !== 'ALL') {
        const days = dateFilter === '7_DAYS' ? 7 : dateFilter === '30_DAYS' ? 30 : 90;
        if (t.date < addDays(today, 1 - days)) return false;
      }

      // Amount Range Filter
      const minAmt = parseFloat(minAmount);
      const maxAmt = parseFloat(maxAmount);
      const shown = shownOf(t);
      if (!isNaN(minAmt) && shown < minAmt) return false;
      if (!isNaN(maxAmt) && shown > maxAmt) return false;

      return true;
    });
    // Apply sorting. Dates are local days, so they sort as strings.
    if (sortBy === 'AMOUNT_DESC') return filtered.sort((a, b) => b.amount - a.amount);
    if (sortBy === 'AMOUNT_ASC') return filtered.sort((a, b) => a.amount - b.amount);
    return filtered.sort(sortBy === 'DATE_ASC' ? (a, b) => byNewest(b, a) : byNewest);
  }, [transactions, activeType, dateFilter, categoryFilter, accountFilter, legacy, sortBy, minAmount, maxAmount, searchQuery, shownRate]);

  // One group per day, newest first, with the day's net; sorted by amount,
  // one group in that order instead.
  const groupedTransactions = useMemo(() => {
    if (sortBy === 'AMOUNT_DESC' || sortBy === 'AMOUNT_ASC') {
      return filteredTransactions.length
        ? [{ key: 'amount', label: sortBy === 'AMOUNT_DESC' ? 'Largest first' : 'Smallest first', net: null as number | null, items: filteredTransactions }]
        : [];
    }
    const todayKey = localDay();
    const yesterdayKey = addDays(todayKey, -1);
    const thisYear = new Date().getFullYear();
    const groups: { key: string; label: string; net: number | null; items: Transaction[] }[] = [];
    const byDay = new Map<string, (typeof groups)[number]>();
    for (const t of filteredTransactions) {
      const key = isDay(t.date) ? t.date : localDay(parseDay(t.date));
      let g = byDay.get(key);
      if (!g) {
        const d = parseDay(key);
        const label = key === todayKey ? 'Today'
          : key === yesterdayKey ? 'Yesterday'
          : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() === thisYear ? {} : { year: 'numeric' }) });
        g = { key, label, net: 0, items: [] };
        byDay.set(key, g);
        groups.push(g);
      }
      g.items.push(t);
      g.net = (g.net ?? 0) + (t.type === TransactionType.INCOME ? t.amount : -t.amount);
    }
    return groups;
  }, [filteredTransactions, sortBy]);

  // How far down the list is drawn. A new search, filter or order starts
  // again from the first page.
  const pageKey = [activeType, dateFilter, categoryFilter, accountFilter, sortBy, minAmount, maxAmount, searchQuery].join('|');
  const [paging, setPaging] = useState({ key: pageKey, count: PAGE });
  const shownCount = paging.key === pageKey ? paging.count : PAGE;
  const showMore = () => setPaging({ key: pageKey, count: shownCount + PAGE });

  // The first `shownCount` entries, in their groups. A day cut short keeps
  // its whole day's net, and the rest of the day follows under it.
  const shownGroups = useMemo(() => {
    let left = shownCount;
    const shown: typeof groupedTransactions = [];
    for (const g of groupedTransactions) {
      if (left <= 0) break;
      shown.push(g.items.length <= left ? g : { ...g, items: g.items.slice(0, left) });
      left -= g.items.length;
    }
    return shown;
  }, [groupedTransactions, shownCount]);
  const hiddenCount = Math.max(0, filteredTransactions.length - shownCount);

  // Exact amounts in the ledger, without ".00".
  const exact = (t: Transaction) => { const s = formatEntry(t); return s.endsWith('.00') ? s.slice(0, -3) : s; };

  // Totals for whatever is currently visible — the "do these filters tally?"
  // strip (single pass, only recomputed when the filtered list changes).
  const filteredTotals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of filteredTransactions) {
      if (t.type === TransactionType.INCOME) inc += t.amount;
      else exp += t.amount;
    }
    return { inc, exp, net: inc - exp };
  }, [filteredTransactions]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dateFilter !== 'ALL') count++;
    if (categoryFilter !== 'ALL') count++;
    if (accountFilter !== 'ALL') count++;
    if (minAmount || maxAmount) count++;
    if (sortBy !== 'DATE_DESC') count++;
    return count;
  }, [dateFilter, categoryFilter, accountFilter, minAmount, maxAmount, sortBy]);

  // Debounce: update searchQuery 250ms after debouncedSearch changes
  React.useEffect(() => {
    const t = setTimeout(() => setSearchQuery(debouncedSearch), 250);
    return () => clearTimeout(t);
  }, [debouncedSearch]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const clearFilters = () => {
    setActiveType('ALL');
    setDateFilter('ALL');
    setCategoryFilter('ALL');
    setAccountFilter('ALL');
    setSortBy('DATE_DESC');
    setMinAmount('');
    setMaxAmount('');
    setDebouncedSearch('');
    setSearchQuery('');
    setShowFilters(false);
  }

  const requestDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteId(id);
  }

  const confirmDelete = () => {
    if (deleteId) {
        deleteTransaction(deleteId);
        removed();
        setDeleteId(null);
        setToastMsg('Entry deleted');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    }
  }
  
  const handleClearAll = () => {
      if (clearInput.toUpperCase() === 'DELETE') {
          // Local state clears instantly; cloud deletion continues in the
          // background — no reason to hold the modal open for the network.
          clearAllTransactions();
          setShowClearConfirm(false);
          setClearInput('');
          setToastMsg('History cleared');
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
      }
  }

  const handleExportCSV = () => {
    const headers = ["Date", "Merchant", "Category", "Amount", "Type", "Note"];
    const csvContent = [
        headers.join(","),
        ...filteredTransactions.map(t => {
            const date = parseDay(t.date).toLocaleDateString('en-GB');
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
        link.setAttribute("download", `transactions_${localDay()}.csv`);
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
      amount: String(shownOf(transaction)),
      category: transaction.category || 'Uncategorized',
      date: toDay(transaction.date),
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

  // Back closes the filters and these dialogs first (utils/backStack.ts).
  useBackHandler(showFilters, () => setShowFilters(false));
  useBackHandler(!!deleteId, () => setDeleteId(null));
  useBackHandler(showClearConfirm, () => { setShowClearConfirm(false); setClearInput(''); });
  useBackHandler(!!editingTransaction, () => { if (!editSaving) closeEditModal(); });

  const handleEditSubmit = async () => {
    if (!editingTransaction) return;
    
    const typed = parseFloat(editForm.amount);
    if (isNaN(typed) || typed <= 0) return;
    // Unchanged, the saved rupees stay exactly as they were; changed, the
    // amount typed in the currency shown is saved in rupees, and kept as
    // typed when that isn't rupees.
    const unchanged = editForm.amount === String(shownOf(editingTransaction));
    const amount = unchanged ? editingTransaction.amount : toBase(typed, shownRate);
    if (amount <= 0) return;
    const typedFields: Pick<Transaction, 'typedAmount' | 'typedCurrency'> = unchanged
      ? { typedAmount: editingTransaction.typedAmount, typedCurrency: editingTransaction.typedCurrency }
      : shownCurrency === 'INR'
        ? { typedAmount: undefined, typedCurrency: undefined }
        : { typedAmount: Math.round(typed * 100) / 100, typedCurrency: shownCurrency };
    
    setEditSaving(true);
    try {
      const updates: Partial<Transaction> = {
        merchant: editForm.merchant.trim(),
        amount: amount,
        category: editForm.category.trim() || 'Uncategorized',
        // The day as picked: no UTC round trip (audit H4)
        date: isDay(editForm.date) ? editForm.date : editingTransaction.date,
        note: editForm.note.trim(),
        type: editForm.type,
        ...typedFields,
      };
      
      await editTransaction(editingTransaction.id, updates);
      closeEditModal();
      setToastMsg('Transaction updated');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Failed to edit transaction:', error);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] md:max-w-2xl lg:max-w-4xl mx-auto overflow-x-hidden pb-28 lg:pb-12 bg-zen-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zen-bg/90 backdrop-blur-xl px-6 pt-6 pb-4 border-b border-sage-border/20">
        <div className="flex items-center justify-between mb-5 -mt-0.5">
          <h1 className="text-premium-charcoal text-[22px] font-display font-bold tracking-tight leading-tight">Vault</h1>
          <div className="flex items-center gap-0.5 -mr-2">
             <button
                onClick={() => setShowClearConfirm(true)}
                className="w-10 h-10 flex items-center justify-center text-rose hover:bg-rose-light/20 rounded-full transition-colors"
                title="Clear all history"
                aria-label="Clear all history"
             >
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">delete_sweep</span>
             </button>
             <button
                onClick={handleExportCSV}
                className="w-10 h-10 flex items-center justify-center rounded-full text-muted-taupe hover:text-sage transition-colors"
                title="Export CSV"
                aria-label="Export CSV"
             >
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">download</span>
             </button>
             <button 
                aria-label="Filters"
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
            className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeType === 'ALL' ? 'bg-sage text-white shadow-sm' : 'bg-white border border-premium-charcoal/[0.08] text-muted-taupe hover:bg-white/80'}`}
          >
            <span className="material-symbols-outlined text-[16px]">apps</span>
            All activity
          </button>
          <button 
            onClick={() => setActiveType(TransactionType.INCOME)}
            className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeType === TransactionType.INCOME ? 'bg-sage text-white shadow-sm' : 'bg-white border border-premium-charcoal/[0.08] text-muted-taupe hover:bg-white/80'}`}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
            Income
          </button>
          <button 
            onClick={() => setActiveType(TransactionType.EXPENSE)}
            className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeType === TransactionType.EXPENSE ? 'bg-rose/90 text-white shadow-sm' : 'bg-white border border-premium-charcoal/[0.08] text-muted-taupe hover:bg-white/80'}`}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            Expenses
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative mt-3">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-muted-taupe pointer-events-none">search</span>
          <input
            type="text"
            value={debouncedSearch}
            onChange={e => setDebouncedSearch(e.target.value)}
            placeholder="Search merchant, category, note..."
            className="w-full pl-11 pr-10 py-2.5 bg-white border border-black/[0.06] rounded-2xl text-[13px] text-premium-charcoal placeholder:text-muted-taupe focus:outline-none focus:ring-2 focus:ring-sage/30 shadow-sm"
          />
          {debouncedSearch && (
            <button
              onClick={() => { setDebouncedSearch(''); setSearchQuery(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-taupe hover:text-rose transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
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
            {accountFilter !== 'ALL' && (
              <span className="px-2 py-1 bg-sage/10 text-sage text-[10px] font-medium rounded-full flex items-center gap-1 max-w-[180px] truncate">
                <span className="material-symbols-outlined text-[12px]">account_balance</span>
                {accountChoices.find(a => a.key === accountFilter)?.label ?? 'One account'}
              </span>
            )}
            {(minAmount || maxAmount) && (
              <span className="px-2 py-1 bg-ocean/10 text-ocean text-[10px] font-medium rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">payments</span>
                {minAmount && maxAmount ? `${symbol}${minAmount}-${maxAmount}` : minAmount ? `≥${symbol}${minAmount}` : `≤${symbol}${maxAmount}`}
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
            <div className="fixed inset-0 bg-premium-charcoal/30 z-50 backdrop-blur-sm" onClick={() => setShowFilters(false)}></div>
            <div className="fixed bottom-0 left-0 right-0 lg:left-[240px] z-50 bg-white rounded-t-[32px] shadow-float max-w-[430px] mx-auto animate-slide-up max-h-[85vh] overflow-hidden flex flex-col pb-[var(--sab)]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 pb-4 border-b border-premium-charcoal/[0.08]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sage-light text-sage flex items-center justify-center" aria-hidden="true">
                        <span className="material-symbols-outlined text-[20px]">tune</span>
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-bold text-premium-charcoal">Filter and sort</h3>
                        <p className="text-[10px] text-muted-taupe">{filteredTransactions.length.toLocaleString('en-IN')} {filteredTransactions.length === 1 ? 'transaction matches' : 'transactions match'}</p>
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
                              { value: 'ALL', label: 'All time', icon: 'all_inclusive' },
                              { value: 'THIS_MONTH', label: 'This month', icon: 'today' },
                              { value: '7_DAYS', label: '7 days', icon: 'date_range' },
                              { value: '30_DAYS', label: '30 days', icon: 'calendar_view_month' },
                              { value: '90_DAYS', label: '90 days', icon: 'calendar_view_week' },
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
                              { value: 'DATE_DESC', label: 'Newest first', icon: 'arrow_downward' },
                              { value: 'DATE_ASC', label: 'Oldest first', icon: 'arrow_upward' },
                              { value: 'AMOUNT_DESC', label: 'Highest amount', icon: 'trending_up' },
                              { value: 'AMOUNT_ASC', label: 'Lowest amount', icon: 'trending_down' },
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
                              <label className="text-[10px] text-muted-taupe mb-1 block">Min amount</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-taupe text-sm">{symbol}</span>
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
                              <label className="text-[10px] text-muted-taupe mb-1 block">Max amount</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-taupe text-sm">{symbol}</span>
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

                    {/* Account */}
                    {accountChoices.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="material-symbols-outlined text-sage text-[18px]">account_balance</span>
                          <p className="text-[11px] font-bold text-muted-taupe uppercase tracking-widest">Account</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[{ key: 'ALL', label: 'All accounts', entries: transactions.length }, ...accountChoices].map(a => (
                            <button
                              key={a.key}
                              onClick={() => setAccountFilter(a.key)}
                              className={`px-3 py-2 rounded-2xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                accountFilter === a.key
                                  ? 'bg-sage text-white border-sage shadow-md'
                                  : 'bg-zen-bg text-premium-charcoal border-transparent hover:border-sage/30'
                              }`}
                            >
                              <span>{a.label}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${accountFilter === a.key ? 'bg-white/20' : 'bg-black/5'}`}>
                                {a.entries}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

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
                                      <span>{cat === 'ALL' ? 'All categories' : cat}</span>
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
                <div className="p-6 pt-4 border-t border-premium-charcoal/[0.08] bg-white">
                    <button 
                        onClick={() => setShowFilters(false)}
                        className="w-full bg-premium-charcoal text-white py-4 rounded-3xl text-lg font-semibold active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">check</span>
                        Show {filteredTransactions.length.toLocaleString('en-IN')} {filteredTransactions.length === 1 ? 'Result' : 'Results'}
                    </button>
                </div>
            </div>
        </>
      )}

      {/* Entries imported twice: remove the extra copies (components/DuplicateEntries.tsx) */}
      <DuplicateEntries className="px-6 mt-4" />

      {/* List: one card per day, slim rows; tap a row for details */}
      <main className="px-6 space-y-5 mt-4">
        {/* Totals for the current filters */}
        {filteredTransactions.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-1 text-[12px]">
            <p className="text-muted-taupe">
              {filteredTransactions.length.toLocaleString('en-IN')} {filteredTransactions.length === 1 ? 'entry' : 'entries'}
            </p>
            <p className="flex items-center gap-3 tabular-nums font-semibold">
              <span className="text-sage">+{formatAmountCompact(filteredTotals.inc)}</span>
              <span className="text-rose">−{formatAmountCompact(filteredTotals.exp)}</span>
              <span className={filteredTotals.net >= 0 ? 'text-premium-charcoal' : 'text-rose'}>
                Net {filteredTotals.net >= 0 ? '+' : '−'}{formatAmountCompact(Math.abs(filteredTotals.net))}
              </span>
            </p>
          </div>
        )}
        {groupedTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
                {transactions.length === 0 && !walletLoaded ? (
                  <WalletArriving isOnline={isOnline} />
                ) : transactions.length === 0 ? (
                  <>
                    <Mascot pose="welcome" height={120} />
                    <p className="mt-4 font-display text-lg font-bold text-premium-charcoal">No entries yet</p>
                    <p className="mt-1 text-muted-taupe text-sm text-center max-w-[280px] leading-relaxed">
                      Every entry you add or import shows up here, newest first.
                    </p>
                    <div className="flex gap-2.5 mt-5">
                      <button
                        onClick={() => onNavigate(AppScreen.IMPORT)}
                        className="px-4 py-2.5 rounded-full bg-sage text-white text-[13px] font-semibold shadow-soft active:scale-95 transition-transform"
                      >
                        Import a statement
                      </button>
                      <button
                        onClick={() => onNavigate(AppScreen.NEW_ENTRY)}
                        className="px-4 py-2.5 rounded-full bg-white border border-sage/30 text-sage text-[13px] font-semibold shadow-soft active:scale-95 transition-transform"
                      >
                        Add an entry
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Mascot pose="think" height={104} />
                    <p className="mt-4 text-premium-charcoal text-sm font-semibold">
                      {searchQuery ? `Nothing matches “${searchQuery}”` : 'No entries match these filters'}
                    </p>
                    <p className="mt-1 text-muted-taupe text-[13px]">
                      {transactions.length.toLocaleString('en-IN')} {transactions.length === 1 ? 'entry is' : 'entries are'} in your wallet.
                    </p>
                    <button
                      onClick={clearFilters}
                      className="mt-3 text-sage text-xs font-semibold hover:underline"
                    >
                      {searchQuery ? 'Clear the search and filters' : 'Clear all filters'}
                    </button>
                  </>
                )}
            </div>
        ) : (
            shownGroups.map(group => (
            <section key={group.key} aria-label={group.label}>
                <div className="flex items-baseline justify-between px-1 mb-2">
                  <h3 className="text-[12px] font-semibold text-muted-taupe">{group.label}</h3>
                  {group.net !== null && (
                    <span className={`text-[11px] font-semibold tabular-nums ${group.net >= 0 ? 'text-sage' : 'text-muted-taupe'}`}>
                      {group.net >= 0 ? '+' : '−'}{formatAmountCompact(Math.abs(group.net))}
                    </span>
                  )}
                </div>
                <ul className="bg-white rounded-3xl shadow-soft border border-black/[0.02] overflow-hidden divide-y divide-premium-charcoal/[0.06]">
                {group.items.map(t => {
                    const expanded = expandedId === t.id;
                    const isExpense = t.type === TransactionType.EXPENSE;
                    const name = t.merchant && t.merchant.trim() ? prettyMerchant(t.merchant) : null;
                    const sub = [
                      paymentRail(t.merchant),
                      t.category && t.category.trim() ? t.category : 'Uncategorized',
                      t.via ? viaName(t.via) : null,
                      group.net === null ? parseDay(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : null,
                    ].filter(Boolean).join(' · ');
                    return (
                    <li key={t.id}>
                        <button
                            type="button"
                            onClick={() => toggleExpand(t.id)}
                            aria-expanded={expanded}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${expanded ? 'bg-zen-cream' : 'active:bg-zen-cream'}`}
                        >
                            <span className={`shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center ${isExpense ? 'bg-rose-light text-rose' : 'bg-sage-light text-sage'}`}>
                                <span className="material-symbols-outlined icon-fill text-[18px]" aria-hidden="true">{getIconForCategory(t.category)}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[14px] font-semibold text-premium-charcoal truncate" title={t.merchant || undefined}>
                                    {name ?? <span className="italic text-muted-taupe font-normal">Unknown payee</span>}
                                </span>
                                <span className="block text-[11px] text-muted-taupe truncate">{sub}</span>
                            </span>
                            <span className={`shrink-0 text-[14px] font-semibold tabular-nums whitespace-nowrap ${isExpense ? 'text-premium-charcoal' : 'text-sage'}`}>
                                {isExpense ? '−' : '+'}{t.amount >= 100000 ? formatAmountCompact(t.amount) : exact(t)}
                            </span>
                        </button>

                        {/* Details */}
                        {expanded && (
                            <div className="px-4 pb-4 pt-1 bg-zen-cream space-y-3">
                                {(() => {
                                    // The bank's narration in full, and the entry's own note (services/narration.ts).
                                    const { narration, note } = bankWords(t.merchant, t.note);
                                    return (
                                        <>
                                            {t.via ? (
                                                <div>
                                                    <p className="text-[11px] text-muted-taupe mb-0.5">Added by Wall-ette</p>
                                                    <p className="text-[12px] text-premium-charcoal leading-snug">
                                                        {t.via === 'share' ? 'From text you shared' : `From ${viaName(t.via) ?? 'an app'}'s notification`}
                                                        {(() => { const ref = bankReference(t.merchant); return ref ? ` · reference ${ref.slice(4)}` : ''; })()}.
                                                        {' '}A statement with this payment takes its place when you import it.
                                                    </p>
                                                </div>
                                            ) : narration && narration !== name && (
                                                <div>
                                                    <p className="text-[11px] text-muted-taupe mb-0.5">From the bank</p>
                                                    <p className="text-[12px] text-premium-charcoal break-all leading-snug">{narration}</p>
                                                </div>
                                            )}
                                            {note && (
                                                <div>
                                                    <p className="text-[11px] text-muted-taupe mb-0.5">Note</p>
                                                    <p className="text-[13px] text-premium-charcoal">{note}</p>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                                {(() => {
                                    // Money moved isn't spending or income (audit H3): say why
                                    const info = flowOf(t);
                                    if (info.flow !== 'moved' || !info.moved) return null;
                                    if (info.moved === 'reversal') return (
                                        <p className="flex items-center gap-1.5 text-[12px] text-lavender font-semibold">
                                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">undo</span>
                                            {t.type === TransactionType.INCOME
                                              ? 'The bank sent back a payment of the same amount: both are left out of spending and income'
                                              : 'Reversed by the bank: this and the money that came back are left out of spending and income'}
                                        </p>
                                    );
                                    return (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onNavigate(AppScreen.MONEY_MOVED); }}
                                            className="flex items-center gap-1.5 text-[12px] text-lavender font-semibold"
                                        >
                                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">swap_horiz</span>
                                            Money moved · {MOVED_LABELS[info.moved]} · not counted as {t.type === TransactionType.INCOME ? 'income' : 'spending'}
                                        </button>
                                    );
                                })()}
                                <div className="flex justify-between items-end gap-3">
                                    <div>
                                        <p className="text-[11px] text-muted-taupe mb-0.5">{entryTime(t) ? 'Time' : 'Date'}</p>
                                        <p className="text-[13px] text-premium-charcoal">{entryTime(t) ?? parseDay(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => openEditModal(t, e)}
                                            className="text-[12px] bg-white text-sage px-4 py-1.5 rounded-full font-semibold shadow-soft"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={(e) => requestDelete(t.id, e)}
                                            className="text-[12px] bg-white text-rose px-4 py-1.5 rounded-full font-semibold shadow-soft"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </li>
                    );
                })}
                </ul>
            </section>
            ))
        )}
        {hiddenCount > 0 && (
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={showMore}
              className="px-5 py-2.5 rounded-full bg-white border border-sage/30 text-sage text-[13px] font-semibold shadow-soft active:scale-95 transition-transform"
            >
              Show {Math.min(PAGE, hiddenCount).toLocaleString('en-IN')} more
            </button>
            <p className="text-[11px] text-muted-taupe tabular-nums">
              {shownCount.toLocaleString('en-IN')} of {filteredTransactions.length.toLocaleString('en-IN')} shown
            </p>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-[calc(1rem_+_var(--sat))] pb-[calc(1rem_+_var(--sab))] bg-premium-charcoal/20 backdrop-blur-sm" onClick={() => setDeleteId(null)}>
            <div className="bg-white rounded-[32px] p-6 w-full max-w-[320px] shadow-2xl border border-white/50 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-rose-light text-rose rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-[24px]">delete</span>
                    </div>
                    <h3 className="text-premium-charcoal font-display text-xl font-bold mb-2">Delete this entry?</h3>
                    <p className="text-muted-taupe text-xs mb-6 leading-relaxed">
                        This action cannot be undone. The transaction will be permanently removed.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setDeleteId(null)}
                            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold bg-white border border-premium-charcoal/[0.08] text-premium-charcoal hover:bg-gray-50 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-[calc(1rem_+_var(--sat))] pb-[calc(1rem_+_var(--sab))] bg-rose/10 backdrop-blur-md">
            <div className="bg-white rounded-[32px] p-6 w-full max-w-[320px] shadow-2xl border-2 border-rose/20 animate-slide-up">
                <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-rose-light text-rose rounded-full flex items-center justify-center mb-4 animate-pulse">
                        <span className="material-symbols-outlined text-[32px]">warning</span>
                    </div>
                    <h3 className="text-rose font-display text-xl font-bold mb-2">Clear all history?</h3>
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
                            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold bg-white border border-premium-charcoal/[0.08] text-premium-charcoal hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleClearAll}
                            disabled={clearInput.toUpperCase() !== 'DELETE'}
                            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold bg-rose text-white shadow-soft hover:bg-rose/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Clear all
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-[calc(1rem_+_var(--sat))] pb-[calc(1rem_+_var(--sab))] bg-premium-charcoal/20 backdrop-blur-sm" onClick={closeEditModal}>
            <div className="bg-white rounded-[32px] p-6 w-full max-w-[380px] shadow-2xl border border-white/50 animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-sage-light text-sage rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-[24px]">edit</span>
                            </div>
                            <h3 className="text-premium-charcoal font-display text-xl font-bold">Edit entry</h3>
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
                                        : 'bg-white border border-premium-charcoal/[0.08] text-muted-taupe hover:bg-gray-50'
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
                                        : 'bg-white border border-premium-charcoal/[0.08] text-muted-taupe hover:bg-gray-50'
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
                            className="w-full px-4 py-3 rounded-2xl border border-premium-charcoal/[0.08] bg-white text-[14px] text-premium-charcoal placeholder:text-muted-taupe focus:outline-none focus:ring-2 focus:ring-sage/30"
                        />
                    </div>

                    {/* Amount */}
                    <div className="mb-4">
                        <label className="text-[11px] text-muted-taupe font-bold uppercase tracking-wider mb-2 block">Amount, {shownCurrency}</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editForm.amount}
                            onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0.00"
                            className="w-full px-4 py-3 rounded-2xl border border-premium-charcoal/[0.08] bg-white text-[14px] text-premium-charcoal placeholder:text-muted-taupe focus:outline-none focus:ring-2 focus:ring-sage/30"
                        />
                    </div>

                    {/* Category */}
                    <div className="mb-4">
                        <label className="text-[11px] text-muted-taupe font-bold uppercase tracking-wider mb-2 block">Category</label>
                        <select
                            value={editForm.category}
                            onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full px-4 py-3 rounded-2xl border border-premium-charcoal/[0.08] bg-white text-[14px] text-premium-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 appearance-none cursor-pointer"
                            title="Category"
                            aria-label="Category"
                          >
                            {categoryOptions(editForm.category).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date */}
                    <div className="mb-4">
                        <label className="text-[11px] text-muted-taupe font-bold uppercase tracking-wider mb-2 block">Date</label>
                        <input
                            type="date"
                            value={editForm.date}
                            onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full px-4 py-3 rounded-2xl border border-premium-charcoal/[0.08] bg-white text-[14px] text-premium-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30"
                            title="Date"
                            aria-label="Date"
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
                            className="w-full px-4 py-3 rounded-2xl border border-premium-charcoal/[0.08] bg-white text-[14px] text-premium-charcoal placeholder:text-muted-taupe focus:outline-none focus:ring-2 focus:ring-sage/30 resize-none"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button 
                            onClick={closeEditModal}
                            className="flex-1 py-3 rounded-2xl text-[13px] font-semibold bg-white border border-premium-charcoal/[0.08] text-premium-charcoal hover:bg-gray-50 transition-colors"
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
          <div className="fixed bottom-[calc(6rem_+_var(--sab))] left-1/2 -translate-x-1/2 bg-premium-charcoal text-white px-6 py-3 rounded-full shadow-xl z-50 animate-slide-up flex items-center gap-2">
              <span className="material-symbols-outlined text-sage text-[20px]">check_circle</span>
              <span className="text-[13px] font-medium">{toastMsg}</span>
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