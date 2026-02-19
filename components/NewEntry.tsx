import React, { useState } from 'react';
import { AppScreen, TransactionType } from '../types';
import { getSymbol } from '../currencyUtils';
import { useWallet } from '../context/WalletContext';
import { FloatingLeaf, Sprout, RangoliCorner, Diya } from './SplashScreen';

interface NewEntryProps {
  onNavigate: (screen: AppScreen) => void;
}

const NewEntry: React.FC<NewEntryProps> = ({ onNavigate }) => {
  const { currency, addTransaction, convertToBase } = useWallet();
  const [amount, setAmount] = useState('0.00');
  const [note, setNote] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleKeypad = (val: string) => {
    if (val === 'backspace') {
      if (amount.length === 1 || (amount.length === 2 && amount.startsWith('0') && !amount.includes('.'))) {
          setAmount('0.00');
      } else {
          setAmount(prev => prev.length > 0 ? prev.slice(0, -1) : '0.00');
      }
    } else {
      if (amount === '0.00') {
          if (val === '.') setAmount('0.');
          else setAmount(val);
      } else {
          // Prevent multiple decimals
          if (val === '.' && amount.includes('.')) return;
          setAmount(prev => prev + val);
      }
    }
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    // Convert display currency amount to base currency (INR) for consistent storage
    const amountInBase = convertToBase(numAmount);

    const success = await addTransaction({
        id: `txn-${Date.now()}`,
        amount: amountInBase,
        type: type,
        category: category || 'Uncategorized',
        date: selectedDate.toISOString(),
        note: note,
        merchant: type === TransactionType.EXPENSE ? (note || 'Unknown Merchant') : 'Income Source'
    });

    if (success) {
      onNavigate(AppScreen.DASHBOARD);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col max-w-[430px] mx-auto bg-zen-bg overflow-hidden">
      {/* Eco decorative elements */}
      <FloatingLeaf className="top-20 right-5 opacity-35" delay={0.3} />
      <Sprout className="absolute top-32 left-4 opacity-40" />
      <RangoliCorner className="absolute bottom-40 right-2 opacity-20" color="#C4A98E" mirror />
      
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

      <div className="flex-1 overflow-y-auto px-6 pt-4 flex flex-col gap-8 pb-4">
        <div className="text-center py-6 relative">
          {/* Mini diya for prosperity */}
          <div className="absolute top-4 right-8">
            <Diya className="opacity-50" />
          </div>
          <p className="text-muted-taupe text-[11px] font-medium uppercase tracking-[0.2em] mb-3">Amount</p>
          <div className="flex items-center justify-center gap-1">
            <span className="text-muted-taupe font-serif text-3xl mb-2">{getSymbol(currency)}</span>
            <span className="text-premium-charcoal font-serif text-[56px] leading-none">{amount}</span>
          </div>
        </div>

        <div className="bg-white/50 p-1.5 rounded-full flex gap-1 border border-black/[0.03] shadow-soft">
          <button 
            onClick={() => setType(TransactionType.EXPENSE)}
            className={`flex-1 py-3 px-4 rounded-full text-[13px] font-semibold tracking-wide flex items-center justify-center gap-2 transition-all ${type === TransactionType.EXPENSE ? 'bg-rose-light text-rose' : 'text-muted-taupe hover:bg-white'}`}
          >
            <span className="material-symbols-outlined text-sm font-bold">arrow_downward</span>
            Expense
          </button>
          <button 
            onClick={() => setType(TransactionType.INCOME)}
            className={`flex-1 py-3 px-4 rounded-full text-[13px] font-semibold tracking-wide flex items-center justify-center gap-2 transition-all ${type === TransactionType.INCOME ? 'bg-sage-light text-sage' : 'text-muted-taupe hover:bg-white'}`}
          >
            <span className="material-symbols-outlined text-sm font-bold">arrow_upward</span>
            Income
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-[24px] p-4 flex items-center gap-4 shadow-soft border border-black/[0.01]">
            <div className="bg-sage-light text-sage p-2.5 rounded-2xl">
              <span className="material-symbols-outlined text-[20px]">category</span>
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-taupe font-bold">Category</p>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-transparent border-none p-0 focus:ring-0 text-premium-charcoal text-[15px] font-serif font-semibold outline-none appearance-none"
                title="Category"
                aria-label="Category"
              >
                <option value="" disabled>Select Category</option>
                <option value="Groceries">Groceries</option>
                <option value="Transport">Transport</option>
                <option value="Housing">Housing</option>
                <option value="Dining">Dining</option>
                <option value="Health">Health</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Salary">Salary</option>
                <option value="Freelance">Freelance</option>
                <option value="Investment">Investment</option>
              </select>
            </div>
            <span className="material-symbols-outlined text-muted-taupe opacity-40">expand_more</span>
          </div>

          <div 
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="bg-white rounded-[24px] p-4 flex items-center gap-4 shadow-soft border border-black/[0.01] cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="bg-rose-light text-rose p-2.5 rounded-2xl">
              <span className="material-symbols-outlined text-[20px]">calendar_today</span>
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-taupe font-bold">Date</p>
              <p className="text-premium-charcoal text-[15px] font-serif font-semibold">
                {selectedDate.toLocaleDateString('en-GB')}
              </p>
            </div>
            <span className="material-symbols-outlined text-muted-taupe opacity-40">expand_more</span>
          </div>

          {showDatePicker && (
            <div className="bg-white rounded-[24px] p-6 shadow-soft border border-black/[0.01] space-y-4">
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-taupe font-bold">Quick Select</p>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { setSelectedDate(new Date()); setShowDatePicker(false); }}
                    className="bg-sage-light text-sage py-2 rounded-lg text-[13px] font-semibold hover:bg-sage hover:text-white transition-colors"
                  >
                    Today
                  </button>
                  <button 
                    onClick={() => { 
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      setSelectedDate(yesterday);
                      setShowDatePicker(false);
                    }}
                    className="bg-sage-light text-sage py-2 rounded-lg text-[13px] font-semibold hover:bg-sage hover:text-white transition-colors"
                  >
                    Yesterday
                  </button>
                  <button 
                    onClick={() => { 
                      const lastWeek = new Date();
                      lastWeek.setDate(lastWeek.getDate() - 7);
                      setSelectedDate(lastWeek);
                      setShowDatePicker(false);
                    }}
                    className="bg-sage-light text-sage py-2 rounded-lg text-[13px] font-semibold hover:bg-sage hover:text-white transition-colors"
                  >
                    Last Week
                  </button>
                  <button 
                    onClick={() => { 
                      const lastMonth = new Date();
                      lastMonth.setMonth(lastMonth.getMonth() - 1);
                      setSelectedDate(lastMonth);
                      setShowDatePicker(false);
                    }}
                    className="bg-sage-light text-sage py-2 rounded-lg text-[13px] font-semibold hover:bg-sage hover:text-white transition-colors"
                  >
                    Last Month
                  </button>
                </div>
              </div>
              <div className="border-t border-black/5 pt-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-taupe font-bold mb-3">Custom Date</p>
                <input 
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    setSelectedDate(new Date(e.target.value + 'T00:00:00'));
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-sage-border focus:outline-none focus:ring-2 focus:ring-sage text-premium-charcoal font-serif"
                  title="Custom date"
                  placeholder="Select date"
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
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl border-t border-black/[0.05] rounded-t-[40px] px-8 pt-8 pb-10 shadow-soft">
        <div className="grid grid-cols-3 gap-y-2 gap-x-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handleKeypad(num.toString())} className="h-14 flex items-center justify-center text-2xl font-serif text-premium-charcoal rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">
              {num}
            </button>
          ))}
          <button onClick={() => handleKeypad('.')} className="h-14 flex items-center justify-center text-2xl font-serif text-premium-charcoal rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">.</button>
          <button onClick={() => handleKeypad('0')} className="h-14 flex items-center justify-center text-2xl font-serif text-premium-charcoal rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">0</button>
          <button onClick={() => handleKeypad('backspace')} className="h-14 flex items-center justify-center text-muted-taupe rounded-2xl active:bg-sage-light/50 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-[24px]">backspace</span>
          </button>
        </div>
        <button 
            onClick={handleSave}
            className="w-full mt-6 bg-sage text-white py-4 rounded-[24px] font-serif text-lg font-semibold shadow-soft flex items-center justify-center gap-2 hover:bg-sage/90 transition-colors"
        >
          Save Transaction
        </button>
      </div>
    </div>
  );
};

export default NewEntry;