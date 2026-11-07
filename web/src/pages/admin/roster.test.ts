import { describe, expect, it } from 'vitest';
import { createFixtures } from '../../mock/fixtures';
import { csvRecords, mergePeople, previewRoster } from './roster';

describe('roster people', () => {
  it('merges claimed rows once and includes users without roster rows', () => {
    const { roster, users } = createFixtures(new Date('2026-11-06T18:00:00Z'));
    const people = mergePeople(roster.slice(1), users);
    expect(people.filter((p) => p.user)).toHaveLength(users.length);
    expect(new Set(people.filter((p) => p.user).map((p) => p.user!.id)).size).toBe(users.length);
    expect(people.some((p) => p.user && !p.roster)).toBe(true);
    expect(people.some((p) => p.roster && !p.user)).toBe(true);
  });
  it('accepts empty lists', () => expect(mergePeople([], [])).toEqual([]));
});
describe('CSV roster preview', () => {
  it('reads quoted commas, escaped quotes, multiline fields and original line numbers', () => {
    expect(csvRecords('"A, B","a""b"\r\n"Line\nTwo",x\r\n\r\nZ,y')).toEqual([
      { row: 1, cells: ['A, B', 'a"b'], error: undefined },
      { row: 2, cells: ['Line\nTwo', 'x'], error: undefined },
      { row: 5, cells: ['Z', 'y'], error: undefined },
    ]);
  });
  it('accepts six-column and email-less headers and blank optional values', () => {
    const full = previewRoster(
      'name,email,role,group,side,class_year\r\n"Alex, Lee",Alex@example.com,rower,normal,port,2027',
      true,
    );
    expect(full.rows[0].input).toMatchObject({
      name: 'Alex, Lee',
      email: 'alex@example.com',
      class_year: 2027,
    });
    expect(full.rows[0].errors).toEqual([]);
    const short = previewRoster('name,role,group,side,class_year\nAlex,coach,,,', true);
    expect(short.rows[0].input).toMatchObject({
      email: null,
      group_key: null,
      side: null,
      class_year: null,
    });
    expect(short.rows[0].errors).toEqual([]);
    expect(previewRoster('', true).rows).toEqual([]);
    expect(previewRoster('\r\n', true).rows).toEqual([]);
  });
  it('reports malformed headers, column counts, quotes and fields before import', () => {
    expect(previewRoster('name,role\nA,rower', true).headerError).toBeTruthy();
    expect(previewRoster('A,rower', true).rows[0].errors).toContain(
      'Each row must have five or six columns.',
    );
    expect(csvRecords('"unclosed')[0].error).toBeTruthy();
    expect(csvRecords('"closed"oops,x')[0].error).toBeTruthy();
    const invalid = previewRoster(',bad-email,admin,other,other,1949', false).rows[0].errors;
    expect(invalid).toHaveLength(6);
    expect(previewRoster('A,,rower,normal,,2027.5', true).rows[0].errors).toContain(
      'Class year must be between 1950 and 2100.',
    );
    expect(previewRoster('x'.repeat(60001), true).error).toBeTruthy();
  });
});
