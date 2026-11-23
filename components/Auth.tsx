import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, type MultiFactorResolver } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { isMfaRequiredError, mfaResolverFromError, resolveTotpSignIn, mfaErrorMessage } from '../services/mfa';
import { sendResetLink } from '../services/passwordReset';
import { isEmailLike, suggestEmail } from '../utils/emailHints';
import { log } from '../utils/log';
import { ACCOUNT_EMAIL_FROM, PRIVACY_URL, TERMS_URL } from '../utils/site';
import { FloatingLeaf, RangoliCorner, LotusFlower, Paisley } from './SplashScreen';

// Bump when terms.html / privacy.html change materially — recorded with
// each registration as the version the user agreed to.
const TERMS_VERSION = '2026-06-11';

export type AuthType = 'login' | 'register';

interface AuthProps {
  onAuthSuccess?: (type: AuthType) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Dedicated forgot-password panel + resend cooldown
  const [resetMode, setResetMode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // The address Firebase said has no account, shown until the email changes
  const [noAccountFor, setNoAccountFor] = useState<string | null>(null);
  // Typo hints wait until the field is left, so they don't flicker while typing
  const [emailChecked, setEmailChecked] = useState(false);
  const emailFix = emailChecked ? suggestEmail(email) : null;

  const changeEmail = (value: string) => {
    setEmail(value);
    setEmailChecked(false);
    setNoAccountFor(null);
  };
  // Consent to Terms & Privacy — required for sign-up only.
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // TOTP second factor at sign-in (accounts with 2FA enrolled)
  const [totpResolver, setTotpResolver] = useState<MultiFactorResolver | null>(null);
  const [totpCode, setTotpCode] = useState('');

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpResolver) return;
    setLoading(true);
    setError('');
    try {
      await resolveTotpSignIn(totpResolver, totpCode);
      onAuthSuccess?.('login');
    } catch (err: any) {
      setError(mfaErrorMessage(err));
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (code: string, message: string) => {
      switch (code) {
          case 'auth/invalid-credential':
              return isLogin 
                ? "Incorrect email or password. If you haven't signed up, please create an account." 
                : "Invalid credentials provided.";
          case 'auth/user-not-found':
              return "No account found with this email. Please Sign Up.";
          case 'auth/wrong-password':
              return "Incorrect password. Please try again.";
          case 'auth/email-already-in-use':
              return "Account already exists. We've switched you to Log In.";
          case 'auth/weak-password':
          case 'auth/password-does-not-meet-requirements':
              return "Password must be 8+ characters with an uppercase and a lowercase letter, a number and a symbol.";
          case 'auth/invalid-email':
              return "Please enter a valid email address.";
          case 'auth/too-many-requests':
              return "Too many failed attempts. Please try again later.";
          case 'auth/network-request-failed':
              return "You're offline. Connect to the internet and try again.";
          default:
              return message.replace('Firebase: ', '');
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess?.('login');
      } else {
        if (!agreed) {
           throw new Error("Please accept the Terms & Conditions and Privacy Policy to create an account.");
        }
        // Password validation as per specs
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!strongPasswordRegex.test(password)) {
           throw new Error("Password must be 8+ chars, include uppercase, lowercase, digit, and special char.");
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Record the consent with version + timestamp (audit trail).
        setDoc(doc(db, 'users', cred.user.uid), {
            termsAccepted: true,
            termsVersion: TERMS_VERSION,
            termsAcceptedAt: serverTimestamp(),
        }, { merge: true }).catch(() => log.warn('Consent record write failed'));
        onAuthSuccess?.('register');
      }
    } catch (err: any) {
      if (isMfaRequiredError(err)) {
          // Credentials correct — account has 2FA, ask for the authenticator code
          setTotpResolver(mfaResolverFromError(err));
          setError('');
      } else
      // UX Fix: Auto-switch to login if email exists
      if (err.code === 'auth/email-already-in-use') {
          // Do not log this as an error since it's a handled flow
          setIsLogin(true);
          setError("This email is already registered. Please log in.");
          setPassword(''); // Clear password to prompt re-entry/focus
      } else {
          console.error("Auth Error:", err.code, err.message);
          setError(getErrorMessage(err.code, err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
      const target = email.trim();
      setEmailChecked(true);
      if (!isEmailLike(target)) {
          setError("That doesn't look like an email address. Check it and try again.");
          return;
      }
      setLoading(true);
      setError('');
      setNoAccountFor(null);
      const result = await sendResetLink(target);
      setLoading(false);
      if (result.status === 'sent') {
          setResetSent(true);
          setCooldown(30);
      } else if (result.status === 'no-account') {
          // Firebase says so (email enumeration protection is off): the
          // address has a typo, or isn't the one used to sign up.
          setResetSent(false);
          setNoAccountFor(target);
      } else {
          setError(result.message);
      }
  };

  const leaveReset = () => {
      setResetMode(false);
      setResetSent(false);
      setNoAccountFor(null);
      setError('');
      setCooldown(0);
  };

  // Shown under every email field once it's been left: "Did you mean …?"
  const emailHint = emailFix && (
      <button
          type="button"
          onClick={() => changeEmail(emailFix)}
          className="mt-1.5 ml-2 text-left text-[11px] text-muted-taupe hover:text-premium-charcoal"
      >
          Did you mean <span className="font-semibold text-sage break-words">{emailFix}</span>?
      </button>
  );

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] mx-auto bg-zen-bg px-8 justify-center overflow-hidden">
      {/* Decorative eco & Indian elements */}
      <FloatingLeaf className="top-16 left-6 opacity-60" delay={0} />
      <FloatingLeaf className="top-24 right-8 opacity-40" delay={1.5} color="var(--sage-3)" />
      <FloatingLeaf className="bottom-32 left-10 opacity-50" delay={2.5} />
      <RangoliCorner className="absolute top-4 left-4 opacity-40" color="var(--sage-2)" />
      <RangoliCorner className="absolute top-4 right-4 opacity-40" color="var(--sage-2)" mirror />
      <Paisley className="absolute bottom-20 right-6 opacity-30" color="var(--gold-1)" />
      <Paisley className="absolute top-40 left-4 opacity-25" color="var(--sage-3)" flip />
      
      <div className="relative text-center mb-10">
        {/* Small lotus above logo */}
        <div className="flex justify-center mb-3">
          <LotusFlower size="sm" color="var(--rose-2)" />
        </div>
        {/* Wall-ette Robot Logo with Wealth Context */}
        <div className="relative inline-flex items-center justify-center mb-6">
          {/* Outer glow */}
          <div className="absolute inset-0 -m-2 rounded-full bg-sage/20 blur-lg animate-pulse" />
          
          {/* Main circle */}
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-sage to-sage/80 shadow-lg flex items-center justify-center">
            {/* Inner highlight */}
            <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
            
            {/* Robot eyes - Wall-ette inspired */}
            <div className="flex items-center gap-1">
              <div className="w-6 h-7 bg-premium-charcoal/90 rounded-md flex items-center justify-center shadow-inner relative overflow-hidden">
                <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white/40 rounded-full" />
                <div className="w-3 h-3 bg-sage-light rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-sage rounded-full" />
                </div>
              </div>
              <div className="w-6 h-7 bg-premium-charcoal/90 rounded-md flex items-center justify-center shadow-inner relative overflow-hidden">
                <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white/40 rounded-full" />
                <div className="w-3 h-3 bg-sage-light rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-sage rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <h1 className="text-premium-charcoal font-serif text-3xl font-semibold mb-2">
          Wall<span className="text-sage">·</span>ette
        </h1>
        <p className="text-muted-taupe text-[15px]">Mindful Wealth Management</p>
      </div>

      <div className="relative bg-white rounded-[32px] p-8 shadow-soft border border-black/[0.02] overflow-hidden">
        {/* Corner decorations */}
        <RangoliCorner className="absolute -top-1 -left-1 opacity-30" color="var(--sage-2)" />
        <RangoliCorner className="absolute -top-1 -right-1 opacity-30" color="var(--sage-2)" mirror />
        <RangoliCorner className="absolute -bottom-1 -left-1 opacity-20 rotate-180" color="var(--gold-1)" mirror />
        <RangoliCorner className="absolute -bottom-1 -right-1 opacity-20 rotate-180" color="var(--gold-1)" />
        
        <h2 className="relative text-xl font-serif font-semibold text-premium-charcoal mb-6 text-center">
            {totpResolver ? 'Two-Factor Verification' : resetMode ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        {error && (
            <div className="mb-4 p-3 bg-rose-light/40 border border-rose/20 rounded-xl text-rose text-xs font-medium leading-relaxed">
                {error}
            </div>
        )}

        {totpResolver ? (
        <form onSubmit={handleTotpSubmit} className="space-y-4">
          <p className="text-center text-[12px] text-muted-taupe">Enter the 6-digit code from your authenticator app</p>
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
          <button
            type="submit"
            disabled={loading || totpCode.length < 6}
            className="w-full bg-sage text-white py-4 rounded-2xl font-serif text-lg font-medium shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify & Sign In'}
          </button>
          <button
            type="button"
            onClick={() => { setTotpResolver(null); setTotpCode(''); setError(''); }}
            className="w-full text-muted-taupe py-1 text-[12px] font-medium hover:text-premium-charcoal"
          >
            Back
          </button>
        </form>
        ) : resetMode ? (
        <div className="space-y-4">
          {resetSent ? (
            <>
              <div className="p-4 bg-sage-light/40 border border-sage/20 rounded-2xl" role="status">
                <p className="text-[13px] text-premium-charcoal font-semibold mb-1">Check your email</p>
                <p className="text-[12px] text-muted-taupe leading-relaxed">
                  We've sent a link to set a new password to{' '}
                  <span className="font-semibold text-premium-charcoal break-words">{email.trim()}</span>.
                  It comes from <span className="break-words">{ACCOUNT_EMAIL_FROM}</span> and works for an hour.
                </p>
                <p className="text-[12px] text-muted-taupe leading-relaxed mt-2">
                  Nothing after a few minutes? Look in your spam folder.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={cooldown > 0 || loading}
                className="w-full bg-white border border-sage-border text-premium-charcoal py-3 rounded-2xl font-serif text-[15px] font-medium shadow-sm hover:bg-sage-light/30 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Email'}
              </button>
              <button
                type="button"
                onClick={() => { setResetSent(false); setCooldown(0); setError(''); }}
                className="w-full text-sage py-1 text-[12px] font-semibold hover:underline"
              >
                Use a different email
              </button>
            </>
          ) : (
            <>
              <p className="text-[12px] text-muted-taupe leading-relaxed text-center px-2">
                Enter the email you signed up with and we'll send you a link to set a new password.
              </p>
              <div>
                <label htmlFor="reset-email" className="block text-[12px] font-semibold text-muted-taupe mb-1.5 ml-2">Email</label>
                <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => changeEmail(e.target.value)}
                    onBlur={() => setEmailChecked(true)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleResetPassword(); } }}
                    className="w-full bg-zen-bg rounded-2xl px-5 py-3.5 text-premium-charcoal text-sm outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30 transition-all"
                    placeholder="you@example.com"
                    autoFocus
                />
                {emailHint}
              </div>
              {noAccountFor && (
                <div className="p-3 bg-rose-light/40 border border-rose/20 rounded-xl text-[12px] leading-relaxed" role="alert">
                  <p className="text-rose font-medium">
                    No Wall-ette account uses <span className="font-semibold break-words">{noAccountFor}</span>.
                  </p>
                  <p className="text-muted-taupe mt-1">Check the spelling, or try the email you signed up with.</p>
                  <button
                    type="button"
                    onClick={() => { leaveReset(); setIsLogin(false); setAgreed(false); }}
                    className="mt-2 text-sage font-semibold hover:underline"
                  >
                    Create an account with this email
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={loading || !email.includes('@')}
                className="w-full bg-sage text-white py-4 rounded-2xl font-serif text-lg font-medium shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={leaveReset}
            className="w-full text-muted-taupe py-1 text-[12px] font-medium hover:text-premium-charcoal"
          >
            Back to Sign In
          </button>
        </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-muted-taupe mb-1.5 ml-2">Email</label>
            <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => changeEmail(e.target.value)}
                onBlur={() => setEmailChecked(true)}
                className="w-full bg-zen-bg rounded-2xl px-5 py-3.5 text-premium-charcoal text-sm outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30 transition-all"
                placeholder="you@example.com"
                required
            />
            {emailHint}
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-muted-taupe mb-1.5 ml-2">Password</label>
            <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zen-bg rounded-2xl px-5 py-3.5 text-premium-charcoal text-sm outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30 transition-all"
                placeholder="••••••••"
                required
            />
          </div>
          
          {!isLogin && (
            <label className="flex items-start gap-2.5 px-1 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[var(--sage)] shrink-0"
              />
              <span className="text-[11px] text-muted-taupe leading-relaxed">
                I have read and agree to the{' '}
                <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-sage font-semibold underline" onClick={e => e.stopPropagation()}>
                  Terms &amp; Conditions
                </a>{' '}
                and{' '}
                <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-sage font-semibold underline" onClick={e => e.stopPropagation()}>
                  Privacy policy
                </a>.
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading || (!isLogin && !agreed)}
            className="w-full bg-sage text-white py-4 rounded-2xl font-serif text-lg font-medium shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>
        )}

        {!totpResolver && !resetMode && (
        <div className="mt-6 flex flex-col items-center gap-4">
            {isLogin && (
                <button
                    onClick={() => { setResetMode(true); setResetSent(false); setNoAccountFor(null); setError(''); }}
                    className="text-[12px] text-muted-taupe hover:text-sage transition-colors"
                >
                    Forgot Password?
                </button>
            )}
            
            <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted-taupe">{isLogin ? "New here?" : "Have an account?"}</span>
                <button
                    onClick={() => { setIsLogin(!isLogin); setError(''); setAgreed(false); }}
                    className="text-[13px] font-semibold text-sage hover:underline"
                >
                    {isLogin ? "Create Account" : "Sign In"}
                </button>
            </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default Auth;