/**
 * Email address checks for the sign-in, sign-up and reset forms.
 *
 * A mistyped domain ("gmial.com") still makes a valid-looking address, and an
 * account created with one can sign in but never gets a password-reset email.
 * suggestEmail spots near misses of common mail domains so the form can offer
 * the fix before that happens.
 *
 * No imports, so scripts/check-password-reset.mjs can test it in Node.
 */

/** Roughly user@domain.tld, the shape worth sending to Firebase. */
export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

// Domains people actually use (no suggestion when typed exactly), including
// real ones that sit close to a bigger one (mail.com, gmx.com, live.in).
const KNOWN_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rocketmail.com', 'yahoo.co.uk',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.in', 'live.com', 'live.in', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'rediffmail.com', 'aol.com', 'protonmail.com', 'proton.me', 'zoho.com', 'zohomail.in',
  'mail.com', 'gmx.com', 'gmx.net', 'yandex.com',
];
// The ones worth suggesting: a typo is far likelier to be one of these.
const SUGGESTED = ['gmail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com', 'outlook.com', 'icloud.com', 'rediffmail.com'];

/** Edit distance counting a swap of neighbours as one edit ("gmial" → "gmail"). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * The address with its domain corrected, when the domain looks like a typo of
 * a common one ("asha@gmial.com" → "asha@gmail.com"); otherwise null.
 */
export function suggestEmail(value: string): string | null {
  const trimmed = value.trim();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (domain.length < 4 || KNOWN_DOMAINS.includes(domain)) return null;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of SUGGESTED) {
    const distance = editDistance(domain, candidate);
    if (distance < bestDistance) { best = candidate; bestDistance = distance; }
  }
  const allowed = domain.length > 6 ? 2 : 1;
  return best && bestDistance <= allowed ? `${local}@${best}` : null;
}
