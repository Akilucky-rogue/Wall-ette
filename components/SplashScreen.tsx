import React, { useEffect, useState } from 'react';

export type SplashVariant = 'launch' | 'login' | 'register' | 'logout';

interface SplashScreenProps {
  onComplete: () => void;
  variant?: SplashVariant;
}

// === ECO & INDIAN DESIGN DECORATIVE ELEMENTS ===

// Floating leaf component
export const FloatingLeaf: React.FC<{ className?: string; delay?: number; color?: string }> = ({ className = '', delay = 0, color = '#8B9E82' }) => (
  <svg 
    className={`absolute animate-float ${className}`} 
    style={{ animationDelay: `${delay}s` }}
    width="16" height="20" viewBox="0 0 16 20" fill="none"
  >
    <path d="M8 0C8 0 2 6 2 12C2 16 4.5 19 8 19C11.5 19 14 16 14 12C14 6 8 0 8 0Z" fill={color} fillOpacity="0.6"/>
    <path d="M8 4V16M5 8C5 8 8 10 11 8" stroke={color} strokeWidth="0.5" strokeOpacity="0.8"/>
  </svg>
);

// Small plant/sprout
export const Sprout: React.FC<{ className?: string; size?: 'sm' | 'md' }> = ({ className = '', size = 'sm' }) => {
  const scale = size === 'sm' ? 1 : 1.5;
  return (
    <svg className={className} width={16 * scale} height={20 * scale} viewBox="0 0 16 20" fill="none">
      <path d="M8 20V10" stroke="#8B9E82" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 12C8 12 4 10 4 6C4 2 8 2 8 2" stroke="#8B9E82" strokeWidth="1.5" fill="#8B9E82" fillOpacity="0.3"/>
      <path d="M8 8C8 8 12 6 12 3C12 0 8 2 8 2" stroke="#A8B89E" strokeWidth="1.5" fill="#A8B89E" fillOpacity="0.3"/>
    </svg>
  );
};

// Rangoli corner pattern
export const RangoliCorner: React.FC<{ className?: string; color?: string; mirror?: boolean }> = ({ className = '', color = '#8B9E82', mirror = false }) => (
  <svg 
    className={className} 
    width="40" height="40" 
    viewBox="0 0 40 40" 
    fill="none"
    style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
  >
    <circle cx="8" cy="8" r="2" fill={color} fillOpacity="0.4"/>
    <circle cx="16" cy="4" r="1.5" fill={color} fillOpacity="0.3"/>
    <circle cx="4" cy="16" r="1.5" fill={color} fillOpacity="0.3"/>
    <path d="M2 2Q20 2 20 20" stroke={color} strokeWidth="0.5" strokeOpacity="0.4" fill="none"/>
    <path d="M6 2Q20 6 20 20" stroke={color} strokeWidth="0.5" strokeOpacity="0.3" fill="none"/>
    <circle cx="12" cy="12" r="1" fill={color} fillOpacity="0.5"/>
  </svg>
);

// Lotus flower
export const LotusFlower: React.FC<{ className?: string; size?: 'sm' | 'md' | 'lg'; color?: string }> = ({ className = '', size = 'sm', color = '#E8A5A5' }) => {
  const dims = { sm: 20, md: 28, lg: 36 };
  const s = dims[size];
  return (
    <svg className={className} width={s} height={s * 0.7} viewBox="0 0 30 21" fill="none">
      {/* Center petal */}
      <ellipse cx="15" cy="14" rx="4" ry="8" fill={color} fillOpacity="0.7"/>
      {/* Left petals */}
      <ellipse cx="9" cy="15" rx="3.5" ry="7" fill={color} fillOpacity="0.5" transform="rotate(-20 9 15)"/>
      <ellipse cx="5" cy="16" rx="3" ry="5" fill={color} fillOpacity="0.3" transform="rotate(-35 5 16)"/>
      {/* Right petals */}
      <ellipse cx="21" cy="15" rx="3.5" ry="7" fill={color} fillOpacity="0.5" transform="rotate(20 21 15)"/>
      <ellipse cx="25" cy="16" rx="3" ry="5" fill={color} fillOpacity="0.3" transform="rotate(35 25 16)"/>
      {/* Center detail */}
      <circle cx="15" cy="18" r="2" fill="#F5D485" fillOpacity="0.8"/>
    </svg>
  );
};

// Paisley pattern element
export const Paisley: React.FC<{ className?: string; color?: string; flip?: boolean }> = ({ className = '', color = '#C4A98E', flip = false }) => (
  <svg 
    className={className} 
    width="18" height="24" 
    viewBox="0 0 18 24" 
    fill="none"
    style={{ transform: flip ? 'scaleX(-1)' : 'none' }}
  >
    <path 
      d="M9 2C4 2 2 8 2 12C2 18 6 22 10 22C14 22 16 18 16 14C16 8 12 4 9 2Z" 
      fill={color} 
      fillOpacity="0.2"
      stroke={color}
      strokeWidth="0.5"
      strokeOpacity="0.5"
    />
    <circle cx="9" cy="14" r="2" fill={color} fillOpacity="0.4"/>
    <path d="M9 8C9 8 7 10 7 14" stroke={color} strokeWidth="0.5" strokeOpacity="0.6"/>
  </svg>
);

// Mandala dot pattern
export const MandalaDots: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} width="32" height="32" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="2" fill="#8B9E82" fillOpacity="0.5"/>
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
      <circle 
        key={i}
        cx={16 + 8 * Math.cos(angle * Math.PI / 180)} 
        cy={16 + 8 * Math.sin(angle * Math.PI / 180)} 
        r="1.5" 
        fill="#8B9E82" 
        fillOpacity={0.3 + (i % 2) * 0.2}
      />
    ))}
  </svg>
);

// Diya lamp (traditional oil lamp)
export const Diya: React.FC<{ className?: string; lit?: boolean }> = ({ className = '', lit = true }) => (
  <svg className={className} width="24" height="20" viewBox="0 0 24 20" fill="none">
    {/* Flame */}
    {lit && (
      <path 
        d="M12 2C12 2 10 5 10 7C10 8.5 11 9 12 9C13 9 14 8.5 14 7C14 5 12 2 12 2Z" 
        fill="#F5D485" 
        className="animate-pulse"
      />
    )}
    {/* Lamp body */}
    <ellipse cx="12" cy="14" rx="8" ry="3" fill="#C4A98E"/>
    <path d="M4 14C4 14 4 17 12 17C20 17 20 14 20 14" fill="#B89B7A"/>
    <ellipse cx="12" cy="12" rx="3" ry="1" fill="#D4B896"/>
  </svg>
);

// Potted plant
export const PottedPlant: React.FC<{ className?: string; size?: 'sm' | 'md' }> = ({ className = '', size = 'sm' }) => {
  const scale = size === 'sm' ? 1 : 1.4;
  return (
    <svg className={className} width={20 * scale} height={24 * scale} viewBox="0 0 20 24" fill="none">
      {/* Leaves */}
      <ellipse cx="10" cy="8" rx="3" ry="6" fill="#8B9E82" fillOpacity="0.7"/>
      <ellipse cx="6" cy="10" rx="2.5" ry="5" fill="#A8B89E" fillOpacity="0.6" transform="rotate(-30 6 10)"/>
      <ellipse cx="14" cy="10" rx="2.5" ry="5" fill="#A8B89E" fillOpacity="0.6" transform="rotate(30 14 10)"/>
      {/* Pot */}
      <path d="M5 16H15L13 22H7L5 16Z" fill="#C4A98E"/>
      <rect x="4" y="14" width="12" height="3" rx="1" fill="#D4B896"/>
    </svg>
  );
};

// Vine decoration
export const VineDecoration: React.FC<{ className?: string; direction?: 'left' | 'right' }> = ({ className = '', direction = 'left' }) => (
  <svg 
    className={className} 
    width="60" height="100" 
    viewBox="0 0 60 100" 
    fill="none"
    style={{ transform: direction === 'right' ? 'scaleX(-1)' : 'none' }}
  >
    <path d="M30 0C30 0 10 20 15 40C20 60 5 80 10 100" stroke="#8B9E82" strokeWidth="1" strokeOpacity="0.4" fill="none"/>
    <ellipse cx="12" cy="25" rx="6" ry="10" fill="#8B9E82" fillOpacity="0.3" transform="rotate(-20 12 25)"/>
    <ellipse cx="20" cy="50" rx="5" ry="8" fill="#A8B89E" fillOpacity="0.25" transform="rotate(15 20 50)"/>
    <ellipse cx="8" cy="75" rx="5" ry="9" fill="#8B9E82" fillOpacity="0.2" transform="rotate(-10 8 75)"/>
    <circle cx="15" cy="35" r="2" fill="#E8A5A5" fillOpacity="0.4"/>
    <circle cx="12" cy="65" r="1.5" fill="#E8A5A5" fillOpacity="0.3"/>
  </svg>
);

// Reusable WALL-E Eyes Component
export const WallEEyes: React.FC<{ 
  size?: 'sm' | 'md' | 'lg';
  eyeColor?: string;
  pupilColor?: string;
  animate?: boolean;
  expression?: 'neutral' | 'happy' | 'wink' | 'sleepy';
}> = ({ 
  size = 'md', 
  eyeColor = 'bg-sage-light',
  pupilColor = 'bg-sage',
  animate = false,
  expression = 'neutral'
}) => {
  const sizes = {
    sm: { eye: 'w-4 h-5', iris: 'w-2 h-2', pupil: 'w-1 h-1', gap: 'gap-0.5', shine: 'w-1 h-1' },
    md: { eye: 'w-6 h-7', iris: 'w-3 h-3', pupil: 'w-1.5 h-1.5', gap: 'gap-1', shine: 'w-1.5 h-1.5' },
    lg: { eye: 'w-8 h-10', iris: 'w-4 h-4', pupil: 'w-2 h-2', gap: 'gap-1.5', shine: 'w-2 h-2' }
  };
  const s = sizes[size];

  return (
    <div className={`flex items-center ${s.gap}`}>
      {/* Left Eye */}
      <div className={`${s.eye} bg-premium-charcoal/90 rounded-lg flex items-center justify-center shadow-inner relative overflow-hidden ${
        animate ? 'animate-pulse' : ''
      } ${expression === 'wink' ? 'scale-y-[0.2]' : ''} ${expression === 'sleepy' ? 'scale-y-[0.6]' : ''}`}
        style={{ transition: 'transform 0.3s' }}
      >
        <div className={`absolute top-0.5 left-0.5 ${s.shine} bg-white/40 rounded-full`} />
        <div className={`${s.iris} ${eyeColor} rounded-full flex items-center justify-center`}>
          <div className={`${s.pupil} ${pupilColor} rounded-full`} />
        </div>
      </div>
      {/* Right Eye */}
      <div className={`${s.eye} bg-premium-charcoal/90 rounded-lg flex items-center justify-center shadow-inner relative overflow-hidden ${
        animate ? 'animate-pulse' : ''
      } ${expression === 'sleepy' ? 'scale-y-[0.6]' : ''}`}
        style={{ transition: 'transform 0.3s', animationDelay: animate ? '0.15s' : '0s' }}
      >
        <div className={`absolute top-0.5 left-0.5 ${s.shine} bg-white/40 rounded-full`} />
        <div className={`${s.iris} ${eyeColor} rounded-full flex items-center justify-center`}>
          <div className={`${s.pupil} ${pupilColor} rounded-full`} />
        </div>
      </div>
    </div>
  );
};

// Mini WALL-E mascot for various situations
export const WallEMascot: React.FC<{
  mood?: 'happy' | 'thinking' | 'sad' | 'excited' | 'sleeping';
  message?: string;
  size?: 'sm' | 'md';
}> = ({ mood = 'happy', message, size = 'sm' }) => {
  const getExpression = () => {
    switch(mood) {
      case 'happy': return 'neutral';
      case 'thinking': return 'neutral';
      case 'sad': return 'sleepy';
      case 'excited': return 'happy';
      case 'sleeping': return 'sleepy';
      default: return 'neutral';
    }
  };

  const getBgColor = () => {
    switch(mood) {
      case 'happy': return 'bg-sage';
      case 'thinking': return 'bg-ocean';
      case 'sad': return 'bg-rose/60';
      case 'excited': return 'bg-lavender';
      case 'sleeping': return 'bg-muted-taupe/40';
      default: return 'bg-sage';
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${size === 'sm' ? 'w-10 h-10' : 'w-14 h-14'} rounded-full ${getBgColor()} flex items-center justify-center shadow-md`}>
        <WallEEyes 
          size={size === 'sm' ? 'sm' : 'md'} 
          expression={getExpression()}
          animate={mood === 'thinking'}
        />
        {mood === 'sleeping' && (
          <div className="absolute -top-1 -right-1 text-[10px]">💤</div>
        )}
        {mood === 'excited' && (
          <div className="absolute -top-1 -right-1 text-[10px]">✨</div>
        )}
      </div>
      {message && (
        <p className="text-[10px] text-muted-taupe italic text-center max-w-[120px]">"{message}"</p>
      )}
    </div>
  );
};

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, variant = 'launch' }) => {
  const [phase, setPhase] = useState<'logo' | 'text' | 'fade'>('logo');

  // Timing varies by variant - launch is slowest, logout is medium, login/register are faster
  const getTiming = () => {
    switch (variant) {
      case 'launch':
        return { text: 1000, fade: 2800, complete: 3400 };
      case 'logout':
        return { text: 600, fade: 2000, complete: 2600 };
      default: // login, register
        return { text: 500, fade: 1800, complete: 2400 };
    }
  };
  const timing = getTiming();

  useEffect(() => {
    const textTimer = setTimeout(() => setPhase('text'), timing.text);
    const fadeTimer = setTimeout(() => setPhase('fade'), timing.fade);
    const completeTimer = setTimeout(() => onComplete(), timing.complete);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, timing.text, timing.fade, timing.complete]);

  // Variant-specific content
  const getContent = () => {
    switch (variant) {
      case 'login':
        return {
          greeting: 'Welcome Back!',
          subtitle: 'Great to see you again',
          tagline: '"Your finances missed you"',
          bgGradient: 'from-sage/15 via-zen-bg to-ocean-light/20',
          accentColor: 'ocean',
          eyeColor: 'bg-ocean-light',
          pupilColor: 'bg-ocean'
        };
      case 'register':
        return {
          greeting: 'Welcome Aboard!',
          subtitle: 'Your journey to mindful wealth begins',
          tagline: '"Let\'s build your financial future together"',
          bgGradient: 'from-lavender/15 via-zen-bg to-sage-light/20',
          accentColor: 'lavender',
          eyeColor: 'bg-lavender/60',
          pupilColor: 'bg-lavender'
        };
      case 'logout':
        return {
          greeting: 'See You Soon!',
          subtitle: 'Your data is safe with us',
          tagline: '"Take care of your wealth, always"',
          bgGradient: 'from-sand/15 via-zen-bg to-rose-light/20',
          accentColor: 'sand',
          eyeColor: 'bg-sand-light',
          pupilColor: 'bg-sand'
        };
      default:
        return {
          greeting: 'WALL·E',
          subtitle: 'Wallet Analyzer for Lavish Living',
          tagline: '"Your mindful money companion"',
          bgGradient: 'from-sage/10 via-zen-bg to-sage-light/20',
          accentColor: 'sage',
          eyeColor: 'bg-sage-light',
          pupilColor: 'bg-sage'
        };
    }
  };

  const content = getContent();

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br ${content.bgGradient} transition-opacity duration-500 ${
        phase === 'fade' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl animate-pulse ${
          variant === 'register' ? 'bg-lavender/10' : variant === 'login' ? 'bg-ocean/10' : 'bg-sage/5'
        }`} />
        <div className={`absolute -bottom-32 -left-32 w-96 h-96 rounded-full blur-3xl animate-pulse ${
          variant === 'register' ? 'bg-sage/10' : variant === 'login' ? 'bg-sage/10' : 'bg-rose/5'
        }`} style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-lavender/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Floating eco elements */}
        <FloatingLeaf className="top-20 right-16 opacity-40" delay={0} />
        <FloatingLeaf className="top-32 left-12 opacity-30" delay={1.2} color="#A8B89E" />
        <FloatingLeaf className="bottom-40 right-20 opacity-35" delay={2} />
        <FloatingLeaf className="bottom-28 left-16 opacity-25" delay={0.8} color="#C4A98E" />
        
        {/* Rangoli corners - wealth and prosperity */}
        <RangoliCorner className="absolute top-8 left-6 opacity-30" color="#8B9E82" />
        <RangoliCorner className="absolute top-8 right-6 opacity-30" color="#8B9E82" mirror />
        <RangoliCorner className="absolute bottom-12 left-6 opacity-25 rotate-180" color="#C4A98E" mirror />
        <RangoliCorner className="absolute bottom-12 right-6 opacity-25 rotate-180" color="#C4A98E" />
        
        {/* Lotus flowers - purity and wealth */}
        <LotusFlower className="absolute top-24 left-8 opacity-35" size="sm" color="#E8A5A5" />
        <LotusFlower className="absolute bottom-32 right-10 opacity-30" size="sm" color="#D4B896" />
        
        {/* Mandala dots - harmony */}
        <MandalaDots className="absolute top-1/4 right-8 opacity-20" />
        <MandalaDots className="absolute bottom-1/3 left-10 opacity-15" />
        
        {/* Diyas - prosperity (only on launch splash) */}
        {variant === 'launch' && (
          <>
            <Diya className="absolute bottom-24 left-1/4 opacity-40" />
            <Diya className="absolute bottom-24 right-1/4 opacity-40" />
          </>
        )}
        
        {/* Floating coins for wealth context */}
        <div className="absolute top-1/4 left-[15%] w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-400 opacity-20 animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '2s' }}>
          <span className="flex items-center justify-center h-full text-amber-700 text-[8px] font-bold">₹</span>
        </div>
        <div className="absolute bottom-1/3 right-[10%] w-4 h-4 rounded-full bg-gradient-to-br from-amber-300 to-amber-400 opacity-15 animate-bounce" style={{ animationDelay: '0.8s', animationDuration: '2.5s' }}>
          <span className="flex items-center justify-center h-full text-amber-700 text-[6px] font-bold">₹</span>
        </div>
      </div>

      {/* Logo Container */}
      <div className={`relative transition-all duration-700 ease-out ${
        phase === 'logo' ? 'scale-90 opacity-0' : 'scale-100 opacity-100'
      }`}>
        {/* Outer glow ring */}
        <div className={`absolute inset-0 -m-4 rounded-full blur-xl animate-pulse ${
          variant === 'register' ? 'bg-lavender/30' : variant === 'login' ? 'bg-ocean/20' : 'bg-sage/20'
        }`} />
        
        {/* Main logo circle - WALL-E eyes for ALL variants */}
        <div className={`relative w-28 h-28 rounded-full shadow-xl flex items-center justify-center ${
          variant === 'register' 
            ? 'bg-gradient-to-br from-lavender to-lavender/80' 
            : variant === 'login'
            ? 'bg-gradient-to-br from-ocean to-ocean/80'
            : variant === 'logout'
            ? 'bg-gradient-to-br from-sand to-sand/80'
            : 'bg-gradient-to-br from-sage to-sage/80'
        }`}>
          {/* Inner highlight */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
          
          {/* WALL-E Robot Eyes - consistent across all variants with color variations */}
          <WallEEyes 
            size="lg" 
            eyeColor={content.eyeColor}
            pupilColor={content.pupilColor}
            expression={variant === 'register' ? 'happy' : variant === 'logout' ? 'sleepy' : 'neutral'}
          />
          
          {/* Contextual accent badge */}
          <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full shadow-md flex items-center justify-center border-2 border-white ${
            variant === 'register' 
              ? 'bg-gradient-to-br from-green-400 to-green-500' 
              : variant === 'login'
              ? 'bg-gradient-to-br from-amber-300 to-amber-400'
              : variant === 'logout'
              ? 'bg-gradient-to-br from-rose to-rose/80'
              : 'bg-gradient-to-br from-amber-300 to-amber-400'
          }`}>
            {variant === 'register' ? (
              <span className="text-white text-[12px]">+</span>
            ) : variant === 'login' ? (
              <span className="text-amber-700 text-[10px] font-bold">₹</span>
            ) : variant === 'logout' ? (
              <span className="text-white text-[11px]">👋</span>
            ) : (
              <span className="text-amber-700 text-[10px] font-bold">₹</span>
            )}
          </div>
        </div>
        
        {/* Floating hearts for logout (goodbye) */}
        {variant === 'logout' && phase !== 'logo' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-4 -left-2 text-rose/60 animate-bounce" style={{ animationDuration: '1.5s' }}>💚</div>
            <div className="absolute -top-2 -right-4 text-sage/60 animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '1.8s' }}>🌱</div>
            <div className="absolute -bottom-3 -left-4 text-sand/60 animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '1.6s' }}>✨</div>
            <div className="absolute -bottom-2 -right-2 text-lavender/60 animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '2s' }}>🍃</div>
          </div>
        )}
        
        {/* Confetti for register */}
        {variant === 'register' && phase !== 'logo' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-4 -left-4 w-3 h-3 bg-sage rounded-full animate-ping" />
            <div className="absolute -top-2 -right-6 w-2 h-2 bg-rose rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
            <div className="absolute -bottom-4 -left-6 w-2 h-2 bg-ocean rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
            <div className="absolute -bottom-2 -right-4 w-3 h-3 bg-lavender rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
          </div>
        )}
        
        {/* Sparkles for login (welcome back) */}
        {variant === 'login' && phase !== 'logo' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-3 left-1/2 text-[14px] animate-pulse">✨</div>
          </div>
        )}
      </div>

      {/* App Name / Greeting */}
      <div className={`mt-8 text-center transition-all duration-700 delay-200 ${
        phase === 'logo' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}>
        {variant === 'launch' ? (
          <h1 className="text-4xl font-serif font-bold tracking-tight text-premium-charcoal">
            WALL<span className="text-sage">·</span>E
          </h1>
        ) : (
          <h1 className={`text-3xl font-serif font-bold tracking-tight ${
            variant === 'register' ? 'text-lavender' : 'text-ocean'
          }`}>
            {content.greeting}
          </h1>
        )}
        <p className="mt-2 text-muted-taupe text-sm font-medium tracking-wide">
          {content.subtitle}
        </p>
      </div>

      {/* Tagline */}
      <div className={`mt-6 transition-all duration-700 delay-500 ${
        phase !== 'logo' ? 'opacity-100' : 'opacity-0'
      }`}>
        <p className="text-xs text-muted-taupe/70 italic font-serif">
          {content.tagline}
        </p>
      </div>

      {/* Loading indicator - WALL-E themed */}
      <div className={`mt-10 flex items-center gap-2 transition-opacity duration-500 ${
        phase === 'fade' ? 'opacity-0' : 'opacity-100'
      }`}>
        {variant === 'launch' ? (
          /* Bouncing dots with coin accent */
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-sage/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2.5 h-2.5 bg-amber-400/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-sage/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : variant === 'login' ? (
          /* Sync animation for login */
          <div className="flex items-center gap-2 text-ocean">
            <div className="w-5 h-5 rounded-full bg-ocean/20 flex items-center justify-center">
              <WallEEyes size="sm" eyeColor="bg-ocean-light" pupilColor="bg-ocean" />
            </div>
            <span className="text-xs font-medium">Syncing your data...</span>
          </div>
        ) : (
          /* Setup animation for register */
          <div className="flex items-center gap-2 text-lavender">
            <div className="w-5 h-5 rounded-full bg-lavender/20 flex items-center justify-center animate-pulse">
              <WallEEyes size="sm" eyeColor="bg-lavender/60" pupilColor="bg-lavender" />
            </div>
            <span className="text-xs font-medium">Setting up your wallet...</span>
          </div>
        )}
      </div>

      {/* Version - only on launch */}
      {variant === 'launch' && (
        <div className={`absolute bottom-8 text-center transition-all duration-700 delay-300 ${
          phase === 'logo' ? 'opacity-0' : 'opacity-60'
        }`}>
          <p className="text-[10px] text-muted-taupe tracking-widest uppercase">
            Version 2.0
          </p>
        </div>
      )}
    </div>
  );
};

export default SplashScreen;
