import React, { useMemo, useState } from 'react';
import { AppScreen, TransactionType, CATEGORIES } from '../types';
import { getSymbol } from '../currencyUtils';
import { useWallet } from '../context/WalletContext';
import { prettyMerchant } from '../services/analyticsService';
import { FloatingLeaf, Sprout, RangoliCorner, Diya } from './SplashScreen';

interface NewEntryProps {
  onNavigate: (screen: AppScreen) => void;
}

// Category quick-picks per type; "More" reveals the full list.
const EXPENSE_QUICK = ['Food Delivery', 'Groceries', 'Dining', 'Coffee', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Rent', 'Healthcare', 'Cash', 'Subscriptions'];
const INCOME_QUICK = ['Salary', 'Freelance', 'Bonus', 'Investment', 'Dividend', 'Interest', 'Transfer'];

// Merchant → category assist (only fires while category is unset).
const AUTO_CATEGORY: [RegExp, string][] = [
  [/zomato|swiggy|eatsure/i, 'Food Delivery'],
  [/blinkit|zepto|bigbasket|jiomart|grofers|instamart|dmart/i, 'Groceries'],
  [/mcdonald|kfc|domino|pizza|burger|subway|restaurant/i, 'Dining'],
  [/starbucks|cafe|ccd|barista|chaayos/i, 'Coffee'],
  [/uber|ola cab|rapido|metro|irctc|redbus/i, 'Transport'],
  [/netflix|hotstar|spotify|prime video|sonyliv/i, 'Streaming'],
  [/amazon|flipkart|myntra|ajio|meesho|nykaa/i, 'Shopping'],
  [/petrol|fuel|hpcl|bpcl|shell/i, 'Fuel'],
  [/jio|airtel|recharge|postpaid/i, 'Phone'],
];

const CAT_ICON = (cat: string): string => {
  const l = cat.toLowerCase();
  if (l.includes('food') || l.includes('dining')) return 'restaurant';
  if (l.includes('grocer')) return 'local_grocery_store';
  if (l.includes('coffee')) return 'coffee';
  if (l.includes('transport') || l.includes('taxi') || l.includes('metro') || l.includes('flight') || l.includes('fuel') || l.includes('parking')) return 'commute';
  if (l.includes('shop') || l.includes('cloth') || l.includes('electronic') || l.includes('furniture')) return 'shopping_bag';
  if (l.includes('entertain') || l.includes('movie') || l.includes('stream') || l.includes('game')) return 'movie';
  if (l.includes('bill') || l.includes('utilit') || l.includes('electric') || l.includes('water') || l.includes('gas') || l.includes('internet') || l.includes('phone')) return 'receipt_long';
  if (l.includes('rent') || l.includes('emi') || l.includes('loan') || l.includes('credit')) return 'home';
  if (l.includes('health') || l.includes('pharma') || l.includes('doctor') || l.includes('insurance')) return 'medication';
  if (l.includes('educat') || l.includes('book') || l.includes('course')) return 'school';
  if (l.includes('salary') || l.includes('freelance') || l.includes('bonus')) return 'work';
  if (l.includes('invest') || l.includes('dividend') || l.includes('interest')) return 'trending_up';
  if (l.includes('transfer')) return 'swap_horiz';
  if (l.includes('cash') || l.includes('atm')) return 'atm';
  if (l.includes('subscri') || l.includes('gym')) return 'subscriptions';
  if (l.includes('travel') || l.includes('hotel') || l.includes('vacation')) return 'flight';
  if (l.includes('personal') || l.includes('beauty')) return 'spa';
  if (l.includes('charity')) return 'volunteer_activism';
  return 'category';
};

// Local YYYY-MM-DD without the UTC shift toISOString causes on IST.
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

const NewEntry: React.FC<NewEntryProps> = ({ onNavigate }) => {
  const { currency, addTransaction, convertToBase, transactions, dailyLimit, formatAmount } = useWallet();
  const [amount, setAmount] = useState('0.00');
  const [note, setNote] = useState('');
  const [merchant, setMerchant] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState<string>('');
  const [autoCat, setAutoCat] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saveAndAdd, setSaveAndAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;

  // Recent merchants for the active type (last 90 days, by frequency)
  const suggestions = useMemo(() => {
    const cutoff = Date.now() - 90 * 86400000;
    const freq = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== type) continue;
      if (Date.parse(t.date) < cutoff) continue;
      const name = prettyMerchant(t.merchant || '');
      if (!name || name === 'Unknown') continue;
      freq.set(name, (freq.get(name) || 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n);
  }, [transactions, type]);

  // Today's expense total (base) for the daily-limit preview
  const todaySpend = useMemo(() => {
    const key = new Date().toDateString();
    let sum = 0;
    for (const t of transactions) {
      if (t.type === TransactionType.EXPENSE && new Date(t.date).toDateString() === key) sum += t.amount;
    }
    return sum;
  }, [transactions]);

  const overLimit = type === TransactionType.EXPENSE && dailyLimit > 0 && numAmount > 0
    && todaySpend + convertToBase(numAmount) > dailyLimit;

  const applyMerchant = (value: string) => {
    setMerchant(value);
    if (!category || autoCat) {
      for (const [rx, cat] of AUTO_CATEGORY) {
        if (rx.test(value)) { setCategory(cat); setAutoCat(true); return; }
      }
      if (autoCat) { setCategory(''); setAutoCat(false); }
    }
  };

  const pickCategory = (cat: string) => {
    setCategory(cat);
    setAutoCat(false);
    setShowAllCats(false);
  };

  const handleKeypad = (val: string) => {
    if (val === 'backspace') {
      if (amount.length <= 1 || amount === '0.00') setAmount('0.00');
      else setAmount(prev => (prev.length > 1 ? prev.slice(0, -1) : '0.00'));
    } else {
      if (amount === '0.00') {
        setAmount(val === '.' ? '0.' : val);
      } else {
        if (val === '.' && amount.includes('.')) return;
        const dotIdx = amount.indexOf('.');
        if (dotIdx !== -1 && amount.length - dotIdx > 2) return;
        if (dotIdx === -1 && amount.length >= 8 && val !== '.') return; // sane cap
        setAmount(prev => prev + val);
      }
    }
  };

  const handleSave = async () => {
    if (numAmount <= 0) return;
    const amountInBase = convertToBase(numAmount);

    const success = await addTransaction({
      id: `txn-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`,
      amount: amountInBase,
      type,
      category: category || 'Uncategorized',
      date: selectedDate.toISOString(),
      note,
      merchant: merchant.trim() || (type === TransactionType.EXPENSE ? (note || 'Unknown Merchant') : 'Income Source'),
    });

    if (success) {
      if (saveAndAdd) {
        setAmount('0.00'); setNote(''); setMerchant(''); setCategory(''); setAutoCat(false);
        setSelectedDate(new Date());
        setToast('Saved — add the next one');
        setTimeout(() => setToast(null), 2200);
      } else {
        onNavigate(AppScreen.DASHBOARD);
      }
    }
  };

  const dateLabel = (() => {
    const today = new Date().toDateString();
    const yest = new Date(Date.now() - 86400000).toDateString();
    const k = selectedDate.toDateString();
    if (k === today) return 'Today';
    if (k === yest) return 'Yesterday';
    return selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  const quickCats = type === TransactionType.EXPENSE ? EXPENSE_QUICK : INCOME_QUICK;
  const catList = showAllCats ? CATEGORIES : quickCats;
  const amtFont = amount.length > 9 ? 'text-[36px]' : amount.length > 6 ? 'text-[46px]' : 'text-[56px]';

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col max-w-[430px] mx-auto bg-zen-bg overflow-hidden">
      <FloatingLeaf className="top-20 right-5 opacity-35" delay={0.3} />
      <Sprout className="absolute top-32 left-4 opacity-40" />
      <RangoliCorner className="absolute bottom-40 right-2 opacity-20" color="#C4A98E" mirror />

      {/* Header */}
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="text-muted-taupe flex items-center justify-center h-10 w-10 hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[28px]">close</span>
        </button>
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">New Entry</h2>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-2 flex flex-col gap-6 pb-4">
        {/* Amount hero */}
        <div className="text-center py-4 relative">
          <div className="absolute top-2 right-8"><Diya className="opacity-50" /></div>
          <p className="text-muted-taupe text-[11px] font-medium uppercase tracking-[0.2em] mb-2">Amount</p>
          <div className="flex items-center justify-center gap-1">
            <span className={`font-serif text-3xl mb-2 ${numAmount > 0 ? 'text-premium-charcoal' : 'text-muted-taupe/50'}`}>{getSymbol(currency)}</span>
            <span className={`font-serif leading-none ${amtFont} ${numAmount > 0 ? 'text-premium-charcoal' : 'text-muted-taupe/40'}`}>{amount}</span>
          </div>
          {/* Quick amounts */}
          <div className="flex justify-center gap-1.5 mt-4 flex-wrap">
            {QUICK_AMOUNTS.map(q => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${amount === String(q) ? 'bg-sage text-white border-sage' : 'bg-white text-muted-taupe border-black/5 hover:border-sage/30'}`}
              >
                {getSymbol(currency)}{q.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>

        {/* Type toggle */}
        <div className="bg-white/50 p-1.5 rounded-full flex gap-1 border border-black/[0.03] shadow-soft">
          <button
            onClick={() => { setType(TransactionType.EXPENSE); setCategory(''); setAutoCat(false); }}
            className={`flex-1 py-3 px-4 rounded-full text-[13px] font-semibold tracking-wide flex items-center justify-center gap-2 transition-all ${type === TransactionType.EXPENSE ? 'bg-rose-light text-rose' : 'text-muted-taupe hover:bg-white'}`}
          >
            <span className="material-symbols-outlined text-sm font-bold">arrow_downward</span>
            Expense
          </button>
          <button
            onClick={() => { setType(TransactionType.INCOME); setCategory(''); setAutoCat(false); }}
            className={`flex-1 py-3 px-4 rounded-full text-[13px] font-semibold tracking-wide flex items-center justify-center gap-2 transition-all ${type === TransactionType.INCOME ? 'bg-sage-light text-sage' : 'text-muted-taupe hover:bg-white'}`}
          >
            <span className="material-symbols-outlined text-sm font-bold">arrow_upward</span>
            Income
          </button>
        </div>

        <div className="space-y-4">
          {/* Merchant / Payee + recent suggestions */}
          <div className="bg-white rounded-[24px] p-4 shadow-soft border border-black/[0.01]">
            <div className="flex items-center gap-4">
              <div className="bg-lavender-light text-lavender p-2.5 rounded-2xl shrink-0">
                <span className="material-symbols-outlined text-[20px]">storefront</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-taupe font-bold">Merchant / Payee</p>
                <input
                  type="text"
                  value={merchant}
                  onChange={e => applyMerchant(e.target.value)}
                  placeholder={type === TransactionType.EXPENSE ? 'e.g. Swiggy, Amazon' : 'e.g. Employer, Client'}
                  className="w-full bg-transparent border-none p-0 focus:ring-0 text-premium-charcoal text-[15px] font-serif font-semibold outline-none placeholder:text-muted-taupe/50 placeholder:font-sans placeholder:font-normal placeholder:text-sm"
                />
              </div>
            </div>
            {merchant === '' && suggestions.length > 0 && (
              <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => applyMerchant(s)}
                    className="px-3 py-1.5 rounded-full text-[10px] font-semibold bg-zen-bg text-premium-charcoal border border-black/5 whitespace-nowrap shrink-0 hover:border-sage/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category — visual chip grid */}
          <div className="bg-white rounded-[24px] p-4 shadow-soft border border-black/[0.01]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-taupe font-bold">
                Category{autoCat && category ? <span className="text-sage normal-case tracking-normal"> · auto: {category}</span> : ''}
              </p>
              <button
                onClick={() => setShowAllCats(v => !v)}
                className="text-[10px] font-bold uppercase tracking-wider text-sage"
              >
                {showAllCats ? 'Less' : 'More'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[168px] overflow-y-auto">
              {catList.map(cat => (
                <button
                  key={cat}
                  onClick={() => pickCategory(cat)}
                  className={`px-3 py-2 rounded-2xl text-[11px] font-medium border transition-all flex items-center gap-1.5 ${
                    category === cat
                      ? (type === TransactionType.EXPENSE ? 'bg-rose text-white border-rose shadow-sm' : 'bg-sage text-white border-sage shadow-sm')
                      : 'bg-zen-bg text-premium-charcoal border-transparent hover:border-black/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{CAT_ICON(cat)}</span>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="bg-white rounded-[24px] p-4 flex items-center gap-4 shadow-soft border border-black/[0.01] cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="bg-rose-light text-rose p-2.5 rounded-2xl">
              <span className="material-symbols-outlined text-[20px]">calendar_today</span>
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-taupe font-bold">Date</p>
              <p className="text-premium-charcoal text-[15px] font-serif font-semibold">{dateLabel}</p>
            </div>
            <span className="material-symbols-outlined text-muted-taupe opacity-40">expand_more</span>
          </div>

          {showDatePicker && (
            <div className="bg-white rounded-[24px] p-6 shadow-soft border border-black/[0.01] space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Yesterday', days: 1 },
                  { label: 'Last Week', days: 7 },
                  { label: 'Last Month', days: 30 },
                ].map(q => (
                  <button
                    key={q.label}
                    onClick={() => {
                      const d = new Date(); d.setDate(d.getDate() - q.days);
                      setSelectedDate(d); setShowDatePicker(false);
                    }}
                    className="bg-sage-light text-sage py-2 rounded-lg text-[13px] font-semibold hover:bg-sage hover:text-white transition-colors"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-black/5 pt-4">
                <input
                  type="date"
                  value={toLocalInput(selectedDate)}
                  max={toLocalInput(new Date())}
                  onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
                  className="w-full px-4 py-2 rounded-lg border border-sage-border focus:outline-none focus:ring-2 focus:ring-sage text-premium-charcoal font-serif"
                  title="Custom date"
                  aria-label="Custom date"
                />
              </div>
              <button
                onClick={() => setShowDatePicker(false)}
                className="w-full bg-sage-light text-sage py-2 rounded-lg text-[13px] font-semibold hover:bg-sage hover:text-white transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Note */}
          <div className="bg-white rounded-[24px] p-4 flex items-center gap-4 shadow-soft border border-black/[0.01]">
            <div className="bg-zen-bg text-muted-taupe p-2.5 rounded-2xl border border-black/[0.03]">
              <span className="material-symbols-outlined text-[20px]">notes</span>
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-taupe font-bold">Note</p>
              <input
                className="w-full bg-transparent border-none p-0 focus:ring-0 text-premium-charcoal text-[15px] font-serif placeholder:text-muted-taupe/40"
                placeholder="Add details..."
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                title="Note"
                aria-label="Note"
              />
            </div>
          </div>

          {/* Daily limit heads-up */}
          {overLimit && (
            <div className="flex items-center gap-2 bg-rose-light/40 border border-rose/20 rounded-2xl px-4 py-3">
              <span className="material-symbols-outlined text-rose text-[18px]">warning</span>
              <p className="text-rose text-[11px] font-medium leading-relaxed">
                This would push today past your {formatAmount(dailyLimit).split('.')[0]} daily limit
                (spent {formatAmount(todaySpend).split('.')[0]} so far) — the save will be blocked.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Keypad + save */}
      <div className="bg-white/80 backdrop-blur-xl border-t border-black/[0.05] rounded-t-[40px] px-8 pt-6 pb-10 shadow-soft">
        <div className="grid grid-cols-3 gap-y-1 gap-x-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handleKeypad(num.toString())} className="py-3 flex items-center justify-center text-2xl font-serif text-premium-charcoal rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">
              {num}
            </button>
          ))}
          <button onClick={() => handleKeypad('.')} className="py-3 flex items-center justify-center text-2xl font-serif text-premium-charcoal rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">.</button>
          <button onClick={() => handleKeypad('0')} className="py-3 flex items-center justify-center text-2xl font-serif text-premium-charcoal rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">0</button>
          <button onClick={() => handleKeypad('backspace')} className="py-3 flex items-center justify-center text-muted-taupe rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-[24px]">backspace</span>
          </button>
        </div>

        <label className="flex items-center justify-center gap-2 mt-3 cursor-pointer select-none">
          <div
            onClick={() => setSaveAndAdd(p => !p)}
            className={`relative w-10 h-5 rounded-full transition-colors ${saveAndAdd ? 'bg-sage' : 'bg-black/10'}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${saveAndAdd ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
          <span className="text-[12px] text-muted-taupe font-medium">Save & Add Another</span>
        </label>

        <button
          onClick={handleSave}
          disabled={numAmount <= 0}
          className="w-full mt-3 bg-sage text-white py-4 rounded-[24px] font-serif text-lg font-semibold shadow-soft flex items-center justify-center gap-2 hover:bg-sage/90 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[22px]">{saveAndAdd ? 'add' : 'check'}</span>
          {saveAndAdd ? 'Save & Add Another' : 'Save Transaction'}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-premium-charcoal text-white px-6 py-3 rounded-full shadow-xl z-50 flex items-center gap-2">
          <span className="material-symbols-outlined text-sage text-[20px]">check_circle</span>
          <span className="text-[13px] font-medium font-serif">{toast}</span>
        </div>
      )}
    </div>
  );
};

export default NewEntry;
