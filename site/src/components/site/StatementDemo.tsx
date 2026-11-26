import { CountUp } from "./CountUp";
import { inr } from "@/lib/money";
import { cn } from "@/lib/utils";

const ROWS = [
  { date: "01 Nov", raw: "NEFT/CR/IN2263421789/ORBIT SOFTWARE PVT LTD/SALARY NOV", payee: "Orbit Software Pvt Ltd", cat: "Salary", amt: 85000, kind: "in" },
  { date: "03 Nov", raw: "UPI/DR/631245781122/KAPOOR HOMES/HDFC/RENT", payee: "Kapoor Homes", cat: "Rent", amt: -24000, kind: "out" },
  { date: "05 Nov", raw: "IFT/10000123456/AARAV SHARMA/631245/Savings", payee: "Aarav Sharma", cat: "My own account · not spending", amt: 20000, kind: "moved" },
  { date: "08 Nov", raw: "UPI/DR/631245789012/SWIGGY/YESB/swiggy.upi@yesb", payee: "Swiggy", cat: "Food delivery", amt: -486, kind: "out" },
  { date: "12 Nov", raw: "UPI/DR/631245780045/ZEPTO/ICIC/zeptonow@icici", payee: "Zepto", cat: "Groceries", amt: -1284, kind: "out" },
] as const;

export function StatementDemo() {
  return (
    <div className="relative min-w-0 w-full">
      <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-lift">
        <div className="flex items-center justify-between border-b border-dashed border-border pb-3 text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider">Account statement</span>
          <span>01–30 Nov 2026</span>
        </div>
        <ul className="divide-y divide-border">
          {ROWS.map((r, i) => (
            <li key={r.raw} className="row-in py-2" style={{ ["--d" as string]: `${300 + i * 220}ms` }}>
              <p className="truncate font-mono text-[0.68rem] leading-5 text-muted-foreground/80 line-through decoration-muted-foreground/30">{r.date} · {r.raw}</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.payee}</p>
                  <p className={cn("text-sm", r.kind === "moved" ? "text-moved" : "text-muted-foreground")}>{r.cat}</p>
                </div>
                <p className={cn("money shrink-0 text-right font-semibold", r.kind === "in" && "text-income", r.kind === "out" && "text-foreground", r.kind === "moved" && "text-moved")}>
                  {r.kind === "moved" ? inr(r.amt) : inr(r.amt, { sign: true })}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl bg-sand p-3 text-center">
          <div><p className="text-xs text-muted-foreground">Spent</p><CountUp value={25770} className="font-display text-lg font-bold sm:text-xl" /></div>
          <div><p className="text-xs text-muted-foreground">Moved</p><CountUp value={20000} className="font-display text-lg font-bold text-moved sm:text-xl" /></div>
          <div><p className="text-xs text-muted-foreground">Came in</p><CountUp value={85000} className="font-display text-lg font-bold text-income sm:text-xl" /></div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Five lines from an IDFC FIRST statement, and how Wall·ette reads them. Sample data.</p>
    </div>
  );
}
