/**
 * The Wall·ette Wrapped card: a 1080×1920 picture (a phone story's size) of
 * one year, drawn on a canvas in the app's material (stitched sage denim),
 * with the vector wordmark and mascot, so it stays sharp wherever it's sent.
 *
 * Amounts are left off unless the person turns them on: the card says the
 * year in shares (kept, where it went), months and days, which is what
 * people are happy to post. Payees are never on it.
 */
import type { WrappedYear } from '../services/wrapped';
import { MONTH_SHORT, percent } from '../services/wrapped';

export const CARD_W = 1080;
export const CARD_H = 1920;

const INK = '#FBFAF6';
const MUT = 'rgba(251,250,246,0.78)';
const FAINT = 'rgba(251,250,246,0.55)';
const SAGE_TOP = '#5B7543';
const SAGE_BOTTOM = '#3A5030';
const LEAF = '#C9D8A8';
const ROSE = '#F2C4B6';

const DISPLAY = '"Manrope Variable", Manrope, system-ui, sans-serif';
const BODY = '"Inter Variable", Inter, system-ui, sans-serif';

export interface CardInput {
  year: WrappedYear;
  /** Formats an amount in the shown currency ("₹12,400"). */
  money: (n: number) => string;
  showAmounts: boolean;
  /** The mascot pose's image (an SVG with its own width and height). */
  mascot: { src: string; w: number; h: number };
  /** The wordmark's SVG source (fill="currentColor"). */
  wordmarkSvg: string;
  host: string;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${src.slice(0, 40)}`));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A pocket sewn onto the denim, as on Home's wallet card. */
function pocket(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 40);
  ctx.fillStyle = 'rgba(0,0,0,0.17)';
  ctx.fill();
  ctx.clip();
  // the inner shadow along the top edge
  const g = ctx.createLinearGradient(0, y, 0, y + 26);
  g.addColorStop(0, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, 26);
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left', maxWidth?: number) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  let v = value;
  if (maxWidth) while (v.length > 1 && ctx.measureText(v).width > maxWidth) v = `${v.slice(0, -2)}…`;
  ctx.fillText(v, x, y);
}

/** Draws the card for one year onto `canvas` (sized to 1080×1920). */
export async function drawWrappedCard(canvas: HTMLCanvasElement, input: CardInput): Promise<void> {
  const { year: y, money, showAmounts } = input;
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas');

  // The brand's type, loaded before drawing so the canvas uses it.
  await Promise.all([`700 200px ${DISPLAY}`, `700 64px ${DISPLAY}`, `600 40px ${BODY}`, `500 34px ${BODY}`]
    .map(f => document.fonts?.load(f).catch(() => undefined)));
  const wordmark = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    input.wordmarkSvg.replace('fill="currentColor"', `fill="${INK}"`).replace('fill="#97AA6D"', `fill="${LEAF}"`),
  )}`);
  const mascot = await load(input.mascot.src);

  // Denim: the sage gradient, a fine weave, and stitching inset from the edge.
  const bg = ctx.createLinearGradient(0, 0, CARD_W * 0.55, CARD_H);
  bg.addColorStop(0, SAGE_TOP);
  bg.addColorStop(1, SAGE_BOTTOM);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const weave = document.createElement('canvas');
  weave.width = 12; weave.height = 12;
  const w = weave.getContext('2d');
  if (w) {
    w.strokeStyle = 'rgba(255,255,255,0.045)'; w.lineWidth = 1.5;
    w.beginPath(); w.moveTo(0, 12); w.lineTo(12, 0); w.stroke();
    w.strokeStyle = 'rgba(0,0,0,0.05)';
    w.beginPath(); w.moveTo(0, 0); w.lineTo(12, 12); w.stroke();
    const pattern = ctx.createPattern(weave, 'repeat');
    if (pattern) { ctx.fillStyle = pattern; ctx.fillRect(0, 0, CARD_W, CARD_H); }
  }
  ctx.save();
  ctx.setLineDash([22, 14]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.26)';
  roundRect(ctx, 34, 34, CARD_W - 68, CARD_H - 68, 70);
  ctx.stroke();
  ctx.restore();

  const left = 110;
  const right = CARD_W - 110;
  const width = right - left;

  // Wordmark and "Wrapped"
  const wmH = 60;
  const wmW = Math.round((wmH * 933) / 176);
  ctx.drawImage(wordmark, left, 118, wmW, wmH);
  text(ctx, 'Wrapped', left + wmW + 24, 168, `600 42px ${BODY}`, MUT);

  // The year, with the mascot to its right
  text(ctx, String(y.year), left - 6, 380, `800 190px ${DISPLAY}`, INK);
  if (y.current) text(ctx, 'so far', left + 4, 440, `600 40px ${BODY}`, MUT);
  const mh = 310;
  const mw = Math.round((mh * input.mascot.w) / input.mascot.h);
  ctx.drawImage(mascot, right - mw + 24, 190, mw, mh);

  // The two facts sit at the foot; everything else fits above them.
  const factsH = 180;
  const factsLimit = CARD_H - 170 - factsH;

  // Kept: the headline, in shares; amounts only when asked for.
  let top = 510;
  const keptH = showAmounts ? 300 : 220;
  pocket(ctx, left, top, width, keptH);
  const kept = y.kept >= 0;
  const headline = y.rate === null
    ? (y.out > 0 ? 'Nothing came in' : 'Nothing went out')
    : kept ? `Kept ${percent(y.rate / 100)}` : `Spent ${percent(-y.rate / 100)} more`;
  text(ctx, y.rate === null ? 'This year' : 'Of what came in', left + 52, top + 74, `600 36px ${BODY}`, MUT);
  text(ctx, headline, left + 52, top + 166, `800 96px ${DISPLAY}`, kept ? INK : ROSE, 'left', width - 104);
  if (showAmounts) {
    text(ctx, `In ${money(y.inc)}`, left + 52, top + 252, `600 40px ${BODY}`, INK, 'left', width / 2 - 64);
    text(ctx, `Out ${money(y.out)}`, left + width / 2 + 12, top + 252, `600 40px ${BODY}`, INK, 'left', width / 2 - 64);
  }
  top += keptH + 44;

  // Where it went: the top categories, as shares of spending.
  if (y.categories.length > 0) {
    text(ctx, 'Where it went', left, top + 40, `700 44px ${DISPLAY}`, INK);
    top += 70;
    for (const c of y.categories) {
      text(ctx, c.name, left, top + 36, `600 38px ${BODY}`, INK, 'left', width - 220);
      text(ctx, showAmounts ? money(c.amount) : percent(c.share), right, top + 36, `600 38px ${BODY}`, MUT, 'right');
      roundRect(ctx, left, top + 52, width, 14, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();
      roundRect(ctx, left, top + 52, Math.max(14, width * c.share), 14, 7);
      ctx.fillStyle = LEAF;
      ctx.fill();
      top += 88;
    }
    top += 24;
  }

  // The year by month: twelve bars, the busiest one bright, as tall as fits.
  if (y.busiestMonth !== null) {
    const chartTop = top + 60;
    const chartH = Math.min(240, factsLimit - 40 - chartTop - 70);
    if (chartH >= 80) {
      text(ctx, 'My year by month', left, top + 40, `700 44px ${DISPLAY}`, INK);
      const max = Math.max(...y.months, 1);
      const slot = width / 12;
      const barW = slot * 0.56;
      for (let m = 0; m < 12; m++) {
        const h = y.months[m] > 0 ? Math.max(12, (y.months[m] / max) * chartH) : 6;
        const x = left + m * slot + (slot - barW) / 2;
        roundRect(ctx, x, chartTop + chartH - h, barW, h, Math.min(12, barW / 2, h / 2));
        ctx.fillStyle = m === y.busiestMonth ? LEAF : 'rgba(251,250,246,0.30)';
        ctx.fill();
        text(ctx, MONTH_SHORT[m][0], x + barW / 2, chartTop + chartH + 46, `600 30px ${BODY}`, m === y.busiestMonth ? INK : FAINT, 'center');
      }
      top = chartTop + chartH + 70;
    }
  }

  // Two facts as pockets: quiet days and entries.
  const factsTop = Math.min(factsLimit, top + 40);
  const half = (width - 30) / 2;
  const facts: [string, string][] = [
    [y.noSpendDays.toLocaleString('en-IN'), y.noSpendDays === 1 ? 'no-spend day' : 'no-spend days'],
    [y.entries.toLocaleString('en-IN'), y.entries === 1 ? 'entry tallied' : 'entries tallied'],
  ];
  facts.forEach(([value, label], i) => {
    const x = left + i * (half + 30);
    pocket(ctx, x, factsTop, half, factsH);
    text(ctx, value, x + 44, factsTop + 94, `800 68px ${DISPLAY}`, INK, 'left', half - 88);
    text(ctx, label, x + 44, factsTop + 146, `500 34px ${BODY}`, MUT, 'left', half - 88);
  });

  text(ctx, `Tallied from my own entries · ${input.host}`, CARD_W / 2, CARD_H - 96, `500 32px ${BODY}`, FAINT, 'center');
}
