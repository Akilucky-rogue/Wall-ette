import React from 'react';

/**
 * Paper: the lit card everything but a screen's key figure sits on
 * (tailwind shadow-soft; styles.css lights it from the top).
 */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }> = ({ flush = false, className = '', children, ...rest }) => (
  <div className={`bg-white rounded-3xl shadow-soft border border-black/[0.02] ${flush ? 'overflow-hidden' : 'p-5'} ${className}`} {...rest}>
    {children}
  </div>
);

/**
 * A card's label: Wall-ette's small caps line ("BUDGETS · NOVEMBER"), with
 * an optional action on the right in the same style ("EDIT").
 */
export const SectionTitle: React.FC<{
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
  aside?: React.ReactNode;
  className?: string;
  as?: 'h2' | 'h3' | 'p';
}> = ({ children, action, aside, className = '', as: Tag = 'h3' }) => (
  <div className={`flex items-baseline justify-between gap-3 mb-3 ${className}`}>
    <Tag className="font-sans text-[10px] uppercase tracking-widest text-muted-taupe font-bold">{children}</Tag>
    {action ? (
      <button onClick={action.onClick} className="text-[10px] text-sage font-semibold uppercase tracking-wider hover:underline shrink-0">{action.label}</button>
    ) : aside ? (
      <span className="text-[11px] text-muted-taupe shrink-0">{aside}</span>
    ) : null}
  </div>
);

/** A tinted rounded square holding a filled icon. */
export const IconChip: React.FC<{ icon: string; tint: string; size?: 'sm' | 'md' }> = ({ icon, tint, size = 'md' }) => (
  <span className={`${size === 'md' ? 'w-10 h-10 rounded-2xl' : 'w-8 h-8 rounded-xl'} flex items-center justify-center shrink-0 ${tint}`}>
    <span className={`material-symbols-outlined icon-fill ${size === 'md' ? 'text-[20px]' : 'text-[16px]'}`} aria-hidden="true">{icon}</span>
  </span>
);

/** A two- to four-way switch on paper: a pressed track, the chosen side raised. */
export function Segmented<T extends string>({ options, value, onChange, label, className = '' }: {
  options: readonly { value: T; label: string; icon?: string; tone?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={`bg-premium-charcoal/[0.06] shadow-pressed rounded-2xl p-1 flex ${className}`} role="group" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
            value === o.value ? 'bg-white shadow-soft text-premium-charcoal' : 'text-muted-taupe hover:text-premium-charcoal'
          }`}
        >
          {o.icon && <span className={`material-symbols-outlined icon-fill text-[16px] ${value === o.value ? (o.tone ?? 'text-sage') : ''}`} aria-hidden="true">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}
