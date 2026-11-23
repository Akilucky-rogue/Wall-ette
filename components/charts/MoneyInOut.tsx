import React from 'react';
import { useWallet } from '../../context/WalletContext';
import type { MonthPoint } from '../../services/pulseAnalysis';
import { ChartCard, columnPath, niceTicks, Tooltip, usePointer, useWidth, VIZ } from './kit';

/**
 * Money in and out: six months of what came in (blue) beside what was spent
 * (orange), the month on show labelled in ink.
 */
const MoneyInOut: React.FC<{ months: MonthPoint[]; selectedKey: string; liveKey: string; className?: string }> = ({ months, selectedKey, liveKey, className }) => {
  const { formatWhole, formatAmountCompact, shownRate } = useWallet();
  const [ref, width] = useWidth<HTMLDivElement>();
  const { active, handlers, setActive } = usePointer<number>();

  const PLOT = 150, TOP = 8, AXIS = 22, LEFT = 46, RIGHT = 2;
  const max = Math.max(0, ...months.map(m => Math.max(m.cameIn, m.spent)));
  const ticks = niceTicks(max, shownRate, 3);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => TOP + PLOT - (v / top) * PLOT;
  const band = (width - LEFT - RIGHT) / months.length;
  const bar = Math.max(6, Math.min(24, (band * 0.7 - 2) / 2));
  const groupX = (i: number) => LEFT + i * band + (band - (bar * 2 + 2)) / 2;

  const tip = active !== null ? months[active] : null;
  const kept = (m: MonthPoint) => m.cameIn - m.spent;
  const last = months[months.length - 1]?.key;
  /** A month the data doesn't fully cover says so. */
  const note = (m: MonthPoint) => (!m.hasData || m.complete ? '' : m.key === last && m.key === liveKey ? 'so far' : 'part month');

  return (
    <ChartCard
      className={className}
      title="Money in and out"
      subtitle="The last six months"
      legend={[{ label: 'Came in', color: VIZ.in }, { label: 'Spent', color: VIZ.out }]}
      table={{
        head: ['Month', 'Came in', 'Spent', 'Kept'],
        rows: months.map(m => m.hasData
          ? [note(m) ? `${m.label} (${note(m)})` : m.label, formatWhole(m.cameIn), formatWhole(m.spent), m.cameIn > 0 ? formatWhole(kept(m)) : '–']
          : [m.label, '–', '–', '–']),
      }}
    >
      <div ref={ref} className="relative select-none" onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null); }}>
        <svg width={width} height={TOP + PLOT + AXIS} role="group" aria-label="Money in and out, the last six months" className="block overflow-visible">
          {ticks.map(t => (
            <g key={t}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth="1" shapeRendering="crispEdges" />
              <text x={LEFT - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-taupe text-[11px] tabular-nums">{formatAmountCompact(t)}</text>
            </g>
          ))}
          {months.map((m, i) => {
            const x = groupX(i);
            const on = active === i;
            return (
              <g key={m.key}>
                {on && <rect x={LEFT + i * band + 2} y={TOP} width={band - 4} height={PLOT} rx="8" className="fill-premium-charcoal/[0.04]" />}
                <path d={columnPath(x, y(m.cameIn), bar, y(0) - y(m.cameIn))} fill={VIZ.in} />
                <path d={columnPath(x + bar + 2, y(m.spent), bar, y(0) - y(m.spent))} fill={VIZ.out} />
                <text
                  x={LEFT + i * band + band / 2} y={TOP + PLOT + 16} textAnchor="middle"
                  className={`text-[11px] ${m.key === selectedKey ? 'fill-premium-charcoal font-semibold' : 'fill-muted-taupe'}`}
                >
                  {m.label}
                </text>
                <rect
                  x={LEFT + i * band} y={0} width={band} height={TOP + PLOT + AXIS} fill="transparent"
                  tabIndex={0} role="img" className="outline-none focus-visible:stroke-sage focus-visible:stroke-2"
                  aria-label={m.hasData ? `${m.label}${note(m) ? `, ${note(m)}` : ''}: came in ${formatWhole(m.cameIn)}, spent ${formatWhole(m.spent)}` : `${m.label}: no entries`}
                  {...handlers(i)}
                />
              </g>
            );
          })}
        </svg>
        {tip && active !== null && (
          <Tooltip
            x={LEFT + active * band + band / 2}
            y={Math.max(y(Math.max(tip.cameIn, tip.spent)), 64)}
            width={width}
            title={note(tip) ? `${tip.label}, ${note(tip)}` : tip.label}
            rows={tip.hasData ? [
              { color: VIZ.in, value: formatWhole(tip.cameIn), label: 'came in' },
              { color: VIZ.out, value: formatWhole(tip.spent), label: 'spent' },
              ...(tip.cameIn > 0 ? [{ value: formatWhole(Math.abs(kept(tip))), label: kept(tip) >= 0 ? 'kept' : 'more out than in' }] : []),
            ] : [{ value: 'No entries', label: '' }]}
          />
        )}
      </div>
    </ChartCard>
  );
};

export default MoneyInOut;
