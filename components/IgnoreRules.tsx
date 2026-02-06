import React from 'react';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { FloatingLeaf, RangoliCorner, Paisley } from './SplashScreen';

interface IgnoreRulesProps {
  onNavigate: (screen: AppScreen) => void;
}

const IgnoreRules: React.FC<IgnoreRulesProps> = ({ onNavigate }) => {
  const { ignoreRules, toggleIgnoreRule } = useWallet();

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col max-w-[430px] mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      {/* Eco decorative elements */}
      <FloatingLeaf className="top-24 right-5 opacity-35" delay={0.5} />
      <FloatingLeaf className="top-52 left-4 opacity-25" delay={1.8} color="#A8B89E" />
      <RangoliCorner className="absolute top-20 right-2 opacity-20" color="#C4A98E" mirror />
      <Paisley className="absolute bottom-40 left-6 opacity-25" flip />
      
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        <button 
          onClick={() => onNavigate(AppScreen.HISTORY)}
          className="text-muted-taupe flex size-10 shrink-0 items-center justify-start hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </button>
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">Ignore Rules</h2>
        <div className="flex w-10 items-center justify-end text-muted-taupe">
          <button className="flex items-center justify-center rounded-full h-10 w-10 bg-white/50 border border-black/5 hover:bg-white transition-colors">
            <span className="material-symbols-outlined text-[20px]">help_outline</span>
          </button>
        </div>
      </div>

      <div className="px-6 py-8">
        <h1 className="text-premium-charcoal font-serif text-[32px] leading-tight mb-3">Quiet Management</h1>
        <p className="text-muted-taupe text-[14px] leading-relaxed">Define which transactions should be excluded from your spending analytics and mindful budgets.</p>
      </div>

      <div className="px-6 space-y-4">
        {ignoreRules.map((rule) => (
          <div key={rule.id} className={`bg-white p-5 rounded-3xl border border-black/[0.02] shadow-soft flex items-center justify-between ${!rule.isActive ? 'opacity-70 grayscale-[0.5]' : ''} transition-all`}>
            <div className="flex items-center gap-4">
              <div className={`${rule.color === 'slate' ? 'bg-slate-100 text-slate-400' : `bg-${rule.color}-light/40 text-${rule.color}`} p-2.5 rounded-2xl`}>
                <span className="material-symbols-outlined text-[22px]">{rule.icon}</span>
              </div>
              <div>
                <p className="text-premium-charcoal font-serif font-semibold text-[15px]">{rule.name}</p>
                <p className="text-muted-taupe text-[10px] font-medium uppercase tracking-wide">{rule.description}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={rule.isActive} 
                onChange={() => toggleIgnoreRule(rule.id)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage"></div>
            </label>
          </div>
        ))}
      </div>

      <div className="px-6 py-12 flex flex-col items-center justify-center">
        <div className="w-12 h-0.5 bg-sage/10 rounded-full mb-4"></div>
        <p className="text-[10px] text-muted-taupe uppercase tracking-[0.3em] font-medium">End of rules</p>
      </div>

      <div className="fixed bottom-32 right-6 z-50">
        <button className="bg-sage text-white size-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform hover:bg-sage/90">
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      </div>
    </div>
  );
};

export default IgnoreRules;