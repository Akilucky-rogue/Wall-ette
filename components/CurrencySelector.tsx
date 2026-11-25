import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '../context/WalletContext';
import { currencyChoices, currencyName, getSymbol, POPULAR_CURRENCIES } from '../utils/currencyUtils';
import { tick } from '../utils/haptics';

/**
 * The currency amounts are shown in: any of the ~160 the rate service knows.
 * A pill that opens a searchable list (a sheet on phones, a dialog on wide
 * screens). Amounts stay saved in INR; only the display changes.
 */
const CurrencySelector: React.FC<{ variant?: 'pill' | 'field' }> = ({ variant = 'pill' }) => {
  const { currency, setCurrency, exchangeRates } = useWallet();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const choices = useMemo(() => currencyChoices(exchangeRates), [exchangeRates]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return choices;
    return choices.filter(c => c.toLowerCase().includes(q) || currencyName(c).toLowerCase().includes(q) || getSymbol(c).toLowerCase() === q);
  }, [choices, query]);
  const popular = query ? [] : shown.filter(c => POPULAR_CURRENCIES.includes(c));
  const rest = query ? shown : shown.filter(c => !POPULAR_CURRENCIES.includes(c));
  const onlyFallback = choices.length <= 4;

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => { setOpen(false); setQuery(''); buttonRef.current?.focus(); };
  const pick = (code: string) => { if (code !== currency) tick(); setCurrency(code); close(); };

  const rateLine = (code: string) => {
    const r = exchangeRates[code];
    if (!r || code === 'INR') return null;
    // "1 USD = ₹92.59": what one unit costs in rupees.
    const inr = 1 / r;
    return `1 ${code} = ₹${inr >= 100 ? Math.round(inr).toLocaleString('en-IN') : inr.toFixed(inr >= 1 ? 2 : 4)}`;
  };

  const Row = ({ code }: { code: string }) => (
    <li>
      <button
        onClick={() => pick(code)}
        aria-pressed={code === currency}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left rounded-2xl transition-colors ${code === currency ? 'bg-sage-light' : 'hover:bg-zen-bg'}`}
      >
        <span className="w-10 h-10 rounded-2xl bg-white shadow-soft flex items-center justify-center text-[14px] font-semibold text-premium-charcoal shrink-0 tabular-nums">
          {getSymbol(code).length <= 3 ? getSymbol(code) : code.slice(0, 1)}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold text-premium-charcoal">{code}</span>
          <span className="block text-[12px] text-muted-taupe truncate">{currencyName(code)}</span>
        </span>
        <span className="text-[11px] text-muted-taupe tabular-nums shrink-0">{rateLine(code)}</span>
        {code === currency && <span className="material-symbols-outlined icon-fill text-sage text-[20px]" aria-hidden="true">check_circle</span>}
      </button>
    </li>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Show amounts in ${currencyName(currency)}. Change currency`}
        className={variant === 'pill'
          ? 'flex items-center gap-1.5 bg-white border border-premium-charcoal/[0.08] rounded-full px-3 py-1.5 shadow-sm hover:bg-white/80 transition-all min-w-[64px] min-h-[40px]'
          : 'flex items-center gap-2 bg-zen-bg shadow-pressed rounded-xl pl-3 pr-2 py-2 min-h-[40px]'}
      >
        <span className="text-[12px] font-bold text-premium-charcoal">{currency}</span>
        <span className="material-symbols-outlined text-[16px] text-muted-taupe" aria-hidden="true">expand_more</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center bg-premium-charcoal/25 backdrop-blur-[2px]" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="currency-title"
            onClick={e => e.stopPropagation()}
            className="w-full md:w-[440px] max-h-[82vh] md:max-h-[72vh] flex flex-col bg-white rounded-t-[32px] md:rounded-[32px] shadow-float pb-[var(--sab)] md:pb-0 motion-safe:animate-slide-up"
          >
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between gap-3">
                <h3 id="currency-title" className="font-serif text-[20px] font-semibold text-premium-charcoal">Show amounts in</h3>
                <button onClick={close} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-taupe hover:bg-zen-bg" aria-label="Close">
                  <span className="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
                </button>
              </div>
              <p className="text-[12px] text-muted-taupe mt-1 leading-snug">
                Amounts are saved in rupees and converted at live rates.{onlyFallback ? ' More currencies appear once rates load online.' : ''}
              </p>
              <label className="mt-3 flex items-center gap-2 bg-zen-bg shadow-pressed rounded-2xl px-3 py-2.5">
                <span className="material-symbols-outlined text-[20px] text-muted-taupe" aria-hidden="true">search</span>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name, code or symbol"
                  aria-label="Search currencies"
                  className="flex-1 bg-transparent outline-none text-[14px] text-premium-charcoal placeholder:text-muted-taupe"
                />
              </label>
            </div>
            <div className="overflow-y-auto px-2 pb-4">
              {popular.length > 0 && (
                <>
                  <p className="px-4 pt-1 pb-1 text-[12px] font-semibold text-muted-taupe">Common</p>
                  <ul>{popular.map(c => <Row key={c} code={c} />)}</ul>
                </>
              )}
              {rest.length > 0 && (
                <>
                  {!query && <p className="px-4 pt-3 pb-1 text-[12px] font-semibold text-muted-taupe">All currencies</p>}
                  <ul>{rest.map(c => <Row key={c} code={c} />)}</ul>
                </>
              )}
              {shown.length === 0 && <p className="px-4 py-6 text-[13px] text-muted-taupe text-center">No currency matches "{query}".</p>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default CurrencySelector;
