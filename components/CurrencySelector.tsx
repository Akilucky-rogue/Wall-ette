import React, { useState, useRef, useEffect } from 'react';
import { CURRENCIES } from '../currencyUtils';
import { useWallet } from '../context/WalletContext';

import styles from './Dashboard.module.css';

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
                className={`flex items-center gap-2 bg-white border-2 border-sage rounded-full px-5 py-2 shadow-lg hover:bg-sage-light/40 transition-all text-lg font-bold text-premium-charcoal ${styles['min-w-currency']} ${styles['min-h-currency']}`}
            >
                <span className="text-lg font-bold text-premium-charcoal">{currency}</span>
                <span className="material-symbols-outlined text-[20px] text-sage">expand_more</span>
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl border border-black/5 py-1 w-24 z-50 animate-slide-up">
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