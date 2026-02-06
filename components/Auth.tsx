import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { FloatingLeaf, RangoliCorner, LotusFlower, Paisley } from './SplashScreen';

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
              return "Password is too weak. It should be at least 6 characters.";
          case 'auth/invalid-email':
              return "Please enter a valid email address.";
          case 'auth/too-many-requests':
              return "Too many failed attempts. Please try again later.";
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
        // Password validation as per specs
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!strongPasswordRegex.test(password)) {
           throw new Error("Password must be 8+ chars, include uppercase, lowercase, digit, and special char.");
        }
        await createUserWithEmailAndPassword(auth, email, password);
        onAuthSuccess?.('register');
      }
    } catch (err: any) {
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
      if (!email) {
          setError("Please enter your email address first.");
          return;
      }
      try {
          await sendPasswordResetEmail(auth, email);
          setResetSent(true);
          setError("");
      } catch (err: any) {
          setError(getErrorMessage(err.code, err.message));
      }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-[430px] mx-auto bg-zen-bg px-8 justify-center overflow-hidden">
      {/* Decorative eco & Indian elements */}
      <FloatingLeaf className="top-16 left-6 opacity-60" delay={0} />
      <FloatingLeaf className="top-24 right-8 opacity-40" delay={1.5} color="#A8B89E" />
      <FloatingLeaf className="bottom-32 left-10 opacity-50" delay={2.5} />
      <RangoliCorner className="absolute top-4 left-4 opacity-40" color="#8B9E82" />
      <RangoliCorner className="absolute top-4 right-4 opacity-40" color="#8B9E82" mirror />
      <Paisley className="absolute bottom-20 right-6 opacity-30" color="#C4A98E" />
      <Paisley className="absolute top-40 left-4 opacity-25" color="#A8B89E" flip />
      
      <div className="relative text-center mb-10">
        {/* Small lotus above logo */}
        <div className="flex justify-center mb-3">
          <LotusFlower size="sm" color="#E8A5A5" />
        </div>
        {/* WALL-E Robot Logo with Wealth Context */}
        <div className="relative inline-flex items-center justify-center mb-6">
          {/* Outer glow */}
          <div className="absolute inset-0 -m-2 rounded-full bg-sage/20 blur-lg animate-pulse" />
          
          {/* Main circle */}
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-sage to-sage/80 shadow-lg flex items-center justify-center">
            {/* Inner highlight */}
            <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
            
            {/* Robot eyes - WALL-E inspired */}
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
            
            {/* Small coin accent */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-400 shadow-md flex items-center justify-center border-2 border-white">
              <span className="text-amber-700 text-[10px] font-bold">₹</span>
            </div>
          </div>
        </div>
        
        <h1 className="text-premium-charcoal font-serif text-3xl font-semibold mb-2">
          WALL<span className="text-sage">·</span>E
        </h1>
        <p className="text-muted-taupe text-[15px]">Mindful Wealth Management</p>
      </div>

      <div className="relative bg-white rounded-[32px] p-8 shadow-soft border border-black/[0.02] overflow-hidden">
        {/* Corner decorations */}
        <RangoliCorner className="absolute -top-1 -left-1 opacity-30" color="#8B9E82" />
        <RangoliCorner className="absolute -top-1 -right-1 opacity-30" color="#8B9E82" mirror />
        <RangoliCorner className="absolute -bottom-1 -left-1 opacity-20 rotate-180" color="#C4A98E" mirror />
        <RangoliCorner className="absolute -bottom-1 -right-1 opacity-20 rotate-180" color="#C4A98E" />
        
        <h2 className="relative text-xl font-serif font-semibold text-premium-charcoal mb-6 text-center">
            {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        
        {error && (
            <div className="mb-4 p-3 bg-rose-light/40 border border-rose/20 rounded-xl text-rose text-xs font-medium leading-relaxed">
                {error}
            </div>
        )}

        {resetSent && (
            <div className="mb-4 p-3 bg-sage-light/40 border border-sage/20 rounded-xl text-sage text-xs font-medium leading-relaxed">
                Password recovery email sent.
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-muted-taupe uppercase tracking-wider mb-1.5 ml-2">Email</label>
            <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zen-bg rounded-2xl px-5 py-3.5 text-premium-charcoal text-sm outline-none focus:ring-1 focus:ring-sage border border-transparent focus:border-sage/30 transition-all"
                placeholder="you@example.com"
                required
            />
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
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-sage text-white py-4 rounded-2xl font-serif text-lg font-medium shadow-soft hover:bg-sage/90 active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-4">
            {isLogin && (
                <button onClick={handleResetPassword} className="text-[12px] text-muted-taupe hover:text-sage transition-colors">
                    Forgot Password?
                </button>
            )}
            
            <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted-taupe">{isLogin ? "New here?" : "Have an account?"}</span>
                <button 
                    onClick={() => { setIsLogin(!isLogin); setError(''); }}
                    className="text-[13px] font-semibold text-sage hover:underline"
                >
                    {isLogin ? "Create Account" : "Sign In"}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;