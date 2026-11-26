import React from 'react';

/**
 * The garden: Wall·ette's small eco and Indian motifs (leaves, a sprout, a
 * lotus, rangoli corners, paisley, mandala dots, a diya and a potted plant),
 * set at low opacity around the edges of screens. They sit with the brand's
 * leaf-headed mascot; keep them away from the mascot itself, which the brand
 * kit asks to stand on a quiet surface.
 */

const SAGE = '#97A96D';
const SAGE_DEEP = '#7E9558';
const SAND = '#C4A98E';
const SAND_LIGHT = '#D4B896';
const FLAME = '#F5D485';

// A falling leaf.
export const FloatingLeaf: React.FC<{ className?: string; color?: string }> = ({ className = '', color = SAGE }) => (
  <svg className={`absolute pointer-events-none ${className}`} width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden="true">
    <path d="M8 0C8 0 2 6 2 12C2 16 4.5 19 8 19C11.5 19 14 16 14 12C14 6 8 0 8 0Z" fill={color} fillOpacity="0.6" />
    <path d="M8 4V16M5 8C5 8 8 10 11 8" stroke={color} strokeWidth="0.5" strokeOpacity="0.8" />
  </svg>
);

// A small sprout.
export const Sprout: React.FC<{ className?: string; size?: 'sm' | 'md' }> = ({ className = '', size = 'sm' }) => {
  const scale = size === 'sm' ? 1 : 1.5;
  return (
    <svg className={`pointer-events-none ${className}`} width={16 * scale} height={20 * scale} viewBox="0 0 16 20" fill="none" aria-hidden="true">
      <path d="M8 20V10" stroke={SAGE_DEEP} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 12C8 12 4 10 4 6C4 2 8 2 8 2" stroke={SAGE_DEEP} strokeWidth="1.5" fill={SAGE_DEEP} fillOpacity="0.3" />
      <path d="M8 8C8 8 12 6 12 3C12 0 8 2 8 2" stroke={SAGE} strokeWidth="1.5" fill={SAGE} fillOpacity="0.3" />
    </svg>
  );
};

// A rangoli corner.
export const RangoliCorner: React.FC<{ className?: string; color?: string; mirror?: boolean }> = ({ className = '', color = SAGE, mirror = false }) => (
  <svg className={`pointer-events-none ${className} ${mirror ? '-scale-x-100' : ''}`} width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="2" fill={color} fillOpacity="0.4" />
    <circle cx="16" cy="4" r="1.5" fill={color} fillOpacity="0.3" />
    <circle cx="4" cy="16" r="1.5" fill={color} fillOpacity="0.3" />
    <path d="M2 2Q20 2 20 20" stroke={color} strokeWidth="0.5" strokeOpacity="0.4" fill="none" />
    <path d="M6 2Q20 6 20 20" stroke={color} strokeWidth="0.5" strokeOpacity="0.3" fill="none" />
    <circle cx="12" cy="12" r="1" fill={color} fillOpacity="0.5" />
  </svg>
);

// A lotus.
export const LotusFlower: React.FC<{ className?: string; size?: 'sm' | 'md' | 'lg'; color?: string }> = ({ className = '', size = 'sm', color = '#E8A5A5' }) => {
  const s = { sm: 20, md: 28, lg: 36 }[size];
  return (
    <svg className={`pointer-events-none ${className}`} width={s} height={s * 0.7} viewBox="0 0 30 21" fill="none" aria-hidden="true">
      <ellipse cx="15" cy="14" rx="4" ry="8" fill={color} fillOpacity="0.7" />
      <ellipse cx="9" cy="15" rx="3.5" ry="7" fill={color} fillOpacity="0.5" transform="rotate(-20 9 15)" />
      <ellipse cx="5" cy="16" rx="3" ry="5" fill={color} fillOpacity="0.3" transform="rotate(-35 5 16)" />
      <ellipse cx="21" cy="15" rx="3.5" ry="7" fill={color} fillOpacity="0.5" transform="rotate(20 21 15)" />
      <ellipse cx="25" cy="16" rx="3" ry="5" fill={color} fillOpacity="0.3" transform="rotate(35 25 16)" />
      <circle cx="15" cy="18" r="2" fill={FLAME} fillOpacity="0.8" />
    </svg>
  );
};

// A paisley.
export const Paisley: React.FC<{ className?: string; color?: string; flip?: boolean }> = ({ className = '', color = SAND, flip = false }) => (
  <svg className={`pointer-events-none ${className} ${flip ? '-scale-x-100' : ''}`} width="18" height="24" viewBox="0 0 18 24" fill="none" aria-hidden="true">
    <path d="M9 2C4 2 2 8 2 12C2 18 6 22 10 22C14 22 16 18 16 14C16 8 12 4 9 2Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="0.5" strokeOpacity="0.5" />
    <circle cx="9" cy="14" r="2" fill={color} fillOpacity="0.4" />
    <path d="M9 8C9 8 7 10 7 14" stroke={color} strokeWidth="0.5" strokeOpacity="0.6" />
  </svg>
);

// Mandala dots.
export const MandalaDots: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={`pointer-events-none ${className}`} width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="16" r="2" fill={SAGE} fillOpacity="0.5" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
      <circle key={i} cx={16 + 8 * Math.cos((angle * Math.PI) / 180)} cy={16 + 8 * Math.sin((angle * Math.PI) / 180)} r="1.5" fill={SAGE} fillOpacity={0.3 + (i % 2) * 0.2} />
    ))}
  </svg>
);

// A diya, the oil lamp.
export const Diya: React.FC<{ className?: string; lit?: boolean }> = ({ className = '', lit = true }) => (
  <svg className={`pointer-events-none ${className}`} width="24" height="20" viewBox="0 0 24 20" fill="none" aria-hidden="true">
    {lit && <path d="M12 2C12 2 10 5 10 7C10 8.5 11 9 12 9C13 9 14 8.5 14 7C14 5 12 2 12 2Z" fill={FLAME} className="animate-pulse motion-reduce:animate-none" />}
    <ellipse cx="12" cy="14" rx="8" ry="3" fill={SAND} />
    <path d="M4 14C4 14 4 17 12 17C20 17 20 14 20 14" fill="#B89B7A" />
    <ellipse cx="12" cy="12" rx="3" ry="1" fill={SAND_LIGHT} />
  </svg>
);

// A potted plant.
export const PottedPlant: React.FC<{ className?: string; size?: 'sm' | 'md' }> = ({ className = '', size = 'sm' }) => {
  const scale = size === 'sm' ? 1 : 1.4;
  return (
    <svg className={`pointer-events-none ${className}`} width={20 * scale} height={24 * scale} viewBox="0 0 20 24" fill="none" aria-hidden="true">
      <ellipse cx="10" cy="8" rx="3" ry="6" fill={SAGE_DEEP} fillOpacity="0.7" />
      <ellipse cx="6" cy="10" rx="2.5" ry="5" fill={SAGE} fillOpacity="0.6" transform="rotate(-30 6 10)" />
      <ellipse cx="14" cy="10" rx="2.5" ry="5" fill={SAGE} fillOpacity="0.6" transform="rotate(30 14 10)" />
      <path d="M5 16H15L13 22H7L5 16Z" fill={SAND} />
      <rect x="4" y="14" width="12" height="3" rx="1" fill={SAND_LIGHT} />
    </svg>
  );
};
