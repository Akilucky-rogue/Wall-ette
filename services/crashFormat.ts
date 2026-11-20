/**
 * Errors as crash reports that carry nothing personal (services/crashReports.ts).
 *
 * No imports, so scripts/check-crash-reports.mjs can test it in Node.
 */

/** A stack frame as @capacitor-firebase/crashlytics takes it. */
export interface ReportFrame {
  functionName?: string;
  fileName?: string;
  lineNumber?: number;
}

const MAX_MESSAGE = 300;
const MAX_FRAMES = 25;

/**
 * An error message with anything personal masked: email addresses, the user
 * id in Firestore paths, other ids and tokens, and numbers that could be an
 * amount, an account or reference number, or a date (four or more digits, or
 * any with decimals). Short numbers stay, so "reading '0'" still reads.
 */
export function redact(text: unknown): string {
  return String(text ?? '')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>')
    .replace(/\busers\/[^\s/]+/g, 'users/<uid>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/\b(?=[A-Za-z_-]*\d)(?=[\d_-]*[A-Za-z])[A-Za-z0-9_-]{16,}\b/g, '<id>')
    .replace(/\d[\d,]*(?:\.\d+)?/g, n => (n.includes('.') || n.replace(/\D/g, '').length >= 4 ? '<n>' : n))
    .slice(0, MAX_MESSAGE);
}

// "    at fn (https://localhost/assets/index-x.js:1:234)", "    at https://…:1:234"
const V8_FRAME = /^\s*at (?:(.+?) \()?(.+?):(\d+):\d+\)?\s*$/;
// "fn@https://localhost/assets/index-x.js:1:234" (Firefox, Safari)
const AT_FRAME = /^\s*(.*?)@(.+?):(\d+):\d+\s*$/;

/** Frames from an Error's stack, newest first, with the page origin dropped from file names. */
export function stackFrames(stack: unknown): ReportFrame[] {
  if (typeof stack !== 'string') return [];
  const frames: ReportFrame[] = [];
  for (const line of stack.split('\n')) {
    const m = V8_FRAME.exec(line) ?? AT_FRAME.exec(line);
    if (!m) continue;
    frames.push({
      functionName: (m[1] || '(anonymous)').replace(/^async /, ''),
      fileName: m[2].replace(/^[a-z][\w+.-]*:\/\/[^/]+/i, '').replace(/[?#].*$/, ''),
      lineNumber: Number(m[3]),
    });
    if (frames.length === MAX_FRAMES) break;
  }
  return frames;
}

/** "TypeError: message" for an Error, the text for anything else; masked either way. */
export function describe(error: unknown): string {
  if (error instanceof Error) return redact(`${error.name || 'Error'}: ${error.message}`);
  if (error && typeof error === 'object' && 'message' in error) return redact((error as { message: unknown }).message);
  return redact(error);
}
