import { FileText, TrendingUp, PieChart, BookOpen, ShoppingBag, ShieldCheck, PiggyBank, CalendarCheck, LayoutGrid } from "lucide-react";
import type { BlogCategory } from "@/lib/blog";

const ICONS = { "Bank statements": FileText, "Cash flow": TrendingUp, Budgeting: PieChart, "Money basics": BookOpen, "Everyday spending": ShoppingBag, "Statement safety": ShieldCheck, "Saving habits": PiggyBank, "Money routines": CalendarCheck } as const;

export function CategoryIcon({ category, className }: { category: BlogCategory | "All"; className?: string }) {
  const Icon = category === "All" ? LayoutGrid : ICONS[category];
  return <Icon aria-hidden="true" className={className ?? "size-4"} />;
}
