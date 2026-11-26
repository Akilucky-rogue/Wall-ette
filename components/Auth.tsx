import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, type MultiFactorResolver } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { isMfaRequiredError, mfaResolverFromError, resolveTotpSignIn, mfaErrorMessage } from '../services/mfa';
import { googleErrorMessage, isGoogleCancel, signInWithGoogle } from '../services/googleSignIn';
import { sendResetLink } from '../services/passwordReset';
import { isEmailLike, suggestEmail } from '../utils/emailHints';
import { log } from '../utils/log';
import { ACCOUNT_EMAIL_FROM, PRIVACY_URL, TERMS_URL } from '../utils/site';
import { Mascot, TAGLINE, Wordmark } from './ui/Brand';
import { GoogleButton } from './ui/GoogleButton';
import { FloatingLeaf, Paisley, RangoliCorner } from './ui/Decor';

// Bump when the website's terms or privacy policy change materially —
// recorded with each registration as the version the user agreed to. The
// website's sign-up records the same (site/src/lib/auth-rules.ts).
const TERMS_VERSION = '2026-11-27';

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

  // Sign in with Google: an existing account signs in; a new one is created,
  // with the consent the note beside the button asks for recorded the same
  // way as an email sign-up's.
  const [googleBusy, setGoogleBusy] = useState(false);
  const handleGoogle = async () => {
    setError('');
    setGoogleBusy(true);
    try {
      const { credential, isNewUser } = await signInWithGoogle();
      if (isNewUser) {
        setDoc(doc(db, 'users', credential.user.uid), {
            termsAccepted: true,
            termsVersion: TERMS_VERSION,
            termsAcceptedAt: serverTimestamp(),
            termsAcceptedVia: 'google',
        }, { merge: true }).catch(() => log.warn('Consent record write failed'));
        onAuthSuccess?.('register');
      } else {
        onAuthSuccess?.('login');
      }
    } catch (err: any) {
      if (isMfaRequiredError(err)) {
        setTotpResolver(mfaResolverFromError(err));
        setError('');
      } else if (!isGoogleCancel(err)) {
        log.warn('Google sign-in failed:', err?.code ?? err?.message);
        setError(googleErrorMessage(err));
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const getErrorMessage = (code: string, message: string) => {
      switch (code) {
          case 'auth/invalid-credential':
              return isLogin 
                ? "Incorrect email or password. If you haven't signed up, please create an account." 
                : "Invalid credentials provided.";
          case 'auth/user-not-found':
              return "No account found with this email. Please sign up.";
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
      <FloatingLeaf className="top-16 left-6 opacity-60" />
      <FloatingLeaf className="top-24 right-8 opacity-40" color="var(--sage-3)" />
      <FloatingLeaf className="bottom-32 left-10 opacity-50" />
      <RangoliCorner className="absolute top-4 left-4 opacity-40" color="var(--sage-2)" />
      <RangoliCorner className="absolute top-4 right-4 opacity-40" color="var(--sage-2)" mirror />
      <Paisley className="absolute bottom-20 right-6 opacity-30" color="var(--gold-1)" />
      <Paisley className="absolute top-40 left-4 opacity-25" color="var(--sage-3)" flip />

      <div className="relative flex flex-col items-center text-center mb-8">
        <Mascot pose="welcome" height={128} />
        <h1 className="mt-5"><Wordmark height={34} /></h1>
        <p className="mt-2 text-muted-taupe text-[15px] font-medium">{TAGLINE}</p>
      </div>

      <div className="relative bg-white rounded-[32px] p-8 shadow-soft border border-black/[0.02] overflow-hidden">
        {/* Corner decorations */}
        <RangoliCorner className="absolute -top-1 -left-1 opacity-30" color="var(--sage-2)" />
        <RangoliCorner className="absolute -top-1 -right-1 opacity-30" color="var(--sage-2)" mirror />
        <RangoliCorner className="absolute -bottom-1 -left-1 opacity-20 rotate-180" color="var(--gold-1)" mirror />
        <RangoliCorner className="absolute -bottom-1 -right-1 opacity-20 rotate-180" color="var(--gold-1)" />

        <h2 className="relative text-xl font-display font-bold text-premium-charcoal mb-6 text-center">
            {totpResolver ? 'Two-factor verification' : resetMode ? 'Reset password' : isLogin ? 'Welcome back' : 'Create account'}
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
            className="w-full bg-sage text-white py-4 rounded-2xl text-lg font-semibold shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify and sign in'}
          </button>
          <button
            type="button"
            onClick={() => { setTotpResolver(null); setTotpCode(''); setError(''); }}
            className="w-full text-muted-taupe py-1 text-xs font-medium uppercase tracking-wider hover:text-premium-charcoal"
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
                className="w-full bg-white border border-sage-border text-premium-charcoal py-3 rounded-2xl text-[15px] font-semibold shadow-sm hover:bg-sage-light/30 active:scale-[0.98] transition-all disabled:opacity-50"
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
                <label htmlFor="reset-email" className="block text-[11px] font-bold text-muted-taupe uppercase tracking-wider mb-1.5 ml-2">Email</label>
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
                className="w-full bg-sage text-white py-4 rounded-2xl text-lg font-semibold shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={leaveReset}
            className="w-full text-muted-taupe py-1 text-xs font-medium uppercase tracking-wider hover:text-premium-charcoal"
          >
            Back to sign in
          </button>
        </div>
        ) : (
        <>
        <div className="space-y-3 mb-5">
          <GoogleButton label="Continue with Google" busy={googleBusy} disabled={loading} onClick={handleGoogle} />
          <p className="text-[11px] text-muted-taupe leading-relaxed text-center px-1">
            Continuing with Google signs you in, or creates your wallet the first time, and means you agree to the{' '}
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-sage font-semibold underline">Terms &amp; Conditions</a>{' '}
            and{' '}
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-sage font-semibold underline">Privacy policy</a>.
          </p>
          <div className="flex items-center gap-3 pt-1" aria-hidden="true">
            <span className="h-px flex-1 bg-premium-charcoal/[0.08]" />
            <span className="text-[10px] text-muted-taupe uppercase tracking-widest">or use email</span>
            <span className="h-px flex-1 bg-premium-charcoal/[0.08]" />
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-muted-taupe uppercase tracking-wider mb-1.5 ml-2">Email</label>
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
            <label className="block text-[11px] font-bold text-muted-taupe uppercase tracking-wider mb-1.5 ml-2">Password</label>
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
            disabled={loading || googleBusy || (!isLogin && !agreed)}
            className="w-full bg-sage text-white py-4 rounded-2xl text-lg font-semibold shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign in' : 'Sign up')}
          </button>
        </form>
        </>
        )}

        {!totpResolver && !resetMode && (
        <div className="mt-6 flex flex-col items-center gap-4">
            {isLogin && (
                <button
                    onClick={() => { setResetMode(true); setResetSent(false); setNoAccountFor(null); setError(''); }}
                    className="text-[12px] text-muted-taupe hover:text-sage transition-colors"
                >
                    Forgot password?
                </button>
            )}
            
            <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted-taupe">{isLogin ? "New here?" : "Have an account?"}</span>
                <button
                    onClick={() => { setIsLogin(!isLogin); setError(''); setAgreed(false); }}
                    className="text-[13px] font-semibold text-sage hover:underline"
                >
                    {isLogin ? "Create account" : "Sign in"}
                </button>
            </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default Auth;