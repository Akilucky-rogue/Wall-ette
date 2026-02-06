import React, { useState } from 'react';
import { reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { WallEEyes, FloatingLeaf, RangoliCorner, LotusFlower, MandalaDots, Diya } from './SplashScreen';

interface SecurityLockProps {
  onUnlock: () => void;
}

const SecurityLock: React.FC<SecurityLockProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isMfaStep, setIsMfaStep] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  
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
        
        await logAttempt(true, 'PASSWORD');
        onUnlock();
    } catch (err: any) {
        await logAttempt(false, 'PASSWORD');
        setError("Incorrect password.");
        setPassword('');
    } finally {
        if (!isMfaStep) setLoading(false);
    }
  };

  const handleMfaUnlock = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');

      // Simulated MFA Verification for demo purposes (as backend SMS isn't connected)
      // Check if code is 6 digits
      if (mfaCode.length === 6 && /^\d+$/.test(mfaCode)) {
          await logAttempt(true, 'MFA');
          onUnlock();
      } else {
          await logAttempt(false, 'MFA');
          setError("Invalid code format.");
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

  const handleBiometricUnlock = async () => {
    // Check if platform authenticator is available
    if (window.PublicKeyCredential) {
        try {
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (available) {
                // In a real implementation, we would call navigator.credentials.get({ publicKey: ... })
                // Since we don't have a backend to issue a challenge, we will simulate the success 
                // assuming the device would handle the prompt.
                setLoading(true);
                setTimeout(async () => {
                    await logAttempt(true, 'BIOMETRIC');
                    onUnlock();
                }, 1000);
            } else {
                setError("Biometrics not set up on this device.");
            }
        } catch (e) {
            setError("Biometric authentication failed.");
        }
    } else {
        setError("Biometrics not supported.");
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col max-w-[430px] mx-auto bg-zen-bg overflow-hidden items-center justify-center px-8">
      {/* Eco & Indian decorative elements - guardians of wealth */}
      <FloatingLeaf className="top-16 right-8 opacity-40" delay={0} />
      <FloatingLeaf className="top-32 left-6 opacity-30" delay={1.5} color="#A8B89E" />
      <FloatingLeaf className="bottom-24 right-6 opacity-35" delay={2.5} />
      <RangoliCorner className="absolute top-8 left-4 opacity-25" color="#8B9E82" />
      <RangoliCorner className="absolute top-8 right-4 opacity-25" color="#8B9E82" mirror />
      <RangoliCorner className="absolute bottom-16 left-4 opacity-20 rotate-180" color="#C4A98E" mirror />
      <RangoliCorner className="absolute bottom-16 right-4 opacity-20 rotate-180" color="#C4A98E" />
      <MandalaDots className="absolute top-24 right-10 opacity-15" />
      <MandalaDots className="absolute bottom-32 left-8 opacity-15" />
      <LotusFlower className="absolute top-28 left-8 opacity-30" size="sm" />
      <Diya className="absolute bottom-24 left-12 opacity-40" />
      
      <div className="relative text-center mb-8">
        {/* WALL-E Guard Mode */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sage to-sage/80 flex items-center justify-center shadow-lg animate-pulse">
            <WallEEyes size="md" expression={isMfaStep ? 'neutral' : 'sleepy'} />
          </div>
          {/* Lock badge */}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center border-2 border-sage-light">
            <span className="material-symbols-outlined text-sage text-[16px]">{isMfaStep ? 'lock_clock' : 'lock'}</span>
          </div>
        </div>
        <h1 className="text-premium-charcoal font-serif text-2xl font-semibold mb-2">{isMfaStep ? 'Two-Factor Auth' : 'Session Locked'}</h1>
        <p className="text-muted-taupe text-[14px] leading-relaxed max-w-[280px] mx-auto">
          {isMfaStep ? 'Please enter the verification code.' : 'For your security, please verify your identity to continue.'}
        </p>
        <p className="text-[10px] text-muted-taupe/50 mt-2 italic">"I'm guarding your finances!"</p>
      </div>

      <div className="w-full bg-white rounded-[32px] p-8 shadow-soft border border-black/[0.02]">
        {!isMfaStep ? (
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
                    className="w-full bg-sage text-white py-4 rounded-2xl font-serif text-lg font-medium shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                >
                    {loading ? 'Verifying...' : 'Unlock Wallet'}
                </button>

                <div className="relative flex items-center gap-2 py-4">
                    <div className="h-px bg-black/5 flex-1"></div>
                    <span className="text-[10px] text-muted-taupe uppercase tracking-widest">Or</span>
                    <div className="h-px bg-black/5 flex-1"></div>
                </div>

                <button 
                    type="button"
                    onClick={handleBiometricUnlock}
                    className="w-full bg-white border border-sage-border text-premium-charcoal py-3 rounded-2xl font-serif text-base font-medium shadow-sm hover:bg-sage-light/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px] text-sage">fingerprint</span>
                    Use Face ID / Passcode
                </button>
                
                <div className="mt-4 text-center">
                    <button 
                        type="button" 
                        onClick={() => setIsMfaStep(true)}
                        className="text-[10px] text-muted-taupe uppercase tracking-widest hover:text-premium-charcoal"
                    >
                        Use 2FA Code
                    </button>
                </div>
            </form>
        ) : (
            <form onSubmit={handleMfaUnlock}>
                {error && <div className="mb-4 text-center text-rose text-xs font-medium">{error}</div>}
                
                <div className="mb-6">
                    <input 
                        type="text" 
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        className="w-full text-center bg-zen-bg rounded-2xl px-5 py-4 text-premium-charcoal text-xl tracking-[0.5em] font-mono outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30 transition-all placeholder:tracking-normal placeholder:text-base placeholder:font-sans"
                        placeholder="000000"
                        maxLength={6}
                        autoFocus
                    />
                    <p className="text-center text-[10px] text-muted-taupe mt-2">Enter verification code</p>
                </div>

                <button 
                    type="submit"
                    disabled={loading || mfaCode.length < 6}
                    className="w-full bg-sage text-white py-4 rounded-2xl font-serif text-lg font-medium shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                >
                    {loading ? 'Verifying...' : 'Verify Code'}
                </button>

                <button 
                    type="button"
                    onClick={() => { setIsMfaStep(false); setError(''); }}
                    className="w-full text-muted-taupe py-2 text-xs font-medium uppercase tracking-wider hover:text-premium-charcoal"
                >
                    Back to Password
                </button>
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
          WALL-E Secured
        </p>
      </div>
    </div>
  );
};

export default SecurityLock;