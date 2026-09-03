// Excel and Google Sheets both treat a leading =, +, -, @, tab, or CR as the start of a formula
// when importing CSV — an attacker-controlled field (e.g. a registrant's name) starting with
// one of these executes as a formula for whoever opens the export. Prefixing with a literal
// single quote makes both applications render the value as plain text instead.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function neutralizeFormula(str: string): string {
  return FORMULA_TRIGGER.test(str) ? `'${str}` : str;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const escape = (value: unknown): string => {
    const raw = value === null || value === undefined ? "" : String(value);
    const str = neutralizeFormula(raw);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map(escape).join(",");
  const lines = rows.map((row) => columns.map((col) => escape(row[col])).join(","));
  return [header, ...lines].join("\r\n");
}

// A registration row's `custom_fields_json` is one opaque blob — flattens it into one
// `custom_<key>` column per key (dynamic column set, grows as an event's field definitions grow)
// instead of exporting an unreadable JSON string, matching the convention already established by
// vercel-metrics' excel_export.py for its own raw_json column.
export function flattenCustomFields(row: Record<string, unknown>): Record<string, unknown> {
  const { custom_fields_json, ...rest } = row;
  const flattened: Record<string, unknown> = { ...rest };
  const custom =
    typeof custom_fields_json === "string" ? (JSON.parse(custom_fields_json) as Record<string, unknown>) : {};
  for (const [key, value] of Object.entries(custom)) {
    flattened[`custom_${key}`] = value;
  }
  return flattened;
}
