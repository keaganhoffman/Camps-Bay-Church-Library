// Tiny spreadsheet-text parser for the admin CSV imports.
// Handles real .csv files (commas, with "quoted, values") and also
// text copied straight out of Excel/Google Sheets (tab-separated).
// No embedded line breaks inside cells — fine for names and titles.

export function parseDelimited(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  return lines.map((line) => splitLine(line, delimiter));
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'; // escaped quote inside a quoted cell
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** True if a row looks like a header (e.g. "title, author, ..."), so imports can skip it. */
export function looksLikeHeader(cells: string[]): boolean {
  const first = (cells[0] ?? "").toLowerCase();
  return ["title", "full_name", "full name", "name"].includes(first);
}
