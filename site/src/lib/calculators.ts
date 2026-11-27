export const safe = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1e12, Math.max(0, n)) : 0; };
export const left = (income: number, spent: number, bills: number, savings: number) => safe(income)-safe(spent)-safe(bills)-safe(savings);
export const split = (income: number) => [0.5, 0.3, 0.2].map(r => safe(income)*r);
export const goal = (target: number, saved: number, months: number) => safe(months)>0 ? Math.max(0,safe(target)-safe(saved))/safe(months) : null;
export const subscriptions = (items: {amount: number; yearly: boolean}[]) => items.reduce((sum,i)=>sum+safe(i.amount)*(i.yearly?1:12),0);
export function emi(principal: number, annual: number, months: number) { const p=safe(principal), n=safe(months), r=safe(annual)/1200; if(!n)return null; return r ? p*r/(-Math.expm1(-n*Math.log1p(r))) : p/n; }
export function salary(gross: number, deductions: number, payroll: number, newer: boolean) {
 const g=safe(gross); if(g>5000000)return null;
 const taxable=Math.max(0,g-(newer?75000:50000)-(newer?0:safe(deductions)));
 const bands: [number, number][] = newer?[[400000,0],[800000,.05],[1200000,.1],[1600000,.15],[2000000,.2],[2400000,.25],[Infinity,.3]]:[[250000,0],[500000,.05],[1000000,.2],[Infinity,.3]];
 let tax=0,previous=0; for(const [ceiling,rate] of bands){tax+=Math.max(0,Math.min(taxable,ceiling)-previous)*rate;previous=ceiling;}
 if(newer)tax=taxable<=1200000?0:Math.min(tax,taxable-1200000); else if(taxable<=500000)tax=0;
 tax*=1.04; return {tax,taxable,monthly:(g-tax-safe(payroll))/12};
}
