import React from 'react';
import { useWallet } from '../../context/WalletContext';
import type { Compare, Pace } from '../../services/pulseAnalysis';
import { ChartCard, niceTicks, Tooltip, useWidth, VIZ } from './kit';

/**
 * Spending pace: the month's spending added up day by day (clay) against the
 * month before (its quiet step). In the live month the line stops at the
 * newest day the entries cover, with a dotted line to where the month is
 * heading (services/pulseAnalysis.ts explains the projection).
 */
const PaceChart: React.FC<{
  pace: Pace;
  compare: Compare | null;
  /** 'November' */
  monthName: string;
  /** 'October' */
  prevName: string;
  /** 'Nov' */
  monthShort: string;
  className?: string;
}> = ({ pace, compare, monthName, prevName, monthShort, className }) => {
  const { formatWhole, formatAmountCompact, shownRate } = useWallet();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [day, setDay] = React.useState<number | null>(null);

  // The month before is drawn only when it's a fair comparison (fully covered).
  const before = compare ? pace.before : [];
  const PLOT = 160, TOP = 22, AXIS = 22, LEFT = 46, RIGHT = 10;
  const days = Math.max(pace.daysInMonth, before.length);
  const end = pace.through;
  const endValue = end > 0 ? pace.now[end - 1] ?? 0 : 0;
  const projecting = pace.projected !== null && end < pace.daysInMonth;
  const max = Math.max(0, endValue, before[before.length - 1] ?? 0, pace.projected ?? 0);
  const ticks = niceTicks(max, shownRate, 3);
  const top = ticks[ticks.length - 1] || 1;
  const x = (d: number) => LEFT + ((d - 1) / Math.max(1, days - 1)) * (width - LEFT - RIGHT);
  const y = (v: number) => TOP + PLOT - (v / top) * PLOT;

  const points = (vals: (number | null)[]) => vals
    .map((v, i) => (v === null ? null : `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');
  const nowPts = pace.now.slice(0, end);
  const area = nowPts.length > 1 ? `M${x(1)},${y(0)} L${points(nowPts)} L${x(end)},${y(0)} Z` : '';
  const xTicks = [1, 8, 15, 22, days].filter((d, i, a) => a.indexOf(d) === i && (d === days || days - d >= 4));

  // Crosshair: the nearest day to the pointer, or the arrow keys.
  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const d = Math.round(((clientX - r.left - LEFT) / (width - LEFT - RIGHT)) * (days - 1)) + 1;
    setDay(Math.max(1, Math.min(days, d)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setDay(d => Math.min(days, (d ?? 0) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setDay(d => Math.max(1, (d ?? 2) - 1)); }
  };

  const nowAt = (d: number) => (d <= end ? pace.now[d - 1] ?? null : null);
  const beforeAt = (d: number) => (d <= before.length ? before[d - 1] : null);
  const courseAt = (d: number) => (projecting && d > end && d <= pace.daysInMonth
    ? endValue + ((pace.projected! - endValue) * (d - end)) / (pace.daysInMonth - end)
    : null);
  const tipRows = day === null ? [] : [
    ...(nowAt(day) !== null ? [{ color: VIZ.out, value: formatWhole(nowAt(day)!), label: monthName }] : []),
    ...(courseAt(day) !== null ? [{ color: VIZ.out, kind: 'dash' as const, value: formatWhole(courseAt(day)!), label: 'on course' }] : []),
    ...(beforeAt(day) !== null ? [{ color: VIZ.ctx, value: formatWhole(beforeAt(day)!), label: prevName }] : []),
  ];

  const p = pace.projection;
  const footer = end === 0 ? null : (
    <>
      {pace.behind && <>Entries up to {end} {monthShort}. </>}
      {compare?.kind === 'sameDay'
        ? <>{formatWhole(compare.now)} by day {compare.day}, {formatWhole(Math.abs(compare.now - compare.before))} {compare.now >= compare.before ? 'more' : 'less'} than by the same day of {prevName}.</>
        : compare?.kind === 'month'
          ? <>{formatWhole(compare.now)} in {monthName}, against {formatWhole(compare.before)} in {prevName}.</>
          : pace.today !== null ? <>{formatWhole(endValue)} by day {end}.</> : <>{formatWhole(endValue)} in {monthName}.</>}
      {projecting && p && (
        <> On course for <span className="font-semibold text-premium-charcoal">{formatWhole(pace.projected!)}</span>: everyday spending at about {formatWhole(p.everydayPerDay)} a day for the rest of the month{p.billsToCome > 0 ? <>, plus {formatWhole(p.billsToCome)} of bills still due</> : null}. Bills and one-offs already paid aren't run forward.</>
      )}
    </>
  );

  if (end === 0) {
    return (
      <ChartCard className={className} title="Spending pace">
        <p className="text-[13px] text-muted-taupe">No entries for {monthName} yet.</p>
      </ChartCard>
    );
  }

  const endLabelLeft = x(end) > width - 96;
  // Keep the end label clear of the projection's label at the right edge.
  const endLabelBelow = projecting && endLabelLeft && Math.abs(y(endValue) - y(pace.projected!)) < 18;

  return (
    <ChartCard
      className={className}
      title="Spending pace"
      subtitle="Spending added up day by day"
      legend={[
        { label: monthName, color: VIZ.out, kind: 'line' },
        ...(before.length ? [{ label: prevName, color: VIZ.ctx, kind: 'line' as const }] : []),
        ...(projecting ? [{ label: 'On course', color: VIZ.out, kind: 'dash' as const }] : []),
      ]}
      table={{
        head: before.length ? ['Day', monthName, prevName] : ['Day', monthName],
        rows: Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const mine = nowAt(d) !== null ? formatWhole(nowAt(d)!) : courseAt(d) !== null ? `${formatWhole(courseAt(d)!)} (on course)` : '–';
          return before.length ? [d, mine, beforeAt(d) !== null ? formatWhole(beforeAt(d)!) : '–'] : [d, mine];
        }),
      }}
      footer={footer}
    >
      <div ref={ref} className="relative select-none touch-pan-y">
        <svg
          width={width} height={TOP + PLOT + AXIS}
          className="block overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-sage rounded-xl"
          role="img" tabIndex={0}
          aria-label={`Spending pace. ${monthName}: ${formatWhole(endValue)} by day ${end}.${before.length ? ` ${prevName}: ${formatWhole(before[before.length - 1])}.` : ''}${projecting ? ` On course for ${formatWhole(pace.projected!)}.` : ''} Use the arrow keys to read each day.`}
          onPointerMove={e => pick(e.clientX, e.currentTarget)}
          onPointerDown={e => pick(e.clientX, e.currentTarget)}
          onPointerLeave={e => { if (e.pointerType === 'mouse') setDay(null); }}
          onKeyDown={onKey}
          onBlur={() => setDay(null)}
        >
          {ticks.map(t => (
            <g key={t}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth="1" shapeRendering="crispEdges" />
              <text x={LEFT - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-taupe text-[11px] tabular-nums">{formatAmountCompact(t)}</text>
            </g>
          ))}
          {xTicks.map(d => (
            <text key={d} x={x(d)} y={TOP + PLOT + 16} textAnchor={d === 1 ? 'start' : d === days ? 'end' : 'middle'} className="fill-muted-taupe text-[11px] tabular-nums">{d}</text>
          ))}
          {day !== null && <line x1={x(day)} x2={x(day)} y1={TOP} y2={TOP + PLOT} stroke={VIZ.axis} strokeWidth="1" shapeRendering="crispEdges" />}
          {before.length > 1 && (
            <polyline points={points(before)} fill="none" stroke={VIZ.ctx} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {area && <path d={area} fill={VIZ.out} opacity="0.1" />}
          {projecting && (
            <line x1={x(end)} y1={y(endValue)} x2={x(pace.daysInMonth)} y2={y(pace.projected!)} stroke={VIZ.out} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 5" />
          )}
          {nowPts.length > 1 && (
            <polyline points={points(nowPts)} fill="none" stroke={VIZ.out} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {day !== null && beforeAt(day) !== null && <circle cx={x(day)} cy={y(beforeAt(day)!)} r="4" fill={VIZ.ctx} stroke={VIZ.surface} strokeWidth="2" />}
          {day !== null && nowAt(day) !== null && day !== end && <circle cx={x(day)} cy={y(nowAt(day)!)} r="4" fill={VIZ.out} stroke={VIZ.surface} strokeWidth="2" />}
          {day !== null && courseAt(day) !== null && <circle cx={x(day)} cy={y(courseAt(day)!)} r="4" fill={VIZ.surface} stroke={VIZ.out} strokeWidth="2" />}
          {/* The end of the month's line, labelled */}
          <circle cx={x(end)} cy={y(endValue)} r="4.5" fill={VIZ.out} stroke={VIZ.surface} strokeWidth="2" />
          <text
            x={x(end) + (endLabelLeft ? -8 : 8)} y={endLabelBelow ? y(endValue) + 20 : y(endValue) - 10}
            textAnchor={endLabelLeft ? 'end' : 'start'}
            className="fill-premium-charcoal text-[12px] font-semibold tabular-nums"
          >
            {formatAmountCompact(endValue)}
          </text>
          {projecting && (
            <text x={x(pace.daysInMonth)} y={y(pace.projected!) - 10} textAnchor="end" className="fill-muted-taupe text-[11px] tabular-nums">
              {formatAmountCompact(pace.projected!)}
            </text>
          )}
        </svg>
        {day !== null && tipRows.length > 0 && (
          <Tooltip x={x(day)} y={TOP} width={width} title={`${day} ${monthShort}`} rows={tipRows} place="side" />
        )}
      </div>
    </ChartCard>
  );
};

export default PaceChart;
