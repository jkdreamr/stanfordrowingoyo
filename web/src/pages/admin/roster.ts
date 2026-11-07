import type { GroupKey, Role, RosterInput, RosterRow, User } from '../../../../shared/types';

export const roles: Role[] = ['rower', 'coxswain', 'coach', 'admin'];
export const groups: GroupKey[] = ['frosh', 'normal', 'u23'];
export const roleLabels = { rower: 'Rower', coxswain: 'Coxswain', coach: 'Coach', admin: 'Admin' };
export const groupLabels = { frosh: 'Frosh', normal: 'Normal Non-Frosh', u23: 'U23' };
export interface Person {
  key: string;
  roster?: RosterRow;
  user?: User;
}
export function mergePeople(roster: RosterRow[], users: User[]): Person[] {
  const linked = new Set(roster.map((row) => row.claimed_by_user_id));
  const byId = new Map(users.map((user) => [user.id, user]));
  const people: Person[] = [
    ...roster.map((row) => ({
      key: row.id,
      roster: row,
      user: byId.get(row.claimed_by_user_id ?? ''),
    })),
    ...users.filter((user) => !linked.has(user.id)).map((user) => ({ key: user.id, user })),
  ];
  return people.sort((a, b) =>
    (a.user?.name ?? a.roster!.name).localeCompare(b.user?.name ?? b.roster!.name),
  );
}
export interface CsvRecord {
  row: number;
  cells: string[];
  error?: string;
}
export function csvRecords(text: string): CsvRecord[] {
  const result: CsvRecord[] = [];
  let cells: string[] = [],
    cell = '',
    quoted = false,
    closed = false,
    line = 1,
    start = 1;
  let error: string | undefined;
  const finish = () => {
    cells.push(cell);
    if (cells.some(Boolean) || error) result.push({ row: start, cells, error });
    cells = [];
    cell = '';
    closed = false;
    error = undefined;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        cell += c;
        if (c === '\n' || (c === '\r' && text[i + 1] !== '\n')) line++;
      }
    } else if (c === ',') {
      cells.push(cell);
      cell = '';
      closed = false;
    } else if (c === '\r' || c === '\n') {
      finish();
      if (c === '\r' && text[i + 1] === '\n') i++;
      line++;
      start = line;
    } else if (c === '"' && cell === '' && !closed) quoted = true;
    else {
      if (closed || c === '"') error = 'CSV quoting is invalid.';
      cell += c;
    }
  }
  if (quoted) error = 'CSV quoted field is not closed.';
  finish();
  return result;
}
export function rosterErrors(input: RosterInput, isAdmin: boolean): string[] {
  const errors: string[] = [];
  if (!input.name.trim() || input.name.trim().length > 80)
    errors.push('Name must be 1–80 characters.');
  if (input.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254))
    errors.push('Email is invalid.');
  if (!roles.includes(input.role)) errors.push('Choose a valid role.');
  if (input.role === 'admin' && !isAdmin)
    errors.push('Only admins can add or change admin roster rows.');
  if (input.group_key && !groups.includes(input.group_key)) errors.push('Choose a valid group.');
  if (input.side && !['port', 'starboard', 'both', 'cox'].includes(input.side))
    errors.push('Choose a valid side.');
  if (
    input.class_year !== null &&
    (!Number.isInteger(input.class_year) || input.class_year < 1950 || input.class_year > 2100)
  )
    errors.push('Class year must be between 1950 and 2100.');
  return errors;
}
export function previewRoster(csv: string, isAdmin: boolean) {
  const records = csvRecords(csv);
  let columns: number | undefined;
  let headerError: string | undefined;
  if (records[0]?.cells[0].trim().toLowerCase() === 'name') {
    const header = records.shift()!;
    const names = header.cells.map((cell) => cell.trim().toLowerCase()).join(',');
    if (
      header.error ||
      !['name,email,role,group,side,class_year', 'name,role,group,side,class_year'].includes(names)
    )
      headerError =
        'CSV header must be name,email,role,group,side,class_year (email may be omitted).';
    columns = header.cells.length;
  }
  const rows = records.map((record) => {
    const cells = [...record.cells];
    if (cells.length === 5) cells.splice(1, 0, '');
    const [name = '', email = '', role = '', group = '', side = '', year = ''] = cells;
    const input: RosterInput = {
      name: name.trim(),
      email: email.trim().toLowerCase() || null,
      role: role.trim() as Role,
      group_key: (group.trim() as GroupKey) || null,
      side: (side.trim() as RosterInput['side']) || null,
      class_year: year.trim() ? (/^\d{4}$/.test(year.trim()) ? Number(year) : NaN) : null,
    };
    const errors = rosterErrors(input, isAdmin);
    if (record.error) errors.unshift(record.error);
    if (
      ![5, 6].includes(record.cells.length) ||
      (columns !== undefined && columns !== record.cells.length)
    )
      errors.unshift('Each row must have five or six columns.');
    return { ...record, input, errors };
  });
  return {
    rows,
    headerError,
    error: csv.length > 60000 ? 'CSV must be at most 60,000 characters.' : undefined,
  };
}
