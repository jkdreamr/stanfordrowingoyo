export interface CsvRow {
  row: number;
  cells: string[];
  error?: string;
}
export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  let line = 1;
  let start = 1;
  let error: string | undefined;
  const finish = () => {
    cells.push(cell);
    if (cells.some((value) => value.length) || error) rows.push({ row: start, cells, error });
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
  return rows;
}
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
