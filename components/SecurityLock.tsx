import React, { useState, useEffect, useRef } from 'react';
import { reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail, type MultiFactorResolver } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { isBiometricAvailable, isBiometricEnabled, authenticateBiometric, preloadBiometric } from '../utils/biometric';
import { isMfaRequiredError, mfaResolverFromError, resolveTotpSignIn, mfaErrorMessage } from '../services/mfa';
import { WallEEyes, FloatingLeaf, RangoliCorner, LotusFlower, MandalaDots, Diya } from './SplashScreen';

interface SecurityLockProps {
  onUnlock: () => void;
}

const SecurityLock: React.FC<SecurityLockProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Real TOTP second factor: set when reauth reports the account has 2FA
  const [totpResolver, setTotpResolver] = useState<MultiFactorResolver | null>(null);
  const [totpCode, setTotpCode] = useState('');

  // Device biometric unlock (native only, user-enabled in Self → Security)
  const [bioReady, setBioReady] = useState(false);
  const bioAutoTried = useRef(false);

  const tryBiometric = async () => {
    setError('');
    const ok = await authenticateBiometric('Unlock your wallet');
    if (ok) {
      // Unlock the instant the OS confirms — the audit log is a network
      // write and must never sit between the fingerprint and the app.
      onUnlock();
      void logAttempt(true, 'BIOMETRIC');
    }
  };

  useEffect(() => {
    let cancelled = false;
    // Load the native plugin immediately so the auto-prompt isn't
    // waiting on a dynamic import.
    preloadBiometric();
    (async () => {
      const uid = auth.currentUser?.uid;
      if (!uid || !isBiometricEnabled(uid)) return;
      const available = await isBiometricAvailable();
      if (cancelled || !available) return;
      setBioReady(true);
      // Prompt automatically once on lock — the natural "glance to unlock" flow
      if (!bioAutoTried.current) {
        bioAutoTried.current = true;
        tryBiometric();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const logAttempt = async (success: boolean, method: 'PASSWORD' | 'MFA' | 'BIOMETRIC') => {
      if (!auth.currentUser) return;
      try {
          await addDoc(collection(db, `users/${auth.currentUser.uid}/security_logs`), {
              type: success ? 'UNLOCK_SUCCESS' : 'UNLOCK_FAILURE',
              method,
              timestamp: serverTimestamp(),
              userAgent: navigator.userAgent
          });
      } catch (err) {
          console.warn("Failed to log security event", err);
      }
  };

  const handlePasswordUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;

    setLoading(true);
    setError('');
    setInfo('');

    try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);

        onUnlock();
        void logAttempt(true, 'PASSWORD');
    } catch (err: any) {
        if (isMfaRequiredError(err)) {
            // Password was correct — account has 2FA, ask for the TOTP code
            setTotpResolver(mfaResolverFromError(err));
            setError('');
        } else {
            void logAttempt(false, 'PASSWORD');
            setError("Incorrect password.");
            setPassword('');
        }
    } finally {
        setLoading(false);
    }
  };

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpResolver) return;
    setLoading(true);
    setError('');
    try {
        await resolveTotpSignIn(totpResolver, totpCode);
        onUnlock();
        void logAttempt(true, 'MFA');
    } catch (err: any) {
        void logAttempt(false, 'MFA');
        setError(mfaErrorMessage(err));
        setTotpCode('');
    } finally {
        setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
      if (!auth.currentUser?.email) return;
      try {
          await sendPasswordResetEmail(auth, auth.currentUser.email);
          setInfo(`Recovery email sent to ${auth.currentUser.email}`);
          setError('');
      } catch (err) {
          setError("Failed to send recovery email.");
      }
  };

  return (
    <div className="relative flex h-screen w-full flex-col max-w-[430px] mx-auto bg-zen-bg overflow-hidden items-center justify-center px-8">
      {/* Eco & Indian decorative elements - guardians of wealth */}
      <FloatingLeaf className="top-16 right-8 opacity-40" delay={0} />
      <FloatingLeaf className="top-32 left-6 opacity-30" delay={1.5} color="var(--sage-3)" />
      <FloatingLeaf className="bottom-24 right-6 opacity-35" delay={2.5} />
      <RangoliCorner className="absolute top-8 left-4 opacity-25" color="var(--sage-2)" />
      <RangoliCorner className="absolute top-8 right-4 opacity-25" color="var(--sage-2)" mirror />
      <RangoliCorner className="absolute bottom-16 left-4 opacity-20 rotate-180" color="var(--gold-1)" mirror />
      <RangoliCorner className="absolute bottom-16 right-4 opacity-20 rotate-180" color="var(--gold-1)" />
      <MandalaDots className="absolute top-24 right-10 opacity-15" />
      <MandalaDots className="absolute bottom-32 left-8 opacity-15" />
      <LotusFlower className="absolute top-28 left-8 opacity-30" size="sm" />
      <Diya className="absolute bottom-24 left-12 opacity-40" />
      
      <div className="relative text-center mb-8">
        {/* Wall-ette Guard Mode */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center shadow-lg animate-pulse">
            <WallEEyes size="md" expression="sleepy" />
          </div>
          {/* Lock badge */}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center border-2 border-sage-light">
            <span className="material-symbols-outlined text-sage text-[16px]">lock</span>
          </div>
        </div>
        <h1 className="text-premium-charcoal font-serif text-2xl font-semibold mb-2">Session Locked</h1>
        <p className="text-muted-taupe text-[14px] leading-relaxed max-w-[280px] mx-auto">
          For your security, please verify your identity to continue.
        </p>
        <p className="text-[10px] text-muted-taupe/50 mt-2 italic">"I'm guarding your finances!"</p>
      </div>

      <div className="w-full bg-white rounded-[32px] p-8 shadow-soft border border-black/[0.02]">
        {totpResolver ? (
        <form onSubmit={handleTotpVerify}>
            {error && <div className="mb-4 text-center text-rose text-xs font-medium">{error}</div>}
            <p className="text-center text-[12px] text-muted-taupe mb-4">
                Enter the 6-digit code from your authenticator app
            </p>
            <div className="mb-6">
                <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full text-center bg-zen-bg rounded-2xl px-5 py-4 text-premium-charcoal text-xl tracking-[0.5em] font-mono outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30 transition-all placeholder:tracking-normal placeholder:text-base placeholder:font-sans"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                />
            </div>
            <button
                type="submit"
                disabled={loading || totpCode.length < 6}
                className="w-full bg-sage text-white py-4 rounded-2xl font-serif text-lg font-medium shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
                {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button
                type="button"
                onClick={() => { setTotpResolver(null); setTotpCode(''); setError(''); setPassword(''); }}
                className="w-full text-muted-taupe py-2 text-xs font-medium uppercase tracking-wider hover:text-premium-charcoal"
            >
                Back to Password
            </button>
        </form>
        ) : (
        <form onSubmit={handlePasswordUnlock}>
            {error && <div className="mb-4 text-center text-rose text-xs font-medium">{error}</div>}
            {info && <div className="mb-4 text-center text-sage text-xs font-medium">{info}</div>}

            <div className="mb-4">
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-center bg-zen-bg rounded-2xl px-5 py-4 text-premium-charcoal text-lg tracking-widest outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30 transition-all placeholder:tracking-normal placeholder:text-base"
                    placeholder="Enter Password"
                    autoFocus
                />
            </div>

            <div className="flex justify-end mb-6">
                <button type="button" onClick={handleForgotPassword} className="text-[11px] text-muted-taupe hover:text-sage font-medium tracking-wide">
                    Forgot Password?
                </button>
            </div>

            <button
                type="submit"
                disabled={loading || password.length === 0}
                className="w-full bg-sage text-white py-4 rounded-2xl font-serif text-lg font-medium shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Verifying...' : 'Unlock Wallet'}
            </button>

            {bioReady && (
                <>
                    <div className="relative flex items-center gap-2 py-4">
                        <div className="h-px bg-black/5 flex-1"></div>
                        <span className="text-[10px] text-muted-taupe uppercase tracking-widest">Or</span>
                        <div className="h-px bg-black/5 flex-1"></div>
                    </div>
                    <button
                        type="button"
                        onClick={tryBiometric}
                        className="w-full bg-white border border-sage-border text-premium-charcoal py-3 rounded-2xl font-serif text-base font-medium shadow-sm hover:bg-sage-light/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px] text-sage">fingerprint</span>
                        Unlock with Biometrics
                    </button>
                </>
            )}
        </form>
        )}

        <div className="mt-6 text-center border-t border-black/5 pt-4">
            <button 
                onClick={() => auth.signOut()}
                className="text-xs text-rose font-medium uppercase tracking-wider hover:text-rose/80 transition-colors"
            >
                Sign Out
            </button>
        </div>
      </div>
      
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-taupe/60 font-medium">
          Wall-ette Secured
        </p>
      </div>
    </div>
  );
};

export default SecurityLock;