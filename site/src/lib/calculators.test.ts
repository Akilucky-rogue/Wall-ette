import {describe,it,expect} from 'vitest';
import {safe,left,split,goal,subscriptions,emi,salary} from './calculators';
describe('resource calculations',()=>{
 it('subtracts spending, upcoming bills and savings without hiding deficits',()=>{expect(left(50000,20000,10000,5000)).toBe(15000);expect(left(100,200,0,0)).toBe(-100);});
 it('splits take-home income 50/30/20',()=>{expect(split(50000)).toEqual([25000,15000,10000]);});
 it('handles zero-interest EMI',()=>{expect(emi(120000,0,12)).toBe(10000);});
 it('handles nonzero-interest EMI',()=>{expect(emi(100000,12,12)).toBeCloseTo(8884.8789,3);});
 it('rejects zero term',()=>{expect(emi(100000,12,0)).toBeNull();expect(goal(100,0,0)).toBeNull();});
 it('calculates remaining monthly savings without assuming returns',()=>{expect(goal(100000,10000,9)).toBe(10000);expect(goal(100,200,3)).toBe(0);});
 it('annualises monthly subscriptions but not yearly subscriptions',()=>{expect(subscriptions([{amount:99,yearly:false},{amount:449,yearly:true}])).toBe(1637);expect(subscriptions([])).toBe(0);});
 it('normalises blank, invalid, negative and infinite inputs',()=>{for(const v of ['',undefined,'bad',-1,Infinity])expect(safe(v)).toBe(0);});
 it('applies new-regime rebate and marginal relief',()=>{expect(salary(1275000,0,0,true)?.tax).toBe(0);expect(salary(1276000,0,0,true)?.tax).toBe(1040);});
 it('limits salary scope and compares old rebate',()=>{expect(salary(5000001,0,0,true)).toBeNull();expect(salary(550000,0,0,false)?.tax).toBe(0);});
});
