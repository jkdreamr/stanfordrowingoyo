import { expect, it } from 'vitest';
import { PRESETS, PLAN_SLOTS, PLAN_TOTALS } from './seed';
import { equivalentMeters } from './math';
it('every fixed preset matches sheet to within 100m',()=>{
 const expected = [16000,14400,16000,18000,16200,18000,20000,18000,20000,16000,23000,20700,23000,18400,27000,16200,24300,21600,25600,16000,16000,16000,16000,18000,18000,18000,26700,20000,15000,30000,30700,23000,15300,36000,27000,18000,7800,14100,10600,19000];
 const fixed = PRESETS.filter(p=>p.distance_m!==null);
 expect(fixed).toHaveLength(expected.length);
 fixed.forEach((p,i)=>expect(Math.abs(equivalentMeters(p.distance_m!,p.modality,p.zone)-expected[i])).toBeLessThanOrEqual(100));
});
it('has six fortnights totals and unique slots',()=>{expect(PLAN_TOTALS).toHaveLength(6); expect(new Set(PLAN_SLOTS.map(p=>[p.group_key,p.week,p.day,p.slot].join(':'))).size).toBe(PLAN_SLOTS.length); expect(PLAN_SLOTS.filter(p=>p.kind==='off')).toHaveLength(6);});
