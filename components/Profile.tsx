import React, { useState } from 'react';
import styles from './Profile.module.css';
import { AppScreen } from '../types';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { WallEEyes, FloatingLeaf, LotusFlower, MandalaDots, PottedPlant, RangoliCorner } from './SplashScreen';

interface ProfileProps {
  onNavigate: (screen: AppScreen) => void;
  onLogout?: () => void;
}

const Profile: React.FC<ProfileProps> = ({ onNavigate, onLogout }) => {
  const { user } = useAuth();
  const { 
      currency, 
      dailyLimit, 
      setDailyLimit, 
      mfaEnabled, 
      setMfaEnabled, 
      formatAmount, 
      lastLoginTime,
      convertToBase
  } = useWallet();

  const [limitInput, setLimitInput] = useState(dailyLimit > 0 ? (dailyLimit * 1).toString() : '');
  const [limitSaved, setLimitSaved] = useState(false);
  // Daily Limit is stored in base currency (INR). We should display it in selected currency, but for simplicity let's assume input is in Base or handle conversion.
  // Actually, keeping it simple: Input amount in Base Currency (INR) for now, or assume the input is in current currency and convert before save.
  // Let's do: Input in Current Currency.
  
  // Wait, formatAmount converts Base -> Display.
  // convertToBase converts Display -> Base.
  
  // We need to display the limit in current currency.
  // dailyLimit is in Base.
  const [displayLimit, setDisplayLimit] = useState('');
  
  // Init state on load
  React.useEffect(() => {
    setLimitInput(dailyLimit > 0 ? dailyLimit.toString() : '');
  }, [dailyLimit]);

  const handleSaveLimit = () => {
    let val = parseFloat(limitInput);
    if (limitInput.trim() === '' || isNaN(val)) {
      setDailyLimit(0);
      setLimitInput('');
      setLimitSaved(true);
      setTimeout(() => setLimitSaved(false), 1200);
      return;
    }
    if (val < 0) val = 0;
    setDailyLimit(val);
    setLimitInput(val === 0 ? '' : val.toString());
    setLimitSaved(true);
    setTimeout(() => setLimitSaved(false), 1200);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] mx-auto overflow-x-hidden pb-32 bg-zen-bg">
      {/* Eco & Indian decorative elements */}
      <FloatingLeaf className="top-24 right-6 opacity-40" delay={0.5} />
      <FloatingLeaf className="top-56 left-4 opacity-30" delay={2} color="#A8B89E" />
      <PottedPlant className="absolute bottom-40 left-6 opacity-40" />
      <MandalaDots className="absolute top-20 left-4 opacity-20" />
      <RangoliCorner className="absolute top-16 right-2 opacity-25" color="#C4A98E" mirror />
      
      <div className="flex items-center bg-zen-bg/80 backdrop-blur-md p-6 pb-2 justify-between sticky top-0 z-30">
        <button 
          onClick={() => onNavigate(AppScreen.DASHBOARD)}
          className="text-muted-taupe flex size-10 shrink-0 items-center justify-start hover:text-sage transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </button>
        <h2 className="text-premium-charcoal text-xl font-serif font-semibold tracking-tight flex-1 text-center">My Profile</h2>
        <div className="w-10"></div>
      </div>

      <div className="flex flex-col items-center py-8 px-6">
        {/* WALL-E Avatar with lotus wreath */}
        <div className="relative">
          {/* Lotus wreath decoration */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <LotusFlower size="sm" color="#E8A5A5" />
          </div>
          <div className="absolute top-1/2 -left-4 -translate-y-1/2 rotate-90">
            <LotusFlower size="sm" color="#D4B896" className="opacity-60" />
          </div>
          <div className="absolute top-1/2 -right-4 -translate-y-1/2 -rotate-90">
            <LotusFlower size="sm" color="#D4B896" className="opacity-60" />
          </div>
          
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center border-4 border-white shadow-lg">
              <WallEEyes size="lg" />
              {/* Verified badge with leaf */}
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-400 flex items-center justify-center border-2 border-white shadow-md">
                <span className="text-amber-700 text-xs font-bold">₹</span>
              </div>
          </div>
        </div>
        <h3 className="text-premium-charcoal font-serif text-xl font-semibold mt-4">{user?.email?.split('@')[0]}</h3>
        <p className="text-muted-taupe text-xs">{user?.email}</p>
        
        <div className="mt-6 flex gap-2">
            <div className="bg-white px-4 py-2 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center">
                <span className="text-[10px] text-muted-taupe uppercase tracking-wider">Last Login</span>
                <span className="text-xs font-semibold text-premium-charcoal">
                    {lastLoginTime ? lastLoginTime.toLocaleDateString('en-GB') + ' ' + lastLoginTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                </span>
            </div>
        </div>
      </div>

      <div className="px-6 space-y-6">
          {/* Security Section */}
          <section>
              <h4 className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-4 pl-1">Security</h4>
              <div className="bg-white p-5 rounded-3xl border border-black/[0.02] shadow-soft space-y-6">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className="bg-blue-zen-light text-blue-zen p-2 rounded-xl">
                              <span className="material-symbols-outlined text-[20px]">lock</span>
                          </div>
                          <div>
                              <p className="text-premium-charcoal font-serif font-medium text-[15px]">Multi-Factor Auth</p>
                              <p className="text-muted-taupe text-[10px]">Require 2FA code on unlock</p>
                          </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={mfaEnabled} 
                            onChange={() => setMfaEnabled(!mfaEnabled)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage"></div>
                      </label>
                  </div>

                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className="bg-rose-light text-rose p-2 rounded-xl">
                              <span className="material-symbols-outlined text-[20px]">remove_circle</span>
                          </div>
                          <div>
                              <p className="text-premium-charcoal font-serif font-medium text-[15px]">Daily Spend Limit</p>
                              <p className="text-muted-taupe text-[10px]">Alert on excess (Base Currency)</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor="daily-limit-input" className="sr-only">Daily spend limit</label>
                        <div className="relative flex items-center">
                          <input
                            id="daily-limit-input"
                            type="number"
                            min="0"
                            value={limitInput}
                            onChange={e => {
                              // Only allow numbers and empty string
                              const val = e.target.value;
                              if (/^\d*$/.test(val) || val === '') setLimitInput(val);
                              setLimitSaved(false);
                            }}
                            onBlur={handleSaveLimit}
                            placeholder="No Limit"
                            title="Daily spend limit"
                            aria-label="Daily spend limit"
                            className={`w-20 text-right bg-zen-bg border-none rounded-lg py-1.5 px-2 text-sm font-semibold text-premium-charcoal outline-none focus:ring-1 focus:ring-sage transition-colors ${limitSaved ? styles.limitSaved : ''}`}
                          />
                          {limitInput && (
                            <button
                              type="button"
                              aria-label="Clear daily limit"
                              className={`absolute right-1 text-muted-taupe hover:text-rose text-xs ${styles.clearButton}`}
                              tabIndex={0}
                              onClick={() => {
                                setLimitInput('');
                                setDailyLimit(0);
                                setLimitSaved(true);
                                setTimeout(() => setLimitSaved(false), 1200);
                              }}
                            >
                              ×
                            </button>
                          )}
                          {limitSaved && (
                            <span className="absolute left-1 text-sage text-xs" aria-live="polite" title="Saved">✔</span>
                          )}
                        </div>
                      </div>
                  </div>
              </div>
          </section>

          {/* Data Section */}
          <section>
              <h4 className="text-muted-taupe text-[11px] font-bold uppercase tracking-[0.2em] mb-4 pl-1">Data & Privacy</h4>
              <div className="bg-white p-5 rounded-3xl border border-black/[0.02] shadow-soft space-y-4">
                  <button 
                    onClick={() => onNavigate(AppScreen.EXPORT)}
                    className="w-full flex items-center justify-between group"
                  >
                      <div className="flex items-center gap-3">
                          <div className="bg-sand-light text-sand p-2 rounded-xl">
                              <span className="material-symbols-outlined text-[20px]">download</span>
                          </div>
                          <div className="text-left">
                              <p className="text-premium-charcoal font-serif font-medium text-[15px] group-hover:text-sage transition-colors">Export Data</p>
                              <p className="text-muted-taupe text-[10px]">CSV, JSON reports</p>
                          </div>
                      </div>
                      <span className="material-symbols-outlined text-muted-taupe text-[20px]">chevron_right</span>
                  </button>
              </div>
          </section>

          <button 
            onClick={() => onLogout ? onLogout() : auth.signOut()}
            className="w-full mt-4 bg-white border border-rose/20 text-rose py-4 rounded-3xl font-serif font-medium shadow-sm hover:bg-rose-light/20 transition-all flex items-center justify-center gap-2"
          >
              <span className="material-symbols-outlined">logout</span>
              Sign Out
          </button>
      </div>
      
      <div className="mt-12 text-center">
        <p className="text-[10px] text-muted-taupe uppercase tracking-widest opacity-50">WALL-E Version 1.0.0</p>
      </div>
    </div>
  );
};

export default Profile;