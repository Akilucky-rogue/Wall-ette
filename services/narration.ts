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

// HDFC-style narrations: a rail, then fields joined by "-".
const RAIL_DASH = /^\s*(UPI|IMPS|NEFT|RTGS|ACH|NACH|MMT)\b[^/:]*?-/i;
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
