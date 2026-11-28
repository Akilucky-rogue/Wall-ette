import React, { useMemo, useRef, useState } from 'react';
import { AppScreen, TransactionType, CATEGORIES, type Category } from '../types';
import { getSymbol, localeFor, niceAmount, toBase } from '../utils/currencyUtils';
import { amountValue, entryFromForm, pressKey } from '../utils/entryAmount';
import { useWallet } from '../context/WalletContext';
import { useLimits } from '../services/plan';
import { opens } from '../services/planRules';
import { addDays, isDay, localDay, parseDay } from '../utils/dates';
import { prettyMerchant } from '../services/analyticsService';
import { done } from '../utils/haptics';
import Garden from './ui/Garden';

interface NewEntryProps {
  onNavigate: (screen: AppScreen) => void;
}

// Category quick-picks per type; "More" reveals the full list.
const EXPENSE_QUICK: Category[] = ['Food Delivery', 'Groceries', 'Dining', 'Coffee', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Rent', 'Healthcare', 'Cash Withdrawal', 'Subscriptions'];
const INCOME_QUICK: Category[] = ['Salary', 'Freelance', 'Bonus', 'Investment Returns', 'Dividend', 'Interest Income', 'Transfer In'];

// Merchant → category assist (only fires while category is unset).
const AUTO_CATEGORY: [RegExp, Category][] = [
  [/zomato|swiggy|eatsure/i, 'Food Delivery'],
  [/blinkit|zepto|bigbasket|jiomart|grofers|instamart|dmart/i, 'Groceries'],
  [/mcdonald|kfc|domino|pizza|burger|subway|restaurant/i, 'Dining'],
  [/starbucks|coffee|cafe|ccd|barista|chaayos|chai point|third wave|blue tokai|tim hortons/i, 'Coffee'],
  [/uber|ola cab|rapido|metro|irctc|redbus/i, 'Transport'],
  [/netflix|hotstar|spotify|prime video|sonyliv/i, 'Streaming'],
  [/amazon|flipkart|myntra|ajio|meesho|nykaa/i, 'Shopping'],
  [/petrol|fuel|hpcl|bpcl|shell/i, 'Fuel'],
  [/jio|airtel|recharge|postpaid/i, 'Phone & Internet'],
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

// Quick amounts in rupees; in another currency, the nearest round figure.
const QUICK_AMOUNTS_INR = [100, 200, 500, 1000, 2000, 5000];

const NewEntry: React.FC<NewEntryProps> = ({ onNavigate }) => {
  const { shownCurrency, shownRate, addTransaction, transactions, counted, flowOf, dailyLimit, formatAmount, formatWhole, accounts } = useWallet();
  // Essential keeps 12 months: an entry can't be dated before them.
  const limits = useLimits(accounts);
  const earliest = opens(limits.access, 'full-history') ? undefined : limits.from;
  const quickAmounts = useMemo(
    () => [...new Set(QUICK_AMOUNTS_INR.map(q => (shownCurrency === 'INR' ? q : niceAmount(q * shownRate))))].filter(q => q > 0),
    [shownCurrency, shownRate],
  );
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

  const numAmount = amountValue(amount);

  // Recent merchants for the active type (last 90 days, by frequency)
  const suggestions = useMemo(() => {
    const since = addDays(localDay(), -90);
    const freq = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== type) continue;
      if (t.date < since) continue;
      const name = prettyMerchant(t.merchant || '');
      if (!name || name === 'Unknown') continue;
      freq.set(name, (freq.get(name) || 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n);
  }, [transactions, type]);

  // Today's spending (base) for the daily-limit preview. Like the check on
  // save, only spending counts: money moved to family or your own accounts
  // doesn't use up the limit.
  const todaySpend = useMemo(() => {
    const today = localDay();
    let sum = 0;
    for (const t of counted) {
      if (t.type === TransactionType.EXPENSE && t.date === today) sum += t.amount;
    }
    return sum;
  }, [counted]);

  const entryCounts = useMemo(() => flowOf({
    id: 'draft', amount: 1, type, category: category || 'Uncategorized', date: localDay(),
    merchant: merchant.trim() || (type === TransactionType.EXPENSE ? (note || 'Unknown Merchant') : 'Income Source'),
  }).flow === 'spend', [flowOf, type, category, merchant, note]);

  // Only an entry dated today counts toward today's limit.
  const forToday = localDay(selectedDate) === localDay();
  const overLimit = type === TransactionType.EXPENSE && entryCounts && forToday && dailyLimit > 0 && numAmount > 0
    && todaySpend + toBase(numAmount, shownRate) > dailyLimit;

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

  const handleKeypad = (val: string) => setAmount(prev => pressKey(prev, val));

  // One save per tap: a second tap before the first finishes (a double tap,
  // or Save pressed while saving) adds nothing.
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (savingRef.current) return;
    // Typed in the currency shown; saved in rupees, to the paisa.
    const entry = entryFromForm(
      { typed: amount, rate: shownRate, currency: shownCurrency, type, category, merchant, note, day: localDay(selectedDate) },
      `txn-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`,
      new Date(),
    );
    if (!entry) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const success = await addTransaction(entry);
      if (!success) return;
      done();
      if (saveAndAdd) {
        setAmount('0.00'); setNote(''); setMerchant(''); setCategory(''); setAutoCat(false);
        setSelectedDate(new Date());
        setToast('Saved — add the next one');
        setTimeout(() => setToast(null), 2200);
      } else {
        onNavigate(AppScreen.DASHBOARD);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
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
  const amtFont = amount.length > 9 ? 'text-[30px]' : amount.length > 6 ? 'text-[36px]' : 'text-[44px]';
  const typeButton = (t: TransactionType, label: string, icon: string, on: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={type === t}
      onClick={() => { setType(t); setCategory(''); setAutoCat(false); }}
      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1 transition-all ${type === t ? on : 'text-muted-taupe'}`}
    >
      <span className="hidden min-[390px]:inline-flex" aria-hidden="true"><span className="material-symbols-outlined text-[15px]">{icon}</span></span>
      {label}
    </button>
  );

  // One screen on a phone: the type sits in the header, quick amounts and
  // categories scroll sideways, and payee, category, date and note share a
  // card, so the keypad and Save stay in view without scrolling.
  return (
    <div className="relative flex h-page w-full flex-col max-w-[430px] md:max-w-xl mx-auto bg-zen-bg overflow-hidden">
      <Garden />

      {/* Header, with Expense or Income */}
      <div className="flex items-center gap-2 bg-zen-bg/85 backdrop-blur-md px-5 pt-5 pb-2 sticky top-0 z-30">
        <button
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
          aria-label="Close without saving"
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">close</span>
        </button>
        <h2 className="text-premium-charcoal text-[20px] font-display font-bold tracking-tight leading-tight flex-1 truncate">New entry</h2>
        <div className="bg-white/70 p-1 rounded-full flex gap-0.5 border border-black/[0.04] shadow-soft" role="radiogroup" aria-label="Type">
          {typeButton(TransactionType.EXPENSE, 'Expense', 'arrow_downward', 'bg-rose-light text-rose')}
          {typeButton(TransactionType.INCOME, 'Income', 'arrow_upward', 'bg-sage-light text-sage')}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-3 pb-3">
        {/* Amount */}
        <div className="text-center pt-1">
          <p className="sr-only">Amount</p>
          <div className="flex items-center justify-center gap-1 min-h-[52px]">
            <span className={`text-2xl font-medium ${numAmount > 0 ? 'text-premium-charcoal' : 'text-muted-taupe'}`}>{getSymbol(shownCurrency)}</span>
            <span className={`font-semibold leading-none tabular-nums ${amtFont} ${numAmount > 0 ? 'text-premium-charcoal' : 'text-muted-taupe'}`}>{amount}</span>
          </div>
          {/* Quick amounts: one row */}
          <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar justify-start sm:justify-center -mx-5 px-5">
            {quickAmounts.map(q => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border whitespace-nowrap shrink-0 transition-all ${amount === String(q) ? 'bg-sage text-white border-sage' : 'bg-white text-muted-taupe border-premium-charcoal/[0.08] hover:border-sage/30'}`}
              >
                {getSymbol(shownCurrency)}{q.toLocaleString(localeFor(shownCurrency))}
              </button>
            ))}
          </div>
        </div>

        {/* Payee, category, date and note: one card */}
        <div className="bg-white rounded-[22px] shadow-soft border border-black/[0.02] divide-y divide-premium-charcoal/[0.06]">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-lavender text-[20px] shrink-0" aria-hidden="true">storefront</span>
              <input
                type="text"
                value={merchant}
                onChange={e => applyMerchant(e.target.value)}
                placeholder={type === TransactionType.EXPENSE ? 'Paid to (Swiggy, Amazon…)' : 'From (employer, client…)'}
                aria-label={type === TransactionType.EXPENSE ? 'Paid to' : 'Received from'}
                className="flex-1 min-w-0 bg-transparent border-none p-0 focus:ring-0 text-premium-charcoal text-[15px] font-semibold outline-none placeholder:text-muted-taupe placeholder:font-normal placeholder:text-[14px]"
              />
            </div>
            {merchant === '' && suggestions.length > 0 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => applyMerchant(s)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zen-bg text-premium-charcoal border border-premium-charcoal/[0.08] whitespace-nowrap shrink-0 hover:border-sage/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category: one row, More opens them all */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-muted-taupe font-semibold">
                Category{autoCat && category ? <span className="text-sage font-medium"> · picked from the payee</span> : ''}
              </p>
              <button onClick={() => setShowAllCats(v => !v)} className="text-[11px] font-semibold text-sage">
                {showAllCats ? 'Fewer' : 'All categories'}
              </button>
            </div>
            <div className={showAllCats ? 'flex flex-wrap gap-1.5 max-h-[148px] overflow-y-auto' : 'flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4'}>
              {catList.map(cat => (
                <button
                  key={cat}
                  onClick={() => pickCategory(cat)}
                  aria-pressed={category === cat}
                  className={`px-2.5 py-1.5 rounded-xl text-[12px] font-medium border whitespace-nowrap shrink-0 transition-all flex items-center gap-1 ${
                    category === cat
                      ? (type === TransactionType.EXPENSE ? 'bg-rose text-white border-rose shadow-sm' : 'bg-sage text-white border-sage shadow-sm')
                      : 'bg-zen-bg text-premium-charcoal border-transparent hover:border-premium-charcoal/[0.12]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{CAT_ICON(cat)}</span>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Date and note: one row */}
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
              aria-expanded={showDatePicker}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-light/60 text-rose text-[12px] font-semibold shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">calendar_today</span>
              {dateLabel}
              <span className="material-symbols-outlined text-[16px] opacity-60" aria-hidden="true">{showDatePicker ? 'expand_less' : 'expand_more'}</span>
            </button>
            <input
              className="flex-1 min-w-0 bg-transparent border-none px-1 py-1.5 focus:ring-0 text-premium-charcoal text-[14px] placeholder:text-muted-taupe outline-none"
              placeholder="Add a note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Note"
            />
          </div>

          {showDatePicker && (
            <div className="px-4 py-3 space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Yesterday', days: 1 },
                  { label: 'Last week', days: 7 },
                  { label: 'Last month', days: 30 },
                ].map(q => (
                  <button
                    key={q.label}
                    onClick={() => {
                      const d = new Date(); d.setDate(d.getDate() - q.days);
                      setSelectedDate(d); setShowDatePicker(false);
                    }}
                    className="bg-sage-light text-sage py-1.5 px-1 rounded-lg text-[12px] font-semibold whitespace-nowrap hover:bg-sage hover:text-white transition-colors"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={localDay(selectedDate)}
                max={localDay()}
                min={earliest}
                onChange={(e) => { if (isDay(e.target.value) && !(earliest && e.target.value < earliest)) { setSelectedDate(parseDay(e.target.value)); setShowDatePicker(false); } }}
                className="w-full px-3 py-1.5 rounded-lg border border-sage-border focus:outline-none focus:ring-2 focus:ring-sage text-premium-charcoal text-[14px]"
                aria-label="Another day"
              />
            </div>
          )}
        </div>

        {/* Daily limit heads-up */}
        {overLimit && (
          <div className="flex items-center gap-2 bg-rose-light/40 border border-rose/20 rounded-2xl px-4 py-2.5">
            <span className="material-symbols-outlined text-rose text-[18px]" aria-hidden="true">warning</span>
            <p className="text-rose text-[11px] font-medium leading-relaxed">
              This takes today past your {formatWhole(dailyLimit)} daily limit
              ({formatWhole(todaySpend)} spent so far). It still saves.
            </p>
          </div>
        )}
      </div>

      {/* Keypad + save */}
      <div className="bg-white/80 backdrop-blur-xl border-t border-black/[0.05] rounded-t-[32px] px-6 pt-3 pb-3 shadow-soft">
        <div className="grid grid-cols-3 gap-x-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handleKeypad(num.toString())} className="py-2 flex items-center justify-center text-[22px] font-medium tabular-nums text-premium-charcoal rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">
              {num}
            </button>
          ))}
          <button onClick={() => handleKeypad('.')} aria-label="Decimal point" className="py-2 flex items-center justify-center text-[22px] font-medium tabular-nums text-premium-charcoal rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">.</button>
          <button onClick={() => handleKeypad('0')} className="py-2 flex items-center justify-center text-[22px] font-medium tabular-nums text-premium-charcoal rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">0</button>
          <button onClick={() => handleKeypad('backspace')} aria-label="Delete the last digit" className="py-2 flex items-center justify-center text-muted-taupe rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">backspace</span>
          </button>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <label className="flex items-center gap-2 shrink-0 select-none cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={saveAndAdd}
              aria-labelledby="save-and-add-label"
              onClick={() => setSaveAndAdd(p => !p)}
              className={`relative w-9 h-5 rounded-full transition-colors ${saveAndAdd ? 'bg-sage' : 'bg-black/10'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${saveAndAdd ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span id="save-and-add-label" onClick={() => setSaveAndAdd(p => !p)} className="text-[12px] text-muted-taupe font-medium leading-tight">Add<br />another</span>
          </label>
          <button
            onClick={handleSave}
            disabled={numAmount <= 0 || saving}
            className="flex-1 bg-sage text-white py-3.5 rounded-[20px] text-[16px] font-semibold shadow-soft flex items-center justify-center gap-2 hover:bg-sage/90 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{saveAndAdd ? 'add' : 'check'}</span>
            {saveAndAdd ? 'Save and add another' : 'Save entry'}
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-[calc(7rem_+_var(--sab))] left-1/2 -translate-x-1/2 bg-premium-charcoal text-white px-6 py-3 rounded-full shadow-xl z-50 flex items-center gap-2">
          <span className="material-symbols-outlined text-sage text-[20px]" aria-hidden="true">check_circle</span>
          <span className="text-[13px] font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
};

export default NewEntry;
