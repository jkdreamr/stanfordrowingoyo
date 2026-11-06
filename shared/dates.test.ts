import { expect, it } from 'vitest';
import { today, weekStart, weekRange, seasonRange, yearRange } from './dates';
it.each([['2026-03-08T09:59:00Z','2026-03-08'],['2026-03-08T10:01:00Z','2026-03-08'],['2026-11-01T08:59:00Z','2026-11-01'],['2026-11-01T09:01:00Z','2026-11-01'],['2026-06-08T02:00:00Z','2026-06-07']])('PT date %s', (instant,date)=>{expect(today(new Date(instant))).toBe(date);});
it('uses Monday and inclusive ranges',()=>{expect(weekStart('2026-06-07')).toBe('2026-06-01'); expect(weekRange('2026-03-08')).toEqual({start:'2026-03-02',end:'2026-03-08'}); expect(weekStart(today(new Date('2026-06-08T02:00:00Z')))).toBe('2026-06-01');});
it('season rollover and leap years',()=>{expect(seasonRange('2026-08-31')).toEqual({start:'2025-09-01',end:'2026-08-31'}); expect(seasonRange('2026-09-01').start).toBe('2026-09-01'); expect(seasonRange('2024-02-29','03-01').end).toBe('2024-02-29'); expect(yearRange(2024).end).toBe('2024-12-31');});
