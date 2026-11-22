/**
 * Statement PDFs from banks other than IDFC FIRST: Kotak Mahindra, Saraswat
 * Co-operative, Union Bank of India and State Bank of India.
 *
 * Each bank draws its own table, so each has a layout below: how a row's date
 * looks, where its narration sits (some put a line above the date, some
 * below), how amounts are written, and where the bank prints its totals.
 * Rows are rebuilt from the positioned text pdf.js returns.
 *
 * Every one of these statements prints a running balance on each row, so the
 * balance decides whether money came in or went out: it must move by the
 * row's amount, up or down. That also checks every row, to the paisa, and the
 * bank's own totals and closing balance check the whole statement.
 *
 * Pure functions on positioned text, so scripts/check-bank-statements.mjs can
 * test them in Node.
 */

export interface PdfItem { text: string; x: number; y: number; w: number }

export type BankId = 'kotak' | 'saraswat' | 'union' | 'sbi';

/** A statement row, before categories. */
export interface BankRow {
  /** YYYY-MM-DD */
  date: string;
  narration: string;
  /** Always positive; the type says which way it went. */
  amount: number;
  /** The running balance after this row (negative when overdrawn). */
  balance: number;
  type: 'INCOME' | 'EXPENSE';
}

export interface BankStatement {
  bank: BankId;
  bankName: string;
  rows: BankRow[];
  opening: number;
  closing: number;
  totalDebit: number;
  totalCredit: number;
  /** What the bank printed, where it printed it; checked against the rows. */
  printed: { opening?: number; closing?: number; totalDebit?: number; totalCredit?: number };
  /** Rows the running balance doesn't agree with, and totals that differ. */
  errors: string[];
}

// ── Money and dates ─────────────────────────────────────────────────────────

const MONEY = /^(-)?(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?\s*(?:\(\s*(CR|DR)\s*\)|(CR|DR)\.?)?$/i;

/**
 * An amount as statements write it: "1,23,456.78", "99.00(Dr)", "25122 CR",
 * "4.5 CR". Whole numbers count only with a CR/DR mark, so reference numbers
 * and counts aren't taken for money. DR on a balance means overdrawn.
 */
export function readMoney(text: string): { value: number; mark: 'CR' | 'DR' | null } | null {
  const m = MONEY.exec(text.trim());
  if (!m) return null;
  const mark = (m[4] || m[5] || '').toUpperCase() as 'CR' | 'DR' | '';
  if (m[3] === undefined && !mark) return null;
  const value = Number(`${m[2].replace(/,/g, '')}.${m[3] ?? '0'}`);
  return { value: m[1] ? -value : value, mark: mark || null };
}

/** A balance with its CR/DR mark applied. */
const signed = (money: { value: number; mark: 'CR' | 'DR' | null }): number =>
  money.mark === 'DR' ? -Math.abs(money.value) : money.value;

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function isoDate(day: string, month: string, year: string): string | null {
  const mm = /^\d+$/.test(month) ? month.padStart(2, '0') : MONTHS[month.slice(0, 3).toLowerCase()];
  const yyyy = year.length === 2 ? `20${year}` : year;
  const dd = day.padStart(2, '0');
  if (!mm || Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

// ── Layouts ─────────────────────────────────────────────────────────────────

interface Layout {
  bank: BankId;
  name: string;
  /** The bank's name, for statements that don't print their IFSC. */
  names: RegExp;
  /** A row's date, as one text item. */
  date: RegExp;
  /** Dates sit left of this. */
  dateMaxX: number;
  /** The narration column. */
  narrationX: [number, number];
  /** Narration lines this far above a row's date line belong to it. */
  above: number;
  /** And lines up to this far below. */
  below: number;
  /** Characters on a full narration line: a line this long was cut mid-word. */
  lineWidth: number;
  /** Amount right edge left of this: a debit (when the row doesn't say). */
  debitBefore: number;
  /** Layout noise to take out of a narration. */
  tidy?: (narration: string) => string;
  /** The bank's own figures, from the statement's lines. */
  summary: (lines: Line[]) => BankStatement['printed'];
}

interface Line { y: number; items: PdfItem[]; text: string; page: number }

const moneyOn = (line: Line, fromX = 0): number[] =>
  line.items.filter(it => it.x >= fromX).map(it => readMoney(it.text)).filter(Boolean).map(m => signed(m!));

const dmy = (re: RegExp) => (text: string): string | null => {
  const m = re.exec(text);
  return m ? isoDate(m[1], m[2], m[3]) : null;
};

const LAYOUTS: Layout[] = [
  {
    bank: 'kotak',
    name: 'Kotak Mahindra Bank',
    names: /Kotak Mahindra Bank/i,
    date: /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/,
    dateMaxX: 115,
    narrationX: [110, 272],
    above: 0,
    below: 24,
    lineWidth: Infinity, // wraps at spaces
    debitBefore: 428,
    summary: lines => {
      const printed: BankStatement['printed'] = {};
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        // The table's first row: "-  -  Opening Balance  -  -  -  999.99".
        if (printed.opening === undefined && /^-?\s*-?\s*Opening Balance\b/.test(l.text)) {
          const money = moneyOn(l);
          if (money.length) printed.opening = money[money.length - 1];
        }
        // Account Summary: "Opening Balance  Closing Balance", figures below.
        if (/Opening Balance/.test(l.text) && /Closing Balance/.test(l.text)) {
          const next = lines.slice(i + 1, i + 3).find(n => moneyOn(n).length >= 2);
          if (next) {
            const money = moneyOn(next);
            printed.opening = money[money.length - 2];
            printed.closing = money[money.length - 1];
          }
        }
      }
      return printed;
    },
  },
  {
    bank: 'saraswat',
    name: 'Saraswat Co-operative Bank',
    names: /Saraswat\s+Co-?operative\s+Bank|Saraswat\s+Bank/i,
    date: /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/,
    dateMaxX: 80,
    narrationX: [85, 222],
    above: 0,
    below: 14,
    lineWidth: 24, // cut mid-word
    debitBefore: 404,
    summary: lines => {
      const printed: BankStatement['printed'] = {};
      for (const l of lines) {
        const open = /Opening Balance As On\s+[\d/.-]+\s*:\s*(-?[\d,]+(?:\.\d+)?)\s*(CR|DR)?/i.exec(l.text);
        if (open && printed.opening === undefined) {
          const v = Number(open[1].replace(/,/g, ''));
          printed.opening = open[2]?.toUpperCase() === 'DR' ? -v : v;
        }
        // "Totals / Balance :-  <debits>  <credits>  <balance CR>"
        if (/Totals\s*\/\s*Balance/i.test(l.text)) {
          const money = moneyOn(l);
          if (money.length >= 3) {
            printed.totalDebit = money[0];
            printed.totalCredit = money[1];
            printed.closing = money[2];
          }
        }
        if (/Closing Balance As On/i.test(l.text)) {
          const money = moneyOn(l);
          if (money.length) printed.closing = money[money.length - 1];
        }
      }
      return printed;
    },
  },
  {
    bank: 'union',
    name: 'Union Bank of India',
    names: /Union Bank of India/i,
    date: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    dateMaxX: 80,
    narrationX: [165, 362],
    above: 8,
    below: 10,
    lineWidth: 30,
    debitBefore: 430,
    // No totals or opening balance in the statement: the running balance
    // checks every row instead.
    summary: () => ({}),
  },
  {
    bank: 'sbi',
    name: 'State Bank of India',
    names: /State Bank of India/i,
    date: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    dateMaxX: 120,
    narrationX: [130, 300],
    above: 8,
    below: 44,
    lineWidth: 24,
    debitBefore: 400,
    tidy: narration => narration
      // "WDL TFR" / "DEP TFR" (withdrawal / deposit transfer) ahead of a UPI,
      // IMPS or NEFT narration only says which way it went.
      .replace(/^(WDL|DEP)\s+TFR\s+(?=(UPI|IMPS|NEFT|RTGS)\b)/i, '')
      // The branch that posted it: "<13 digits> AT <branch code> <name>".
      .replace(/\s*\d{9,}\s+AT\s+\d{3,6}.*$/i, ''),
    summary: lines => {
      const printed: BankStatement['printed'] = {};
      for (let i = 0; i < lines.length; i++) {
        if (!/Brought Forward/i.test(lines[i].text)) continue;
        // Brought Forward  Dr Count  Cr Count  Total Debits  Total Credits
        // Closing Balance: the counts are whole numbers, so not money.
        const next = lines.slice(i + 1, i + 4).find(n => moneyOn(n).length >= 4);
        if (next) {
          const [opening, debits, credits, closing] = moneyOn(next);
          Object.assign(printed, { opening, totalDebit: debits, totalCredit: credits, closing });
        }
      }
      return printed;
    },
  },
];

const IFSC_PREFIX: Record<string, BankId> = { KKBK: 'kotak', SRCB: 'saraswat', UBIN: 'union', SBIN: 'sbi' };

/**
 * Which of these banks issued the statement, from its text, or null for any
 * other bank (IDFC FIRST has its own parser). The account's IFSC, printed by
 * its label, decides; a bank's name can also turn up in a narration
 * ("UPI/…/SBI Card/…", "NEFT from State Bank of India"), so it only counts
 * when there's no IFSC.
 */
export function detectBank(text: string): BankId | null {
  // Other columns' figures can sit between the label and the code.
  const own = /IFSC(?:\s*Code)?[\s:.\-\d]{0,40}?\b([A-Z]{4})0[A-Z0-9]{6}\b/i.exec(text);
  if (own) return IFSC_PREFIX[own[1].toUpperCase()] ?? null;
  if (/IDFC\s*FIRST/i.test(text)) return null;
  return LAYOUTS.find(l => l.names.test(text))?.bank ?? null;
}

// ── Rows ────────────────────────────────────────────────────────────────────

/** Items into visual lines, top to bottom, per page. */
function toLines(pages: PdfItem[][]): Line[] {
  const out: Line[] = [];
  pages.forEach((items, page) => {
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    let current: PdfItem[] = [];
    let y = NaN;
    const flush = () => {
      if (!current.length) return;
      const lineItems = current.sort((a, b) => a.x - b.x);
      out.push({ y, items: lineItems, text: lineItems.map(it => it.text).join(' '), page });
      current = [];
    };
    for (const it of sorted) {
      if (current.length && Math.abs(it.y - y) > 2.5) flush();
      if (!current.length) y = it.y;
      current.push(it);
    }
    flush();
  });
  return out;
}

// Page numbers and notes that can sit inside the narration column.
const PAGE_FURNITURE = /^(page\b|statement generated|this is a (computer|system)|end of statement|\*{3,})/i;

/**
 * Adds a narration line to the text so far. A field separator at the break
 * joins without a space; so does a full line (`width` characters), which the
 * bank cut mid-word. Anything shorter broke at a space.
 */
function joinWrapped(text: string, lastLine: string, next: string, width: number): string {
  if (!text) return next;
  if (text.endsWith('/') || next.startsWith('/') || text.endsWith('-')) return text + next;
  return text + (lastLine.length >= width ? '' : ' ') + next;
}

interface Draft { date: string; amount: number; balance: number; side: 'CR' | 'DR'; lines: Line[]; anchor: Line }

function draftRows(layout: Layout, lines: Line[]): Draft[] {
  const drafts: Draft[] = [];
  const [narFrom, narTo] = layout.narrationX;
  const anchors = new Map<Line, Draft>();

  for (const line of lines) {
    const dateItem = line.items.find(it => it.x < layout.dateMaxX && layout.date.test(it.text));
    if (!dateItem) continue;
    const m = layout.date.exec(dateItem.text)!;
    const date = isoDate(m[1], m[2], m[3]);
    const money = line.items
      .filter(it => it.x >= narTo)
      .map(it => ({ it, money: readMoney(it.text) }))
      .filter((e): e is { it: PdfItem; money: NonNullable<ReturnType<typeof readMoney>> } => e.money !== null);
    if (!date || money.length < 2) continue;
    const balance = money[money.length - 1];
    // Some banks print 0.00 in the other column.
    const amount = money.slice(0, -1).filter(e => e.money.value !== 0).pop();
    if (!amount) continue;
    const side = amount.money.mark ?? (amount.it.x + amount.it.w < layout.debitBefore ? 'DR' : 'CR');
    const draft: Draft = { date, amount: Math.abs(amount.money.value), balance: signed(balance.money), side, lines: [line], anchor: line };
    drafts.push(draft);
    anchors.set(line, draft);
  }

  // Narration lines: no date, everything inside the narration column. One
  // belongs to the row just below it when it's within `above` of that row's
  // date line, otherwise to the row above it when within `below`.
  const anchorLines = [...anchors.keys()];
  for (const line of lines) {
    if (anchors.has(line)) continue;
    if (!line.items.every(it => it.x >= narFrom - 2 && it.x < narTo)) continue;
    if (PAGE_FURNITURE.test(line.text)) continue;
    const samePage = anchorLines.filter(a => a.page === line.page);
    const nextBelow = samePage.filter(a => a.y < line.y).sort((a, b) => b.y - a.y)[0];
    const prevAbove = samePage.filter(a => a.y > line.y).sort((a, b) => a.y - b.y)[0];
    if (nextBelow && line.y - nextBelow.y <= layout.above) anchors.get(nextBelow)!.lines.push(line);
    else if (prevAbove && prevAbove.y - line.y <= layout.below) anchors.get(prevAbove)!.lines.push(line);
  }
  return drafts;
}

function narrationOf(layout: Layout, draft: Draft): string {
  const [narFrom, narTo] = layout.narrationX;
  let text = '';
  let lastLine = '';
  for (const line of [...draft.lines].sort((a, b) => b.y - a.y)) {
    const part = line.items
      .filter(it => it.x >= narFrom - 2 && it.x < narTo)
      .map(it => it.text)
      .join(' ')
      .trim();
    if (!part) continue;
    text = joinWrapped(text, lastLine, part, layout.lineWidth);
    lastLine = part;
  }
  text = text.replace(/\s+/g, ' ').trim();
  return (layout.tidy ? layout.tidy(text) : text).trim();
}

const near = (a: number, b: number) => Math.abs(a - b) <= 0.005;

/**
 * Which way each row went, from the running balance: it moves up by the
 * amount for money in and down for money out. Rows it can't place keep the
 * column's say and are reported.
 */
function chain(drafts: Draft[], opening: number | undefined): { types: ('INCOME' | 'EXPENSE')[]; opening: number; errors: number[] } {
  const first = drafts[0];
  const start = opening ?? (first.side === 'CR' ? first.balance - first.amount : first.balance + first.amount);
  const types: ('INCOME' | 'EXPENSE')[] = [];
  const errors: number[] = [];
  let prev = start;
  drafts.forEach((d, i) => {
    const delta = d.balance - prev;
    if (near(delta, d.amount)) types.push('INCOME');
    else if (near(delta, -d.amount)) types.push('EXPENSE');
    else {
      types.push(d.side === 'CR' ? 'INCOME' : 'EXPENSE');
      errors.push(i);
    }
    prev = d.balance;
  });
  return { types, opening: start, errors };
}

/**
 * Reads a statement of one of these banks. Throws when the layout isn't
 * recognised; returns errors when rows or totals don't add up.
 */
export function parseBankStatement(bank: BankId, pages: PdfItem[][]): BankStatement {
  const layout = LAYOUTS.find(l => l.bank === bank)!;
  const lines = toLines(pages);
  let drafts = draftRows(layout, lines);
  if (drafts.length === 0) throw new Error(`No ${layout.name} transactions found in this PDF.`);
  const printed = layout.summary(lines);

  // Newest-first statements: the balance only adds up read the other way.
  let result = chain(drafts, printed.opening);
  const reversed = [...drafts].reverse();
  const backwards = chain(reversed, printed.opening);
  if (backwards.errors.length < result.errors.length) {
    drafts = reversed;
    result = backwards;
  }

  const rows: BankRow[] = drafts.map((d, i) => ({
    date: d.date,
    narration: narrationOf(layout, d),
    amount: d.amount,
    balance: d.balance,
    type: result.types[i],
  }));

  const errors = result.errors.map(i => `The balance doesn't add up at row ${i + 1} (${rows[i].date}).`);
  const paise = (n: number) => Math.round(n * 100);
  const totalDebit = rows.filter(r => r.type === 'EXPENSE').reduce((s, r) => s + paise(r.amount), 0) / 100;
  const totalCredit = rows.filter(r => r.type === 'INCOME').reduce((s, r) => s + paise(r.amount), 0) / 100;
  const closing = rows[rows.length - 1].balance;
  const check = (label: string, ours: number, theirs: number | undefined) => {
    if (theirs !== undefined && paise(ours) !== paise(theirs)) {
      errors.push(`${label}: the rows give ${ours.toFixed(2)}, the bank prints ${theirs.toFixed(2)}.`);
    }
  };
  check('Total debits', totalDebit, printed.totalDebit);
  check('Total credits', totalCredit, printed.totalCredit);
  check('Closing balance', closing, printed.closing);
  check('Opening + credits − debits', result.opening + totalCredit - totalDebit, printed.closing ?? closing);

  return {
    bank,
    bankName: layout.name,
    rows,
    opening: result.opening,
    closing,
    totalDebit,
    totalCredit,
    printed,
    errors,
  };
}
