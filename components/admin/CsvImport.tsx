"use client";

import { useState } from "react";
import { parseDelimited, looksLikeHeader } from "@/lib/csv";

// Shared CSV import box: choose a .csv file OR paste rows copied
// straight from Excel/Google Sheets, then import. mapRow turns one
// line's cells into the object the API expects (null = drop the line).
export default function CsvImport({
  endpoint,
  columnsHint,
  mapRow,
  onImported,
}: {
  endpoint: string;
  columnsHint: string;
  mapRow: (cells: string[]) => Record<string, unknown> | null;
  onImported: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then(setText);
    setMessage(null);
  }

  async function runImport() {
    const rows = parseDelimited(text);
    const dataRows = rows.filter((cells, i) => !(i === 0 && looksLikeHeader(cells)));
    const mapped = dataRows
      .map(mapRow)
      .filter((row): row is Record<string, unknown> => row !== null);

    if (mapped.length === 0) {
      setMessage(`Nothing usable found. Expected columns: ${columnsHint}`);
      return;
    }

    setBusy(true);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: mapped }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);

    if (res.ok) {
      setMessage(
        `Done — ${data.imported} imported, ${data.skippedAsDuplicates} skipped (already existed).`
      );
      setText("");
      onImported();
    } else if (Array.isArray(data?.details)) {
      setMessage(`Fix these first: ${data.details.slice(0, 3).join(" · ")}`);
    } else {
      setMessage(data?.error ?? "Import failed — please try again.");
    }
  }

  return (
    <div className="card">
      <h2>Import from spreadsheet</h2>
      <p className="sub">
        Columns in order: <code>{columnsHint}</code>. Choose a .csv file, or copy the rows in
        Excel/Google Sheets and paste them below (a header row is fine — it&apos;s skipped).
      </p>
      <input type="file" accept=".csv,.txt,.tsv" onChange={handleFile} className="import-file" />
      <textarea
        className="import-textarea"
        rows={5}
        placeholder={"Or paste rows here…"}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMessage(null);
        }}
      />
      <button type="button" className="btn" onClick={runImport} disabled={busy || !text.trim()}>
        {busy ? "Importing…" : "Import"}
      </button>
      {message && <p className="admin-message">{message}</p>}
    </div>
  );
}
