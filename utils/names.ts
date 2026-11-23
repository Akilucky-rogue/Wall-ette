/**
 * Names as the screens show them. Banks write narrations in capitals
 * ("THE CURRY LEAF", "NORTHWIND LABS PVT LTD"); on screen they read as
 * names ("The Curry Leaf", "Northwind Labs Pvt Ltd"). Short words that are
 * usually initials or acronyms stay in capitals ("SBI", "KV", "MF").
 * Words already in mixed case are left as they are.
 *
 * No imports, so the check scripts can run it in Node.
 */

// Words of three letters or more kept in capitals.
const ACRONYMS = new Set([
  'ACC', 'ACH', 'AMC', 'ATM', 'BHIM', 'BMW', 'BOB', 'BOI', 'BPCL', 'BSE', 'BSNL', 'CDSL', 'CNG', 'DHL', 'DTH',
  'ECS', 'EMI', 'EPFO', 'ESIC', 'GAIL', 'GST', 'HDFC', 'HPCL', 'HSBC', 'HUF', 'IBM', 'ICICI', 'IDBI', 'IDFC',
  'IMPS', 'IOB', 'IOCL', 'IRCTC', 'ITC', 'KFC', 'KYC', 'LIC', 'LPG', 'MRF', 'MTNL', 'NACH', 'NEFT', 'NHAI',
  'NPS', 'NSDL', 'NSE', 'ONGC', 'OTT', 'PNB', 'POS', 'PPF', 'PVR', 'RBL', 'RTGS', 'SBI', 'SIP', 'SMS', 'TCS',
  'TDS', 'TVS', 'UCO', 'UPI',
]);
// One- and two-letter words that are words, not initials.
const SHORT_WORDS = new Set([
  'A', 'AN', 'AT', 'BY', 'CO', 'DE', 'DR', 'GO', 'IN', 'IS', 'IT', 'MR', 'MS', 'MY', 'NO', 'OF', 'ON', 'OR',
  'SO', 'TO', 'UP', 'WE',
]);

function word(w: string): string {
  const letters = w.replace(/[^A-Za-z]/g, '');
  if (!letters || /[a-z]/.test(w)) return w;            // no letters, or already mixed case
  if (ACRONYMS.has(letters)) return w;
  if (letters.length <= 2 && !SHORT_WORDS.has(letters)) return w; // initials: "L", "KV", "MF"
  return w.charAt(0) + w.slice(1).toLowerCase();
}

/** "THE CURRY LEAF" → "The Curry Leaf"; "NETFLIX COM" → "Netflix.com"; mixed case unchanged. */
export function tidyName(name: string): string {
  const text = name.replace(/\s+/g, ' ').trim();
  if (/[a-z]/.test(text) && /[A-Z]/.test(text) && text !== text.toUpperCase()) {
    // Mixed case, as typed or as the bank wrote it: tidy only words in capitals.
    return text.split(' ').map(w => (w.length > 3 && w === w.toUpperCase() ? word(w) : w)).join(' ');
  }
  const tidy = text.split(' ').map(word).join(' ');
  return tidy.replace(/ Com$/, '.com');
}

/**
 * How a statement row was paid, from its narration's first field, for the
 * line under a payee: "UPI", "NEFT", "Card", "ATM"... Null when the
 * narration doesn't say (an entry typed in New Entry).
 */
export function paymentRail(narration: string | undefined | null): string | null {
  if (!narration) return null;
  const first = narration.trim().replace(/^(MB|IB|INB|NB|MOB|NET)[\s/:-]+/i, '').split(/[\s/:-]/)[0]?.toUpperCase() ?? '';
  switch (first) {
    case 'UPI': case 'NEFT': case 'IMPS': case 'RTGS': case 'NACH': case 'ECS': return first;
    case 'ACH': return 'NACH';
    case 'POS': case 'ECOM': case 'VISA': case 'MC': case 'VPS': case 'IPS': return 'Card';
    case 'ATM': case 'ATW': case 'NWD': case 'NFS': case 'CW': case 'EAW': return 'ATM';
    case 'CHQ': case 'CLG': case 'CHEQUE': return 'Cheque';
    case 'IFT': case 'TPT': case 'TRF': case 'TFR': case 'FT': return 'Transfer';
    default: return null;
  }
}
