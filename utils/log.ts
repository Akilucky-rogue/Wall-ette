/**
 * Minimal logger (audit Phase 5.1).
 *
 * - debug/info/warn are no-ops in production builds, so PII (account numbers,
 *   customer names, balances) never reaches the device console in release.
 * - error is kept in production for actionable failures — never pass PII to it;
 *   use `redact()` for anything sensitive.
 */
const isProd = import.meta.env.PROD;

export const log = {
  debug: (...args: unknown[]): void => {
    if (!isProd) console.log(...args);
  },
  info: (...args: unknown[]): void => {
    if (!isProd) console.info(...args);
  },
  warn: (...args: unknown[]): void => {
    if (!isProd) console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};

/** Mask all but the last `keep` characters (account numbers, emails, etc.). */
export const redact = (value: unknown, keep = 4): string => {
  const s = String(value ?? '');
  if (s.length <= keep) return '***';
  return `${'*'.repeat(s.length - keep)}${s.slice(-keep)}`;
};

export default log;
