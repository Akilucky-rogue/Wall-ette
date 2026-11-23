import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { Card } from '../ui/Paper';

/**
 * The pieces every chart shares: its colours, a card with a legend and a
 * table of the numbers, a tooltip, axis ticks and the container's width.
 *
 * The rules (the dataviz checks): money in is blue and money out orange in
 * every theme (utils/theme.ts `--viz-*`, validated for colour blindness in
 * light and dark); gridlines are solid hairlines; bars are at most 24px with
 * 4px rounded ends; lines are 2px; dots have a ring in the card's colour;
 * text is never in a series colour; every value a tooltip shows is also in
 * the table.
 */
export const VIZ = {
  in: 'var(--viz-in)',
  out: 'var(--viz-out)',
  /** Money out in three steps, darkest first: bills, everyday, one-offs. */
  out1: 'var(--viz-out-1)',
  out3: 'var(--viz-out-3)',
  /** The month before, for comparison. */
  ctx: 'var(--viz-ctx)',
  grid: 'var(--line)',
  axis: 'var(--line-2)',
  surface: 'var(--card)',
  ink: 'var(--ink)',
  mut: 'var(--mut)',
} as const;

/** Text on a filled block: white on the darkest step, near-black on the rest. */
export const ON_FILL = { dark: '#FFFFFF', light: '#1A1A18' } as const;

/** The width of an element, kept up to date. */
export function useWidth<T extends HTMLElement>(fallback = 320): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/**
 * Round axis ticks from 0 past `max`, about `count` steps, in the currency
 * shown (`rate` converts from rupees), returned in rupees for drawing.
 */
export function niceTicks(max: number, rate = 1, count = 3): number[] {
  const shown = max * rate;
  if (!(shown > 0)) return [0];
  const raw = shown / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(s => s * pow).find(s => s >= raw) ?? 10 * pow;
  const ticks: number[] = [];
  for (let v = 0; v < shown + step * 0.999; v += step) ticks.push(v / rate);
  return ticks;
}

/** A column with a rounded top, square at the baseline. */
export function columnPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}A${rr},${rr} 0 0 1 ${x + rr},${y}H${x + w - rr}A${rr},${rr} 0 0 1 ${x + w},${y + rr}V${y + h}Z`;
}

/** A bar growing right (or left, `toLeft`) from `x`, rounded at its far end. */
export function barPath(x: number, y: number, len: number, h: number, toLeft = false, r = 4): string {
  if (len <= 0 || h <= 0) return '';
  const rr = Math.min(r, len, h / 2);
  if (!toLeft) {
    return `M${x},${y}H${x + len - rr}A${rr},${rr} 0 0 1 ${x + len},${y + rr}V${y + h - rr}A${rr},${rr} 0 0 1 ${x + len - rr},${y + h}H${x}Z`;
  }
  return `M${x},${y}H${x - len + rr}A${rr},${rr} 0 0 0 ${x - len},${y + rr}V${y + h - rr}A${rr},${rr} 0 0 0 ${x - len + rr},${y + h}H${x}Z`;
}

export interface LegendItem { label: string; color: string; kind?: 'rect' | 'line' | 'dash' }

/** Series names, each with a key shaped like its mark. */
export const Legend: React.FC<{ items: LegendItem[]; className?: string }> = ({ items, className = '' }) => (
  <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-taupe ${className}`}>
    {items.map(item => (
      <li key={item.label} className="flex items-center gap-1.5">
        <Key color={item.color} kind={item.kind} />
        {item.label}
      </li>
    ))}
  </ul>
);

const Key: React.FC<{ color: string; kind?: LegendItem['kind'] }> = ({ color, kind = 'rect' }) => (
  <svg width="16" height="10" aria-hidden="true" className="shrink-0">
    {kind === 'rect' && <rect x="3" y="0" width="10" height="10" rx="2" fill={color} />}
    {kind === 'line' && <line x1="1" y1="5" x2="15" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" />}
    {kind === 'dash' && <line x1="1" y1="5" x2="15" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 4" />}
  </svg>
);

export interface TipRow { color?: string; kind?: LegendItem['kind']; value: string; label: string }

/**
 * The tooltip: values first and strong, names after, each row keyed with a
 * short line of its series' colour. Placed above `y`, kept inside the chart.
 */
export const Tooltip: React.FC<{
  x: number; y: number; width: number; title?: string; rows: TipRow[];
  /** Above the point (bars), or beside a crosshair so it hides no line. */
  place?: 'above' | 'side';
}> = ({ x, y, width, title, rows, place = 'above' }) => {
  const w = 176;
  const left = place === 'side'
    ? (x + 14 + w <= width ? x + 14 : Math.max(0, x - 14 - w))
    : Math.max(0, Math.min(width - w, x - w / 2));
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 bg-white rounded-2xl shadow-float px-3 py-2.5 text-[12px]"
      style={{ left, top: y, width: w, transform: place === 'side' ? undefined : 'translateY(calc(-100% - 10px))' }}
    >
      {title && <p className="text-[11px] font-semibold text-muted-taupe mb-1">{title}</p>}
      <ul className="space-y-0.5">
        {rows.map(r => (
          <li key={r.label} className="flex items-center gap-2 min-w-0">
            {r.color && (
              <svg width="12" height="8" aria-hidden="true" className="shrink-0">
                <line x1="1" y1="4" x2="11" y2="4" stroke={r.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={r.kind === 'dash' ? '2 3' : undefined} />
              </svg>
            )}
            <span className="font-semibold text-premium-charcoal tabular-nums">{r.value}</span>
            <span className="text-muted-taupe truncate">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export interface ChartTable {
  head: string[];
  rows: (string | number)[][];
}

/**
 * A chart on paper: a title, a line under it, the legend, and a switch to
 * the same numbers as a table (the chart's accessible twin).
 */
export const ChartCard: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  legend?: LegendItem[];
  table?: ChartTable;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, legend, table, footer, className = '', children }) => {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <Card className={`break-inside-avoid ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`${id}-t`} className="font-sans text-[10px] uppercase tracking-widest text-muted-taupe font-bold min-w-0">{title}</h3>
        {table && (
          <button
            onClick={() => setAsTable(v => !v)}
            aria-pressed={asTable}
            aria-label={asTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
            className="shrink-0 -my-2 py-2 text-[10px] text-sage font-semibold uppercase tracking-wider hover:underline"
          >
            {asTable ? 'Chart' : 'Numbers'}
          </button>
        )}
      </div>
      {subtitle != null && <p className="text-[12px] text-muted-taupe mt-1 leading-snug">{subtitle}</p>}
      {legend && legend.length > 1 && !asTable && <Legend items={legend} className="mt-3" />}
      <div className="mt-3">
        {asTable && table ? <NumbersTable table={table} labelledBy={`${id}-t`} /> : children}
      </div>
      {footer != null && !asTable && <div className="mt-3 pt-3 border-t border-premium-charcoal/[0.08] text-[12px] text-muted-taupe leading-relaxed">{footer}</div>}
    </Card>
  );
};

const NumbersTable: React.FC<{ table: ChartTable; labelledBy: string }> = ({ table, labelledBy }) => (
  <div className="max-h-[320px] overflow-auto -mx-1 px-1">
    <table className="w-full text-[12px]" aria-labelledby={labelledBy}>
      <thead>
        <tr className="text-muted-taupe">
          {table.head.map((h, i) => (
            <th key={h} scope="col" className={`font-semibold pb-2 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-premium-charcoal/[0.06]">
        {table.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) => i === 0
              ? <th key={i} scope="row" className="text-left font-medium text-premium-charcoal py-1.5 pr-3">{cell}</th>
              : <td key={i} className="text-right tabular-nums text-premium-charcoal py-1.5 pl-3">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** Shared hover/focus state for a chart: which item is pointed at. */
export function usePointer<T>() {
  const [active, setActive] = useState<T | null>(null);
  const handlers = (item: T) => ({
    onPointerEnter: () => setActive(item),
    onPointerMove: () => setActive(item),
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setActive(null); },
    onFocus: () => setActive(item),
    onBlur: () => setActive(null),
    onClick: () => setActive(item),
  });
  return { active, setActive, handlers };
}
