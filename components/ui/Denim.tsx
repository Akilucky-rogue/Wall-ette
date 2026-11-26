import React from 'react';

/**
 * The app's material (styles.css .wallet): a stitched denim card in a deep
 * shade of the theme's accent. Each screen opens with one, for its key
 * figure; the rest of the screen is paper (ui/Paper.tsx).
 *
 * Children sit above the weave and stitching. Text on denim uses
 * `text-denim-ink` (the default) and `text-denim-mut`.
 */
export const Denim: React.FC<React.HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div' | 'header' | 'article';
  /** Smaller padding and a single stitch, for a slim strip. */
  compact?: boolean;
}> = ({ as: Tag = 'section', compact = false, className = '', children, ...rest }) => (
  <Tag
    className={`wallet shadow-raised overflow-hidden ${compact ? 'denim-compact rounded-[22px] px-5 py-4' : 'rounded-[30px] px-6 pt-6 pb-5'} ${className}`}
    {...rest}
  >
    <div className="relative">{children}</div>
  </Tag>
);

/** A muted label on denim. */
export const DenimLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`text-[12px] font-medium text-denim-mut ${className}`}>{children}</p>
);

/** The key figure on denim, embossed. */
export const DenimFigure: React.FC<{ children: React.ReactNode; className?: string; size?: 'lg' | 'md' }> = ({ children, className = '', size = 'lg' }) => (
  <p className={`wallet-emboss font-semibold leading-none tabular-nums truncate ${size === 'lg' ? 'text-[40px]' : 'text-[30px]'} ${className}`}>
    {children}
  </p>
);

/** A pocket sewn onto the denim: a secondary figure with a label and a note. */
export const Pocket: React.FC<{
  label: string;
  icon?: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  className?: string;
}> = ({ label, icon, value, note, className = '' }) => (
  <div className={`wallet-pocket rounded-2xl px-3.5 pt-3.5 pb-3 min-w-0 ${className}`}>
    <p className="flex items-center gap-1 text-[11px] font-medium text-denim-mut">
      {icon && <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{icon}</span>}
      {label}
    </p>
    <p className="font-semibold text-[22px] leading-tight tabular-nums mt-1 truncate">{value}</p>
    {note != null && <p className="text-[11px] tabular-nums truncate mt-0.5 text-denim-mut">{note}</p>}
  </div>
);

/** A two- or three-way switch on denim. */
export function DenimSwitch<T extends string>({ options, value, onChange, label }: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="denim-track flex items-center rounded-full p-0.5 text-[11px] font-semibold" role="group" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-1 rounded-full transition-all ${value === o.value ? 'denim-on' : 'text-denim-mut hover:text-denim-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
