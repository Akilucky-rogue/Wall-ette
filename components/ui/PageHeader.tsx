import React from 'react';

/**
 * The header every screen shares: a way back (or close) on a page, the title
 * on the left, an optional line under it, and controls on the right. Tabs
 * leave `onBack` out. On wide screens the side rail replaces the way back to
 * a tab, so it stays for pages only.
 */
const PageHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  backIcon?: 'arrow_back' | 'close';
  right?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, onBack, backLabel = 'Back', backIcon = 'arrow_back', right, className = '' }) => (
  <div className={`flex items-center gap-2 bg-zen-bg/85 backdrop-blur-md px-5 lg:px-8 pt-6 pb-3 sticky top-0 z-30 ${className}`}>
    {onBack && (
      <button
        onClick={onBack}
        className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-premium-charcoal hover:bg-white/70 transition-colors"
        aria-label={backLabel}
      >
        <span className="material-symbols-outlined text-[24px]" aria-hidden="true">{backIcon}</span>
      </button>
    )}
    <div className="min-w-0 flex-1">
      <h2 className="text-premium-charcoal text-[22px] lg:text-[26px] font-serif font-semibold tracking-tight leading-tight truncate">{title}</h2>
      {subtitle != null && <p className="text-[12px] text-muted-taupe truncate">{subtitle}</p>}
    </div>
    {right}
  </div>
);

export default PageHeader;
