import { describe, expect, it } from 'vitest';
import { distanceForTarget, equivalentMeters, formatMeters, formatSplit, targetPace, ZONES } from './math';
describe('training math', () => {
 it.each([[60000,'bike','E',20000],[20000,'erg','D',27000],[6240,'run','E',7800],[6240,'run','D',10530],[60000,'bike','R',16000],[12000,'erg','D',16200]] as const)('spec example %s %s %s', (d,m,z,e) => expect(equivalentMeters(d,m,z)).toBe(e));
 it('inverts targets and rounds once', () => { expect(distanceForTarget(10000,'bike','E')).toBeCloseTo(30000); expect(distanceForTarget(10000,'run','D')/1000).toBeCloseTo(5.93,2); expect(equivalentMeters(1,'run','D')).toBe(2); expect(equivalentMeters(0,'erg','E')).toBe(0); });
 it('paces use correct basis and null when missing', () => { expect(ZONES.map(z=>targetPace(z,100,90))).toEqual([120,117.5,115,112.5,110,107.5,105,102.5,100,90]); expect(targetPace('A',100,null)).toBeNull(); expect(targetPace('E',null,90)).toBeNull(); });
 it('formats', () => { expect(formatMeters(20000)).toBe('20,000 m'); expect(formatMeters(20000,true)).toBe('20.0k'); expect(formatSplit(112)).toBe('1:52.0'); expect(formatSplit(119.99)).toBe('2:00.0'); });
});
