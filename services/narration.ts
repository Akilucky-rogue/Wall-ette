/**
 * A statement narration split into its fields, for reading the payee and the
 * bank's reference out of it.
 *
 * Banks separate the fields with "/" (IDFC FIRST, Kotak, SBI, Union Bank,
 * Saraswat), ":" (some IMPS and ACH rows: "IMPS:6152…:…:NAME") or "-"
 * (HDFC: "UPI-ZOMATO LTD-zomato@axis-UTIB0000000-6152…-NOTE"). A mobile or
 * internet banking prefix ahead of the payment rail ("MB/NEFT/…") is
 * dropped, so the first field is the rail: UPI, NEFT, IMPS, TRF FR…
 *
 * No imports, so the check scripts can run it in Node.
 */

// HDFC-style narrations: a rail, then fields joined by "-" ("FT" is HDFC's funds transfer).
const RAIL_DASH = /^\s*(UPI|IMPS|NEFT|RTGS|ACH|NACH|MMT|FT)\b[^/:]*?-/i;
// Channels some banks write before the rail.
const CHANNEL = /^(MB|IB|INB|NB|MOB|NET)$/i;

export function narrationFields(narration: string): string[] {
  const text = narration.trim();
  const sep = text.includes('/') ? '/' : text.includes(':') ? ':' : RAIL_DASH.test(text) ? '-' : null;
  if (!sep) return text ? [text] : [];
  const fields = text.split(sep).map(f => f.replace(/\s+/g, ' ').trim()).filter(Boolean);
  while (fields.length > 1 && CHANNEL.test(fields[0].replace(/\s+/g, ''))) fields.shift();
  return fields;
}

/**
 * The fields to read a payee from. "A/C" (account) is a word there, not two
 * fields: HDFC's "FT- … - ACME MUTUAL FUND - COMMON REDEMPTION A/C -".
 * Bank references are read with narrationFields as it is, so the ids of
 * entries already imported never change.
 */
export const payeeFields = (narration: string): string[] => {
  const text = narration.replace(/\bA\/C\b/gi, 'AC');
  if (!/[/:]/.test(text) && !RAIL_DASH.test(text)) {
    // Card rows with fields between backslashes (Equitas: "PURCHASE \card\MERCHANT\CITY\ US").
    if (/^\s*(PURCHASE|POS)\b/i.test(text) && text.includes('\\')) return clean(text.split('\\'));
    // Fields between spaced dashes after a rail or a reference (Equitas:
    // "IMP P2A <ref> - NAME - IFSC - HEAD OFFICE", "… TRANSFER CR - COMPANY").
    const [head] = text.split(/\s+-\s+/);
    if (/\s-\s/.test(text) && /\d{4,}|^\s*(IMPS?|IMP P2[AP]|NEFT|RTGS|UPI|TRF|TRANSFER|CUSTOMER|ATM|POS)\b|\bTRANSFER (CR|DR)\b/i.test(head)) {
      return clean(text.split(/\s+-\s+/));
    }
  }
  return narrationFields(text);
};

const clean = (fields: string[]): string[] => fields.map(f => f.replace(/\s+/g, ' ').trim()).filter(Boolean);

// The note the IDFC Excel reader saves on a UPI row: the field after "UPI/",
// which is usually DR or CR ("UPI ID: DR"). It isn't the bank's text.
const EXCEL_UPI_NOTE = /^UPI ID: [A-Z0-9]+$/i;

/**
 * What an entry's details show: the bank's narration in full, and a note of
 * its own. Imports keep the narration in the note; the payee field holds its
 * first 100 characters, or the name the payee was renamed to. Either is null
 * when there is nothing to show.
 */
export function bankWords(merchant: string | undefined, note: string | undefined): { narration: string | null; note: string | null } {
  const own = note?.trim() && !EXCEL_UPI_NOTE.test(note.trim()) ? note.trim() : '';
  const isNarration = (s: string) => narrationFields(s).length >= 2;
  const narration = own && isNarration(own) ? own : merchant?.trim() && isNarration(merchant) ? merchant.trim() : null;
  return { narration, note: own && own !== narration ? own : null };
}
