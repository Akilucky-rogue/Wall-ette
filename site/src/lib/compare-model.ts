export type ComparisonApp = {
  id: string;
  name: string;
  kind: string;
  origin: string;
  countries: string;
  india: string;
  tracking: string;
  storage: string;
  platforms: string;
  price: string;
  trial: string;
  features: string;
  fit: string;
  caveat: string;
  sources: { label: string; url: string }[];
  status?: "discontinued" | "unverified";
};

/** Wall·ette always occupies the first column; peers must be distinct. */
export function comparisonSelection(ids: readonly string[], first?: string, second?: string): [string, string] {
  const fallback = ids[0] ?? "";
  const a = first && ids.includes(first) ? first : fallback;
  const b = second && ids.includes(second) && second !== a ? second : ids.find(id => id !== a) ?? "";
  return [a, b];
}