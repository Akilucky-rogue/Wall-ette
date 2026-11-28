import React, { useEffect, useState } from 'react';
import { Mascot, TAGLINE, Wordmark } from './ui/Brand';
import { SplashGarden } from './ui/Decor';

export type SplashVariant = 'launch' | 'login' | 'register' | 'logout';

interface SplashScreenProps {
  onComplete: () => void;
  variant?: SplashVariant;
}

// What each moment says under the mascot. The launch splash shows the logo
// and the tagline; the others greet by name of the moment.
const COPY: Record<SplashVariant, { title?: string; line: string }> = {
  launch: { line: TAGLINE },
  login: { title: 'Welcome back', line: 'Opening your wallet' },
  register: { title: 'Welcome to Wall·ette', line: 'Setting up your wallet' },
  logout: { title: 'See you soon', line: 'Signing you out' },
};

// How long each one stays: the launch splash a little longer than the rest.
const TIMING: Record<SplashVariant, { text: number; fade: number; complete: number }> = {
  launch: { text: 300, fade: 2200, complete: 2700 },
  logout: { text: 200, fade: 1600, complete: 2100 },
  login: { text: 200, fade: 1500, complete: 2000 },
  register: { text: 200, fade: 1500, complete: 2000 },
};

/**
 * The moment between screens: on launch (Android), after signing in or up,
 * and on signing out. The mascot waves in the middle, kept clear of the
 * garden around the edges as the brand kit asks, with the logo or a greeting
 * under it.
 */
const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, variant = 'launch' }) => {
  const [phase, setPhase] = useState<'enter' | 'shown' | 'fade'>('enter');
  const timing = TIMING[variant];
  const copy = COPY[variant];

  useEffect(() => {
    const shown = setTimeout(() => setPhase('shown'), timing.text);
    const fade = setTimeout(() => setPhase('fade'), timing.fade);
    const done = setTimeout(() => onComplete(), timing.complete);
    return () => { clearTimeout(shown); clearTimeout(fade); clearTimeout(done); };
  }, [onComplete, timing.text, timing.fade, timing.complete]);

  const entering = phase === 'enter';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-zen-bg px-8 transition-opacity duration-500 ${
        phase === 'fade' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* The garden, around the edges (components/ui/Decor.tsx) */}
      <SplashGarden lamps={variant === 'launch'} />

      <div className={`relative transition-all duration-700 ease-out motion-reduce:transition-none ${entering ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}>
        <Mascot pose="welcome" height={184} />
      </div>

      <div className={`relative mt-7 flex flex-col items-center text-center transition-all duration-700 delay-150 ease-out motion-reduce:transition-none ${
        entering ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}>
        {copy.title ? (
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-premium-charcoal">{copy.title}</h1>
        ) : (
          <h1><Wordmark height={40} /></h1>
        )}
        <p className="mt-3 text-[15px] font-medium text-muted-taupe">{copy.line}</p>
      </div>

      <div className={`mt-10 flex items-center gap-1.5 transition-opacity duration-500 ${entering ? 'opacity-0' : 'opacity-100'}`} aria-hidden="true">
        <span className="w-2 h-2 rounded-full bg-sage/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" />
        <span className="w-2 h-2 rounded-full bg-sage/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" />
        <span className="w-2 h-2 rounded-full bg-sage/70 animate-bounce motion-reduce:animate-none" />
      </div>

      {variant === 'launch' && (
        <p className={`absolute bottom-[calc(var(--sab)+2rem)] text-[11px] text-muted-taupe tabular-nums transition-opacity duration-700 ${entering ? 'opacity-0' : 'opacity-80'}`}>
          Version {__APP_VERSION__}
        </p>
      )}
    </div>
  );
};

export default SplashScreen;
