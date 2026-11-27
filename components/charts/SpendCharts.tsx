import React from 'react';
import { useWallet } from '../../context/WalletContext';
import type { Split, UsualRow } from '../../services/pulseAnalysis';
import { barPath, ChartCard, columnPath, Legend, ON_FILL, Tooltip, usePointer, useWidth, VIZ } from './kit';

/**
 * Where the month's spending went: one tall bar split into bills, everyday
 * spending and one-offs (three steps of the clay, darkest first), each
 * block printing its share, the legend naming them with their amounts.
 */
export const SplitBar: React.FC<{ split: Split; spent: number; className?: string; children?: React.ReactNode; title?: string }> = ({ split, spent, className, children, title = 'Where it went' }) => {
  const { formatWhole } = useWallet();
  const [ref, width] = useWidth<HTMLDivElement>();
  const { active, handlers, setActive } = usePointer<number>();
  const parts = [
    { label: 'Bills', note: 'rent, utilities, subscriptions', value: split.bills, share: split.shares[0], fill: VIZ.out1, ink: ON_FILL.dark },
    { label: 'Everyday', note: 'food, travel, shopping', value: split.everyday, share: split.shares[1], fill: VIZ.out, ink: ON_FILL.light },
    { label: 'One-offs', note: 'large, unusual payments', value: split.oneOffs, share: split.shares[2], fill: VIZ.out3, ink: ON_FILL.light },
  ];
  const H = 28, GAP = 2;
  const shown = parts.filter(p => p.value > 0);
  const usable = width - GAP * Math.max(0, shown.length - 1);
  let x = 0;
  const blocks = shown.map(p => {
    const w = spent > 0 ? (p.value / spent) * usable : 0;
    const b = { ...p, x, w };
    x += w + GAP;
    return b;
  });
  const tip = active !== null ? blocks[active] : null;

  return (
    <ChartCard
      className={className}
      title={title}
      table={{ head: ['Kind', 'Amount', 'Share'], rows: parts.map(p => [p.label, formatWhole(p.value), `${p.share}%`]) }}
    >
      {spent > 0 ? (
        <div ref={ref} className="relative select-none" onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null); }}>
          <svg
            width={width} height={H} className="block" role="group"
            aria-label={`Spending: ${parts.map(p => `${p.label.toLowerCase()} ${p.share}%, ${formatWhole(p.value)}`).join('; ')}`}
          >
            {blocks.map((b, i) => (
              <g key={b.label} {...handlers(i)} tabIndex={0} role="img" aria-label={`${b.label}: ${formatWhole(b.value)}, ${b.share}%`} className="outline-none">
                <rect x={b.x} y={0} width={Math.max(0.5, b.w)} height={H} rx={Math.min(4, b.w / 2)} fill={b.fill} opacity={active === null || active === i ? 1 : 0.55} />
                {b.w >= 44 && (
                  <text x={b.x + 8} y={H / 2} dy="0.35em" fill={b.ink} className="text-[12px] font-semibold tabular-nums">{b.share}%</text>
                )}
              </g>
            ))}
          </svg>
          {tip && (
            <Tooltip x={tip.x + tip.w / 2} y={0} width={width} title={tip.label} rows={[{ value: formatWhole(tip.value), label: `${tip.share}% of spending` }]} />
          )}
          <ul className="mt-3 space-y-1.5">
            {parts.map(p => (
              <li key={p.label} className="flex items-center gap-2 text-[12px]">
                <svg width="10" height="10" aria-hidden="true" className="shrink-0"><rect width="10" height="10" rx="2" fill={p.fill} /></svg>
                <span className="font-semibold text-premium-charcoal">{p.label}</span>
                <span className="text-muted-taupe truncate">{p.note}</span>
                <span className="ml-auto font-semibold text-premium-charcoal tabular-nums">{formatWhole(p.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] text-muted-taupe">Nothing spent this month.</p>
      )}
      {children}
    </ChartCard>
  );
};

/**
 * Ranked bars: categories or payees, largest first, each with its amount at
 * the end of its row and a thin bar under the name, scaled to the largest.
 */
export const RankedBars: React.FC<{
  rows: { name: string; amount: number; note?: string; icon?: string }[];
  title: string;
  subtitle?: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  head?: [string, string];
  onRow?: (name: string) => void;
}> = ({ rows, title, subtitle, className, footer, head = ['Name', 'Amount'], onRow }) => {
  const { formatWhole } = useWallet();
  const max = Math.max(1, ...rows.map(r => r.amount));
  return (
    <ChartCard
      className={className}
      title={title}
      subtitle={subtitle}
      table={{ head: [...head, ''], rows: rows.map(r => [r.name, formatWhole(r.amount), r.note ?? '']) }}
      footer={footer}
    >
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-taupe">Nothing to show for this month.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(r => {
            const inner = (
              <>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold text-premium-charcoal truncate">{r.name}</span>
                  <span className="text-[13px] font-semibold text-premium-charcoal tabular-nums shrink-0">{formatWhole(r.amount)}</span>
                </span>
                <svg width="100%" height="8" className="block mt-1.5" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 8">
                  <rect x="0" y="0" width="100" height="8" rx="4" fill={VIZ.grid} />
                  <rect x="0" y="0" width={Math.max(1.5, (r.amount / max) * 100)} height="8" rx="4" fill={VIZ.out} />
                </svg>
                {r.note && <span className="block text-[11px] text-muted-taupe mt-1 tabular-nums">{r.note}</span>}
              </>
            );
            return (
              <li key={r.name}>
                {onRow
                  ? <button onClick={() => onRow(r.name)} className="w-full text-left rounded-xl -mx-1 px-1 py-0.5 hover:bg-zen-bg transition-colors">{inner}</button>
                  : inner}
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
};

/**
 * Compared with your usual: for each category that changed most, a bar from
 * the middle line, right (clay) when this month is above its usual, left
 * (teal) when below; the change at the end of each row.
 */
export const UsualBars: React.FC<{ rows: UsualRow[]; basis: string; className?: string }> = ({ rows, basis, className }) => {
  const { formatWhole } = useWallet();
  const [ref, width] = useWidth<HTMLDivElement>();
  const { active, handlers, setActive } = usePointer<number>();
  const shownRows = rows.filter(r => Math.round(r.delta) !== 0);
  const max = Math.max(1, ...shownRows.map(r => Math.abs(r.delta)));
  const mid = width / 2, H = 10, half = mid - 2;
  const tip = active !== null ? shownRows[active] : null;
  return (
    <ChartCard
      className={className}
      title="Compared with your usual"
      subtitle={basis}
      legend={[{ label: 'More than usual', color: VIZ.out }, { label: 'Less than usual', color: VIZ.in }]}
      table={{
        head: ['Category', 'This month', 'Usual', 'Change'],
        rows: shownRows.map(r => [r.category, formatWhole(r.now), r.usual > 0 ? formatWhole(r.usual) : 'none', `${r.delta >= 0 ? '+' : '−'}${formatWhole(Math.abs(r.delta))}`]),
      }}
    >
      {shownRows.length === 0 ? (
        <p className="text-[13px] text-muted-taupe">Every category is close to its usual.</p>
      ) : (
        <div ref={ref} className="relative" onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null); }}>
          <ul className="space-y-3">
            {shownRows.map((r, i) => {
              const len = (Math.abs(r.delta) / max) * half;
              const up = r.delta > 0;
              return (
                <li key={r.category} {...handlers(i)} tabIndex={0} className="relative outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-sage"
                  aria-label={`${r.category}: ${formatWhole(r.now)} this month against ${r.usual > 0 ? formatWhole(r.usual) : 'nothing'} usually, ${up ? 'up' : 'down'} ${formatWhole(Math.abs(r.delta))}`}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-semibold text-premium-charcoal truncate">{r.category}</span>
                    <span className="text-[13px] font-semibold text-premium-charcoal tabular-nums shrink-0">
                      {up ? '+' : '−'}{formatWhole(Math.abs(r.delta))}
                      {r.usual === 0 && <span className="text-muted-taupe font-normal"> new</span>}
                    </span>
                  </span>
                  <svg width={width} height={H + 4} className="block mt-1" aria-hidden="true">
                    <line x1={mid} x2={mid} y1={0} y2={H + 4} stroke={VIZ.axis} strokeWidth="1" shapeRendering="crispEdges" />
                    <path d={barPath(up ? mid + 1 : mid - 1, 2, Math.max(2, len), H, !up)} fill={up ? VIZ.out : VIZ.in} opacity={active === null || active === i ? 1 : 0.55} />
                  </svg>
                  {tip && active === i && (
                    <Tooltip
                      x={mid} y={0} width={width} title={tip.category}
                      rows={[
                        { color: tip.delta > 0 ? VIZ.out : VIZ.in, value: formatWhole(tip.now), label: 'this month' },
                        { value: tip.usual > 0 ? formatWhole(tip.usual) : 'Nothing', label: 'usually' },
                      ]}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ChartCard>
  );
};

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/** Everyday spending a day on each weekday; the busiest labelled on its cap. */
export const WeekdayBars: React.FC<{ weekdays: { avg: number; days: number }[]; className?: string }> = ({ weekdays, className }) => {
  const { formatWhole, formatAmountCompact } = useWallet();
  const [ref, width] = useWidth<HTMLDivElement>();
  const { active, handlers, setActive } = usePointer<number>();
  const PLOT = 96, TOP = 18, AXIS = 20;
  const max = Math.max(1, ...weekdays.map(w => w.avg));
  const busiest = weekdays.reduce((b, w, i) => (w.avg > weekdays[b].avg ? i : b), 0);
  const band = width / 7;
  const bar = Math.min(24, band * 0.56);
  const y = (v: number) => TOP + PLOT - (v / max) * PLOT;
  const tip = active !== null ? weekdays[active] : null;
  return (
    <ChartCard
      className={className}
      title="Weekdays"
      subtitle="Everyday spending a day; bills and one-offs left out"
      table={{ head: ['Day', 'A day', 'Days'], rows: weekdays.map((w, i) => [WEEKDAY[i], formatWhole(w.avg), w.days]) }}
      footer={weekdays[busiest].avg > 0 ? <>{WEEKDAYS_LONG[busiest]} cost the most, about {formatWhole(weekdays[busiest].avg)} a day.</> : undefined}
    >
      <div ref={ref} className="relative select-none" onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null); }}>
        <svg width={width} height={TOP + PLOT + AXIS} className="block overflow-visible" role="group" aria-label="Everyday spending a day by weekday">
          <line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={VIZ.axis} strokeWidth="1" shapeRendering="crispEdges" />
          {weekdays.map((w, i) => {
            const x = i * band + (band - bar) / 2;
            return (
              <g key={i}>
                <path d={columnPath(x, y(w.avg), bar, y(0) - y(w.avg))} fill={VIZ.out} opacity={active === null || active === i ? 1 : 0.55} />
                {i === busiest && w.avg > 0 && (
                  <text x={x + bar / 2} y={y(w.avg) - 6} textAnchor="middle" className="fill-premium-charcoal text-[11px] font-semibold tabular-nums">{formatAmountCompact(w.avg)}</text>
                )}
                <text x={i * band + band / 2} y={TOP + PLOT + 15} textAnchor="middle" className={`text-[11px] ${i === busiest ? 'fill-premium-charcoal font-semibold' : 'fill-muted-taupe'}`}>{WEEKDAY[i]}</text>
                <rect x={i * band} y={0} width={band} height={TOP + PLOT + AXIS} fill="transparent" tabIndex={0} role="img" className="outline-none"
                  aria-label={`${WEEKDAYS_LONG[i]}: about ${formatWhole(w.avg)} a day over ${w.days} days`} {...handlers(i)} />
              </g>
            );
          })}
        </svg>
        {tip && active !== null && (
          <Tooltip x={active * band + band / 2} y={Math.max(y(tip.avg), 56)} width={width} title={WEEKDAYS_LONG[active]}
            rows={[{ color: VIZ.out, value: formatWhole(tip.avg), label: `a day, over ${tip.days} ${tip.days === 1 ? 'day' : 'days'}` }]} />
        )}
      </div>
    </ChartCard>
  );
};

/**
 * The month as a calendar: each day shaded by what was spent (one hue,
 * light to dark in five steps), tap a day for its payments.
 */
export const CalendarHeat: React.FC<{
  daily: number[];
  year: number;
  month: number;
  through: number;
  selected: number | null;
  onSelect: (day: number | null) => void;
  className?: string;
  children?: React.ReactNode;
}> = ({ daily, year, month, through, selected, onSelect, className, children }) => {
  const { formatWhole } = useWallet();
  const firstWeekday = new Date(year, month, 1).getDay();
  const spentDays = daily.filter(v => v > 0).sort((a, b) => a - b);
  // Five steps by quintile of the days with spending, so one big day doesn't wash the rest out.
  const cut = (q: number) => spentDays[Math.min(spentDays.length - 1, Math.floor(q * spentDays.length))] ?? 0;
  const edges = [cut(0.2), cut(0.4), cut(0.6), cut(0.8)];
  const step = (v: number) => (v <= 0 ? -1 : edges.filter(e => v > e).length);
  const OPACITY = [0.16, 0.32, 0.5, 0.72, 1];
  const dark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme-dark') === '1';
  // Day numbers: ink on the lighter steps; near-black on the darker ones in
  // light themes and on the full step in dark themes (4.5:1 or better).
  const textOn = (s: number) => (s >= (dark ? 4 : 3) ? ON_FILL.light : 'var(--ink)');
  const quiet = daily.slice(0, through).filter(v => v === 0).length;
  return (
    <ChartCard
      className={className}
      title="Day by day"
      subtitle="Darker days cost more; tap a day to see it"
      table={{ head: ['Day', 'Spent'], rows: daily.map((v, i) => [i + 1, i + 1 > through ? '–' : formatWhole(v)]) }}
      footer={<>{quiet} {quiet === 1 ? 'day' : 'days'} without spending, out of {through}.</>}
    >
      <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
        {WEEKDAY.map(d => <span key={d} className="text-center text-[10px] font-semibold text-muted-taupe">{d.slice(0, 2)}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }, (_, i) => <span key={`pad${i}`} />)}
        {daily.map((v, i) => {
          const d = i + 1;
          const s = step(v);
          const future = d > through;
          const on = selected === d;
          return (
            <button
              key={d}
              onClick={() => onSelect(on ? null : d)}
              disabled={future}
              aria-pressed={on}
              aria-label={`${d}: ${future ? 'not yet' : v > 0 ? formatWhole(v) : 'nothing spent'}`}
              className={`relative overflow-hidden aspect-square rounded-lg flex items-center justify-center text-[11px] font-semibold tabular-nums transition-shadow disabled:opacity-40 ${on ? 'ring-2 ring-premium-charcoal' : ''}`}
              style={{ background: s < 0 ? 'var(--line)' : 'var(--card)' }}
            >
              {s >= 0 && <span className="absolute inset-0" style={{ background: VIZ.out, opacity: OPACITY[s] }} aria-hidden="true" />}
              <span className="relative" style={{ color: textOn(s) }}>{d}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-muted-taupe" aria-hidden="true">
        <span>Less</span>
        {OPACITY.map(o => <span key={o} className="w-4 h-3 rounded" style={{ background: VIZ.out, opacity: o }} />)}
        <span>More</span>
      </div>
      {children}
    </ChartCard>
  );
};

export { Legend };
