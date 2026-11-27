import { useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { CtaBand } from "@/components/site/CtaBand";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/money";
import {
  safe, left, split, goal, subscriptions, emi, salary,
} from "@/lib/calculators";
import {
  type Resource, paymentTerms, financeTerms,
} from "./catalog";

const inputClass =
  "mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

export function ResourceFooter() {
  return (
    <>
      <aside className="container-site pt-8 text-sm text-muted-foreground">
        Educational tools and estimates only—not financial, investment, lending
        or tax advice. Results depend on your inputs and simplified assumptions.
        Verify important figures with your bank, lender, payroll team or a
        qualified professional.
      </aside>
      <CtaBand
        title="A clearer picture, without the manual work."
        body="First month free. Essential: ₹49/month or ₹449/year. Plus: ₹99/month or ₹899/year."
        cta="Track this automatically — first month free"
      />
    </>
  );
}

export function ResourcePage({ resource }: { resource: Resource }) {
  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Resources", to: "/resources" },
          { label: resource.title },
        ]}
        eyebrow={resource.group}
        title={resource.title}
        lead={resource.description}
      />
      <section className="container-site py-12">
        <div className="max-w-4xl">
          {resource.bank ? (
            <BankGuide resource={resource} />
          ) : resource.slug === "payment-codes" ? (
            <>
              <p className="mb-6 text-muted-foreground">
                Statement narration is bank-specific. A code alone does not
                establish who received a payment or what it was for. Match the
                amount, date, account and transaction reference.
              </p>
              <Glossary terms={paymentTerms} />
            </>
          ) : resource.slug === "finance-glossary" ? (
            <Glossary terms={financeTerms} />
          ) : resource.slug === "monthly-budget-sheet" ? (
            <BudgetSheet />
          ) : (
            <Calculator slug={resource.slug} />
          )}
          <a
            className="mt-10 inline-block text-forest underline"
            href="/resources"
          >
            ← All resources
          </a>
        </div>
      </section>
      <ResourceFooter />
    </>
  );
}

function BankGuide({ resource }: { resource: Resource }) {
  const bank = resource.bank!;
  return (
    <article className="space-y-6">
      <h2 className="text-section">Download from your bank</h2>
      <p className="text-muted-foreground">
        This is a navigation guide, not a live copy of the bank’s interface.
        Menu labels, date limits, fees and file formats can change. Use the
        closest statement option shown in your account.
      </p>
      <ol className="list-decimal space-y-4 pl-6">
        {bank.steps.map((step) => <li key={step}>{step}</li>)}
        <li>
          Check the account, statement period, opening balance and closing
          balance. Prefer a bank-generated file rather than screenshots.
        </li>
        <li>
          If the file is password-protected, follow the instructions supplied
          by your bank. Do not guess password formats or share the password.
        </li>
      </ol>
      <Button asChild variant="soft">
        <a href={bank.url} target="_blank" rel="noopener noreferrer">
          Open {bank.name} official website
        </a>
      </Button>
      <h2 className="text-2xl font-semibold">Before you share a statement</h2>
      <p>
        Statements contain sensitive financial information. This guide does not
        ask you to upload one. Never share a banking password, PIN or OTP.
        Download only on a trusted device and remove unnecessary local copies.
      </p>
      <p className="text-muted-foreground">
        Missing transactions? Check the selected dates and whether the
        transaction is still pending. Contact your bank through its official
        support channel if the statement is unavailable or incorrect.
      </p>
    </article>
  );
}

function Glossary({ terms }: { terms: string[][] }) {
  const [query, setQuery] = useState("");
  const matches = terms.filter(([term, meaning]) =>
    `${term} ${meaning}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <label className="block font-medium">
        Find a term
        <input
          type="search"
          className={inputClass}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms and definitions"
        />
      </label>
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        {matches.length} terms
      </p>
      <dl className="mt-6 divide-y divide-border">
        {matches.map(([term, meaning]) => (
          <div key={term} className="py-5">
            <dt className="text-lg font-semibold">{term}</dt>
            <dd className="mt-2 text-muted-foreground">{meaning}</dd>
          </div>
        ))}
      </dl>
      {!matches.length && <p>No matching terms. Try a broader search.</p>}
    </>
  );
}

function Calculator({ slug }: { slug: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [items, setItems] = useState([
    { id: 1, name: "", amount: "", yearly: false },
  ]);
  const [nextId, setNextId] = useState(2);
  const value = (key: string) => safe(values[key]);

  function field(key: string, label: string, integer = false) {
    return (
      <label key={key} className="block min-w-0 font-medium">
        {label}
        <input
          className={inputClass}
          type="number"
          inputMode={integer ? "numeric" : "decimal"}
          min="0"
          max="1000000000000"
          step={integer ? "1" : "any"}
          value={values[key] ?? ""}
          onChange={(e) =>
            setValues((old) => ({ ...old, [key]: e.target.value }))
          }
        />
      </label>
    );
  }

  function rows(entries: [string, number | null][]) {
    return (
      <dl
        aria-live="polite"
        aria-atomic="true"
        className="mt-6 grid gap-5 rounded-3xl bg-sand p-6 sm:grid-cols-2"
      >
        {entries.map(([label, amount]) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-2 break-words text-2xl font-semibold">
              {amount === null ? "Enter a valid duration" : inr(amount)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  let fields;
  let results;
  let explanation;

  if (slug === "left-to-spend") {
    fields = [
      field("income", "Money received this month (₹)"),
      field("spent", "Already spent (₹)"),
      field("bills", "Bills still to come (₹)"),
      field("savings", "Savings still to set aside (₹)"),
    ];
    const remaining = left(
      value("income"), value("spent"), value("bills"), value("savings"),
    );
    results = rows([["Left to spend", remaining]]);
    explanation =
      "Money received − spending so far − upcoming bills − savings still to set aside. Do not include a bill or savings transfer twice. A negative result means your entered commitments exceed the money received.";
  } else if (slug === "50-30-20") {
    fields = [field("income", "Monthly take-home pay (₹)")];
    const [needs = 0, wants = 0, savings = 0] = split(value("income"));
    results = rows([
      ["Needs · 50%", needs],
      ["Wants · 30%", wants],
      ["Savings / debt goals · 20%", savings],
    ]);
    explanation =
      "A starting framework, not a rule: needs include essential housing, food and minimum repayments; wants are discretionary; savings and additional debt repayments share the remaining 20%. Adjust for your circumstances.";
  } else if (slug === "emergency-fund") {
    fields = [
      field("expenses", "Essential monthly expenses (₹)"),
      field("months", "Months of cover", true),
      field("saved", "Emergency savings already available (₹)"),
    ];
    const target =
      value("expenses") * Math.floor(value("months"));
    results = rows([
      ["Target buffer", target],
      ["Still to build", Math.max(0, target - value("saved"))],
    ]);
    explanation =
      "Essential expenses × whole months of cover, minus money already reserved for emergencies. Three to six months is a common illustration, not a personalised recommendation. This estimate excludes inflation and returns.";
  } else if (slug === "savings-goal") {
    fields = [
      field("target", "Target amount (₹)"),
      field("saved", "Already saved for this goal (₹)"),
      field("months", "Whole months remaining", true),
    ];
    results = rows([
      ["Monthly contribution", goal(
        value("target"), value("saved"), Math.floor(value("months")),
      )],
      ["Remaining target", Math.max(0, value("target") - value("saved"))],
    ]);
    explanation =
      "Remaining target ÷ whole months. Assumes equal monthly contributions, no investment return, no inflation and no fees. A completed goal needs no further contribution.";
  } else if (slug === "emi") {
    fields = [
      field("principal", "Loan principal (₹)"),
      field("rate", "Annual interest rate (%)"),
      field("months", "Tenure in whole months", true),
    ];
    const months = Math.floor(value("months"));
    const payment = emi(value("principal"), value("rate"), months);
    results = rows([
      ["Monthly EMI", payment],
      ["Total repayment", payment === null ? null : payment * months],
      ["Total interest", payment === null ? null :
        Math.max(0, payment * months - value("principal"))],
    ]);
    explanation =
      "Fixed-rate monthly reducing-balance estimate. EMI = P × r ÷ (1 − (1 + r)^−n), where r is the annual percentage rate divided by 1,200. At 0% interest, EMI = P ÷ n. Excludes processing fees, insurance, prepayments, rate changes and lender rounding.";
  } else if (slug === "subscriptions") {
    const annual = subscriptions(items.map((item) => ({
      amount: safe(item.amount), yearly: item.yearly,
    })));
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Enter the amount actually charged, including taxes where applicable.
          Monthly amounts are multiplied by 12; annual amounts are counted once.
          No currency conversion, future price changes or trial discounts are assumed.
        </p>
        {items.map((item, index) => (
          <fieldset
            key={item.id}
            className="grid min-w-0 gap-4 rounded-3xl border border-border p-5 sm:grid-cols-2"
          >
            <legend className="px-2 font-semibold">
              Subscription {index + 1}
            </legend>
            <label className="min-w-0">
              Name
              <input
                className={inputClass}
                maxLength={100}
                value={item.name}
                onChange={(e) => setItems((old) => old.map((i) =>
                  i.id === item.id ? { ...i, name: e.target.value } : i,
                ))}
              />
            </label>
            <label className="min-w-0">
              Amount per billing period (₹)
              <input
                className={inputClass}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={item.amount}
                onChange={(e) => setItems((old) => old.map((i) =>
                  i.id === item.id ? { ...i, amount: e.target.value } : i,
                ))}
              />
            </label>
            <label>
              Billing frequency
              <select
                className={inputClass}
                value={item.yearly ? "yearly" : "monthly"}
                onChange={(e) => setItems((old) => old.map((i) =>
                  i.id === item.id
                    ? { ...i, yearly: e.target.value === "yearly" }
                    : i,
                ))}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              className="self-end"
              aria-label={`Remove subscription ${index + 1}`}
              onClick={() => setItems((old) =>
                old.filter((i) => i.id !== item.id),
              )}
            >
              Remove
            </Button>
          </fieldset>
        ))}
        {!items.length && <p>No subscriptions. Add one to get started.</p>}
        <Button
          type="button"
          variant="soft"
          onClick={() => {
            setItems((old) => [
              ...old,
              { id: nextId, name: "", amount: "", yearly: false },
            ]);
            setNextId((id) => id + 1);
          }}
        >
          Add subscription
        </Button>
        {rows([
          ["Combined yearly cost", annual],
          ["Monthly equivalent", annual / 12],
        ])}
      </div>
    );
  } else if (slug === "salary-in-hand") {
    fields = [
      field("gross", "Annual gross cash salary—not CTC (₹)"),
      field("deductions", "Eligible old-regime deductions / exemptions (₹)"),
      field("payroll", "Annual employee payroll deductions (₹)"),
    ];
    const old = salary(
      value("gross"), value("deductions"), value("payroll"), false,
    );
    const newer = salary(
      value("gross"), value("deductions"), value("payroll"), true,
    );
    results = old && newer ? rows([
      ["Old regime · annual income tax", old.tax],
      ["New regime · annual income tax", newer.tax],
      ["Old regime · monthly estimate", old.monthly],
      ["New regime · monthly estimate", newer.monthly],
    ]) : (
      <p role="status" className="mt-6 rounded-xl bg-sand p-5">
        This simplified estimator supports annual gross salary up to ₹50 lakh.
        Surcharge and higher-income marginal relief are outside its scope.
      </p>
    );
    explanation = <SalaryAssumptions />;
  } else {
    return null;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Blank, negative or non-finite amounts count as zero. Amounts are capped
        at ₹1,00,00,00,00,00,000. Durations use whole months. Displayed currency is
        rounded to the nearest rupee; calculations retain precision.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">{fields}</div>
      {results}
      <div className="space-y-4 text-muted-foreground">{explanation}</div>
      <p className="text-sm text-muted-foreground">
        Your entries remain in browser memory only and are cleared on refresh.
      </p>
    </div>
  );
}

function SalaryAssumptions() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-foreground">
        Simplified FY 2026–27 assumptions
      </h2>
      <p>
        Covers 1 April 2026–31 March 2027. Assumes a resident individual under
        60, ordinary salary income only, and annual gross cash salary up to
        ₹50 lakh. It is not a payroll calculation, tax return or regime
        recommendation.
      </p>
      <ul className="list-disc space-y-3 pl-6">
        <li>
          New regime: ₹75,000 standard deduction; taxable-income slabs of
          0% up to ₹4 lakh, 5% from ₹4–8 lakh, 10% from ₹8–12 lakh,
          15% from ₹12–16 lakh, 20% from ₹16–20 lakh, 25% from
          ₹20–24 lakh and 30% above ₹24 lakh.
        </li>
        <li>
          New-regime rebate eliminates ordinary-income tax up to ₹12 lakh
          taxable income. Immediately above that threshold, marginal relief
          limits pre-cess tax to income exceeding ₹12 lakh where applicable.
        </li>
        <li>
          Old regime: ₹50,000 standard deduction; 0% up to ₹2.5 lakh,
          5% from ₹2.5–5 lakh, 20% from ₹5–10 lakh and 30% above
          ₹10 lakh. Resident rebate applies where taxable income does not
          exceed ₹5 lakh.
        </li>
        <li>
          Adds 4% health and education cess after rebate or relief.
          Excludes surcharge, special-rate income, other income, employer NPS
          deductions, arrears, reliefs and statutory tax rounding.
        </li>
        <li>
          Enter only already-validated eligible old-regime deductions and
          exemptions, excluding the standard deduction. Individual deduction
          limits and HRA eligibility are not checked.
        </li>
        <li>
          Payroll deductions are employee EPF, professional tax and other
          actual cash deductions, excluding income tax. They reduce cash
          take-home in both estimates but do not automatically reduce taxable
          income. Enter any eligible old-regime tax deduction separately,
          without duplicating it within that tax-deduction total.
        </li>
        <li>
          Monthly estimate = (annual gross cash salary − estimated annual
          income tax − employee payroll deductions) ÷ 12. Actual TDS,
          bonuses, benefits and monthly payments can differ.
        </li>
      </ul>
      <p>
        Verify current provisions in the{" "}
        <a
          href="https://www.incometaxindia.gov.in/documents/d/guest/income_tax_act_2025_as_amended_by_fa_act_2026-pdf"
          className="text-forest underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Income-tax Act, 2025 as amended by Finance Act, 2026
        </a>.
      </p>
    </section>
  );
}

function BudgetSheet() {
  const [downloaded, setDownloaded] = useState(false);

  function download() {
    const records = [
      ["Type", "Category", "Planned INR", "Actual INR", "Notes"],
      ["Income", "Take-home salary", "", "", ""],
      ["Income", "Other income", "", "", ""],
      ["Expense", "Rent / housing", "", "", ""],
      ["Expense", "Groceries", "", "", ""],
      ["Expense", "Utilities", "", "", ""],
      ["Expense", "Transport", "", "", ""],
      ["Expense", "Insurance", "", "", ""],
      ["Expense", "Minimum loan repayments", "", "", ""],
      ["Expense", "Subscriptions", "", "", ""],
      ["Expense", "Eating out / leisure", "", "", ""],
      ["Savings", "Emergency fund", "", "", ""],
      ["Savings", "Other goals", "", "", ""],
      ["Debt goal", "Additional repayment", "", "", ""],
    ];
    const quote = (cell: string) => `"${cell.replaceAll('"', '""')}"`;
    const csv = "\uFEFF" +
      records.map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wallette-monthly-budget.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  }

  return (
    <article className="space-y-6">
      <h2 className="text-section">Your month, on one sheet.</h2>
      <p>
        A simple CSV with category, planned amount, actual amount and notes.
        Open it in Excel, Google Sheets or another spreadsheet app. The file
        contains template rows only—no personal data and no hidden formulas.
      </p>
      <Button
        type="button"
        variant="hero"
        size="xl"
        onClick={download}
      >
        Download free CSV
      </Button>
      <p role="status" className="text-sm text-muted-foreground">
        {downloaded
          ? "CSV download requested. Check your browser’s downloads."
          : "No email, sign-in or newsletter subscription required."}
      </p>
      <ol className="list-decimal space-y-3 pl-6">
        <li>Save a new copy for each month.</li>
        <li>Enter expected income and planned allocations.</li>
        <li>Update actual amounts using your statements.</li>
        <li>
          Compare total income with expenses, savings and extra debt payments.
          Do not count transfers between your own accounts as fresh income.
        </li>
      </ol>
      <p className="text-muted-foreground">
        CSV does not preserve spreadsheet formatting or formulas. Add totals
        in your spreadsheet if useful. Newsletter signup is intentionally
        omitted; downloading is entirely independent of email.
      </p>
    </article>
  );
}
