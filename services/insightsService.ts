/**
 * Financial Insight Service (local, offline) — formerly `geminiService.ts`.
 *
 * This module used to call Google Gemini via an inlined VITE_GEMINI_API_KEY,
 * which leaked the key to every browser that loaded the app. It has been
 * replaced with a fully local analyzer that produces deterministic insights
 * from the user's own transactions — no network calls, no API keys.
 */

export interface FinancialInsight {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  anomalies: string[];
  savingsOpportunities: string[];
  budgetSuggestion: string;
  riskScore: number; // 0-100
}

interface AnalyzerTxn {
  date: string;
  merchant: string;
  amount: number;
  category: string;
  type: string;
}

const currency = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/**
 * Locally compute financial insights from a list of transactions.
 * Pure function — safe to call anywhere, no async I/O.
 */
export const analyzeFinancialHealth = async (
  transactions: AnalyzerTxn[],
  monthlyIncome?: number
): Promise<FinancialInsight> => {
  const expenses = transactions.filter((t) => t.type === 'EXPENSE');
  const income = transactions.filter((t) => t.type === 'INCOME');

  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const totalEarned = income.reduce((s, t) => s + t.amount, 0) || monthlyIncome || 0;
  const net = totalEarned - totalSpent;
  const savingsRate = totalEarned > 0 ? (net / totalEarned) * 100 : 0;

  // Category breakdown
  const byCategory = expenses.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const topCats = sortedCats.slice(0, 3);

  // Anomaly detection: single transactions > 3x the median
  const amounts = expenses.map((t) => t.amount).sort((a, b) => a - b);
  const median = amounts.length ? amounts[Math.floor(amounts.length / 2)] : 0;
  const anomalyThreshold = median * 3;
  const largeTxns = expenses
    .filter((t) => median > 0 && t.amount > anomalyThreshold)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // Findings
  const keyFindings: string[] = [];
  keyFindings.push(
    `${transactions.length} transactions • ${currency(totalSpent)} spent • ${currency(totalEarned)} earned`
  );
  if (topCats.length) {
    const [topName, topAmt] = topCats[0];
    const pct = totalSpent > 0 ? ((topAmt / totalSpent) * 100).toFixed(0) : '0';
    keyFindings.push(`Top category: ${topName} at ${currency(topAmt)} (${pct}% of spend)`);
  }
  if (totalEarned > 0) {
    keyFindings.push(
      savingsRate >= 20
        ? `Healthy savings rate of ${savingsRate.toFixed(0)}%`
        : savingsRate >= 0
        ? `Modest savings rate of ${savingsRate.toFixed(0)}% — room to grow`
        : `Spending exceeds income by ${currency(Math.abs(net))}`
    );
  }

  // Recommendations
  const recommendations: string[] = [];
  if (savingsRate < 20 && totalEarned > 0) {
    recommendations.push('Aim to save at least 20% of monthly income — consider a standing instruction on salary day.');
  }
  if (topCats.length && topCats[0][1] / Math.max(totalSpent, 1) > 0.4) {
    recommendations.push(`${topCats[0][0]} dominates your spend — review for recurring leakage.`);
  }
  if (largeTxns.length) {
    recommendations.push('Review the large one-off transactions flagged below to confirm they were intentional.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Your spending looks balanced this period. Keep the routine going.');
  }

  // Savings opportunities: categories that are discretionary and > 8% of spend
  const discretionary = new Set([
    'Dining', 'Food Delivery', 'Entertainment', 'Streaming', 'Subscriptions',
    'Shopping', 'Online Shopping', 'Movies', 'Games', 'Personal Care',
  ]);
  const savingsOpportunities: string[] = [];
  for (const [cat, amt] of sortedCats) {
    if (discretionary.has(cat) && amt / Math.max(totalSpent, 1) > 0.08) {
      savingsOpportunities.push(`Trimming ${cat} by 20% would free up ${currency(amt * 0.2)} a month.`);
    }
    if (savingsOpportunities.length >= 3) break;
  }

  // Anomalies strings
  const anomalies = largeTxns.map(
    (t) => `${t.date}: ${t.merchant || 'Unknown'} — ${currency(t.amount)} (${t.category})`
  );

  // Budget suggestion using a simple 50/30/20 heuristic
  const budgetSuggestion = totalEarned > 0
    ? `Try a 50/30/20 split on ${currency(totalEarned)}: ${currency(totalEarned * 0.5)} needs, ${currency(totalEarned * 0.3)} wants, ${currency(totalEarned * 0.2)} savings.`
    : 'Add income entries to unlock a personalized budget suggestion.';

  // Risk score: high when savings rate low or discretionary share high
  let risk = 50;
  if (totalEarned > 0) risk = Math.max(0, Math.min(100, 60 - savingsRate));
  const discretionaryShare = sortedCats
    .filter(([c]) => discretionary.has(c))
    .reduce((s, [, a]) => s + a, 0) / Math.max(totalSpent, 1);
  if (discretionaryShare > 0.35) risk = Math.min(100, risk + 15);

  const summary = totalEarned === 0
    ? `You logged ${transactions.length} transactions with ${currency(totalSpent)} in spend this period. Add income to see the full picture.`
    : net >= 0
    ? `You kept ${currency(net)} this period on ${currency(totalEarned)} income — a ${savingsRate.toFixed(0)}% savings rate.`
    : `You overspent by ${currency(Math.abs(net))} this period. Focus on the opportunities below to reset.`;

  return {
    summary,
    keyFindings,
    recommendations,
    anomalies,
    savingsOpportunities,
    budgetSuggestion,
    riskScore: Math.round(risk),
  };
};
