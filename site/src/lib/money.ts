/** Indian digit grouping (1,23,456), as the brand guide requires. */
export function inr(value: number, opts: { sign?: boolean; decimals?: number } = {}) {
  const { sign = false, decimals = 0 } = opts;
  const abs = Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const prefix = sign ? (value > 0 ? "+" : value < 0 ? "−" : "") : value < 0 ? "−" : "";
  return `${prefix}₹${abs}`;
}

/** Left to spend = came in − spent − bills still to come − savings goal. */
export function leftToSpend(i: { cameIn: number; spent: number; billsDue: number; savingsGoal: number }) {
  return i.cameIn - i.spent - i.billsDue - i.savingsGoal;
}
