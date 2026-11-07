import { describe, expect, it } from 'vitest';
import type { ComplianceRow } from '../../../../shared/types';
import {
  auditSummary,
  complianceSummary,
  exportError,
  exportRange,
  factorError,
  humanizeAction,
  relativeAuditTime,
  seasonError,
  targetError,
} from './operations';

const row = (name: string, percent: number, entry_count: number, last_log: string | null = null) =>
  ({ user: { id: name, name }, percent, entry_count, last_log }) as ComplianceRow;
describe('compliance summaries', () => {
  it('sorts lowest percentage first, breaks ties by name and does not mutate input', () => {
    const rows = [row('Zoe', 100, 1), row('Bella', 0, 0), row('Anna', 0, 1)];
    expect(complianceSummary(rows).rows.map((r) => r.user.name)).toEqual(['Anna', 'Bella', 'Zoe']);
    expect(rows[0].user.name).toBe('Zoe');
    expect(complianceSummary(rows, 'name').rows.map((r) => r.user.name)).toEqual([
      'Anna',
      'Bella',
      'Zoe',
    ]);
    expect(complianceSummary(rows).onTarget).toBe(1);
  });
  it('uses this week entry count, not all-time last log or percent, for the not-logged list', () => {
    const summary = complianceSummary([
      row('Zoe', 0, 0, '2026-01-01'),
      row('Anna', 0, 0),
      row('Logged', 0, 1),
    ]);
    expect(summary.notLogged.map((u) => u.name)).toEqual(['Anna', 'Zoe']);
    expect(complianceSummary([])).toEqual({ rows: [], onTarget: 0, notLogged: [] });
  });
});
describe('backend-compatible settings validation', () => {
  it('accepts inclusive factor bounds and rejects blank, non-finite and out-of-range values', () => {
    for (const value of ['0.01', '100', '1.4']) expect(factorError(value)).toBe('');
    for (const value of ['', ' ', 'NaN', 'Infinity', '-1', '0', '100.01', '0.009'])
      expect(factorError(value)).not.toBe('');
  });
  it('requires whole target meters within inclusive bounds', () => {
    for (const value of ['1000', '80000', '1000000']) expect(targetError(value)).toBe('');
    for (const value of ['', 'Infinity', '1.5', '1000.1', '999', '1000001'])
      expect(targetError(value)).not.toBe('');
  });
  it('allows February 29 like the backend and rejects malformed or impossible month/day', () => {
    for (const value of ['09-01', '02-29', '12-31']) expect(seasonError(value)).toBe('');
    for (const value of ['', '2-01', '13-01', '04-31', '01-00'])
      expect(seasonError(value)).not.toBe('');
  });
});
describe('export ranges and audit details', () => {
  it('validates real inclusive dates', () => {
    expect(exportError('2026-01-01', '2026-01-01')).toBe('');
    expect(exportError('', '')).not.toBe('');
    expect(exportError('2026-02-29', '2026-03-01')).not.toBe('');
    expect(exportError('2026-02-01', '2026-01-01')).not.toBe('');
    expect(exportRange('month', '2026-01-01', '2025-12-29', '09-01')).toEqual({
      start: '2025-12-03',
      end: '2026-01-01',
    });
    expect(exportRange('week', '2026-01-01', '2025-12-29', '09-01').start).toBe('2025-12-29');
    expect(exportRange('season', '2026-01-01', '2025-12-29', '09-01').start).toBe('2025-09-01');
  });
  it('humanizes audit actions, summarizes changed fields and tolerates empty or invalid detail', () => {
    expect(humanizeAction('entries.recalculate')).toBe('Recalculated Entries');
    expect(humanizeAction('preset.create')).toBe('Created Preset');
    expect(auditSummary('bad')).toEqual({ fields: [] });
    expect(auditSummary('{}')).toEqual({ fields: [] });
    expect(auditSummary('{"after":{"updated":3}}').updated).toBe(3);
    expect(
      auditSummary(
        '{"before":{"name":"A","password_hash":"x"},"after":{"name":"B","password_hash":"y"}}',
      ).fields,
    ).toEqual(['name']);
    expect(relativeAuditTime('bad')).toBe('Unknown time');
    expect(relativeAuditTime('2026-01-01T00:00:00Z', Date.parse('2026-01-01T01:00:00Z'))).toBe(
      '1 hour ago',
    );
  });
});
