import React, { useState, useRef, useEffect } from 'react';
import { CURRENCIES } from '../currencyUtils';
import { useWallet } from '../context/WalletContext';

const CurrencySelector: React.FC = () => {
    const { currency, setCurrency } = useWallet();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 bg-white border border-black/5 rounded-full px-3 py-1.5 shadow-sm hover:bg-white/80 transition-all min-w-[64px] min-h-[40px]"
            >
                <span className="text-[12px] font-bold text-premium-charcoal">{currency}</span>
                <span className="material-symbols-outlined text-[16px] text-muted-taupe">expand_more</span>
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-xl border border-black/5 py-1 w-24 z-50 animate-slide-up">
                    {(Object.keys(CURRENCIES) as Array<keyof typeof CURRENCIES>).map((c) => (
                        <button 
                            key={c}
                            onClick={() => {
                                setCurrency(c);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-[14px] font-medium hover:bg-sage-light/30 ${currency === c ? 'text-sage font-bold' : 'text-premium-charcoal'}`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CurrencySelector;