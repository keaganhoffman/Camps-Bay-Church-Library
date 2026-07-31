"use client";

import { useEffect, useState } from "react";
import CsvImport from "./CsvImport";
import BarcodeScanner from "@/components/kiosk/BarcodeScanner";

type AdminBook = {
  id: string;
  title: string;
  author: string;
  stock_total: number;
  on_shelf: number;
  is_active: boolean;
  barcode: string | null;
};

// Free public book database — fills in title/author from a scanned
// ISBN so cataloguing is mostly scan-check-save.
async function lookupIsbn(
  code: string
): Promise<{ title: string; author: string } | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(code)}&format=json&jscmd=data`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const info = data[`ISBN:${code}`];
    if (!info?.title) return null;
    return {
      title: info.title,
      author: (info.authors ?? []).map((a: { name: string }) => a.name).join(", "),
    };
  } catch {
    return null;
  }
}

export default function BooksAdmin() {
  const [books, setBooks] = useState<AdminBook[] | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Add form
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newStock, setNewStock] = useState("1");
  const [newBarcode, setNewBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [lookingUp, setLookingUp] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editStock, setEditStock] = useState("1");
  const [editBarcode, setEditBarcode] = useState("");

  function load() {
    fetch("/api/admin/books", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBooks(data.books))
      .catch(() => setMessage("Couldn't load books."));
  }

  useEffect(load, []);

  async function addBook(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const res = await fetch("/api/admin/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        author: newAuthor,
        stock_total: Number(newStock),
        barcode: newBarcode,
      }),
    });
    if (res.ok) {
      setNewTitle("");
      setNewAuthor("");
      setNewStock("1");
      setNewBarcode("");
      load();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.error ?? "Couldn't add the book.");
    }
  }

  // Scan into the add form: barcode fills in, and if title/author are
  // still empty we try Open Library for them.
  async function handleAddScan(code: string) {
    setScanning(false);
    setNewBarcode(code);
    if (!newTitle.trim() && !newAuthor.trim()) {
      setLookingUp(true);
      const found = await lookupIsbn(code);
      setLookingUp(false);
      if (found) {
        setNewTitle(found.title);
        setNewAuthor(found.author);
        setMessage("Found it — check the details, set copies, and tap Add.");
      } else {
        setMessage("Barcode captured. That ISBN isn't in the book database — type the title and author.");
      }
    }
  }

  function startEdit(book: AdminBook) {
    setEditingId(book.id);
    setEditTitle(book.title);
    setEditAuthor(book.author);
    setEditStock(String(book.stock_total));
    setEditBarcode(book.barcode ?? "");
    setMessage(null);
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/admin/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        author: editAuthor,
        stock_total: Number(editStock),
        barcode: editBarcode,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      load();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.error ?? "Couldn't save changes.");
    }
  }

  async function setActive(book: AdminBook, isActive: boolean) {
    const res = await fetch(`/api/admin/books/${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: isActive }),
    });
    if (res.ok) load();
  }

  const filtered = (books ?? []).filter((b) =>
    (b.title + " " + b.author).toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <h1>Books</h1>
      <p className="lede">Add, edit, hide from the kiosk, or import in bulk.</p>

      <form className="card admin-form" onSubmit={addBook}>
        <div className="admin-form-header">
          <h2>Add a book</h2>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setScanning(true);
              setScanKey((k) => k + 1);
              setMessage(null);
            }}
          >
            {lookingUp ? "Looking up…" : "📷 Scan barcode"}
          </button>
        </div>
        {scanning && (
          <div className="scan-card" style={{ marginBottom: 14 }}>
            <BarcodeScanner
              key={scanKey}
              onDetected={handleAddScan}
              hint="Scan the ISBN on the back cover — the barcode fills in below, and we try to fill the title and author too"
            />
            <button type="button" className="btn ghost" onClick={() => setScanning(false)}>
              Close camera
            </button>
          </div>
        )}
        <div className="admin-form-row">
          <input
            className="admin-input grow"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />
          <input
            className="admin-input grow"
            placeholder="Author"
            value={newAuthor}
            onChange={(e) => setNewAuthor(e.target.value)}
            required
          />
          <input
            className="admin-input stock"
            type="number"
            min={0}
            placeholder="Copies"
            value={newStock}
            onChange={(e) => setNewStock(e.target.value)}
            required
          />
          <input
            className="admin-input grow"
            placeholder="Barcode / ISBN (optional)"
            value={newBarcode}
            onChange={(e) => setNewBarcode(e.target.value)}
          />
          <button type="submit" className="btn">
            Add
          </button>
        </div>
      </form>

      <CsvImport
        endpoint="/api/admin/books/import"
        columnsHint="title, author, stock_total, barcode (optional)"
        mapRow={(cells) =>
          cells.length >= 3
            ? {
                title: cells[0],
                author: cells[1],
                stock_total: Number(cells[2]),
                barcode: cells[3] ?? "",
              }
            : null
        }
        onImported={load}
      />

      {message && <p className="admin-message">{message}</p>}

      <input
        type="search"
        className="kiosk-search"
        placeholder="Search books…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginTop: 24 }}
      />
      <div className="kiosk-list">
        {books === null && <p className="sub list-note">Loading…</p>}
        {books !== null && filtered.length === 0 && (
          <p className="sub list-note">No books match.</p>
        )}
        {filtered.map((b) =>
          editingId === b.id ? (
            <div className="admin-row" key={b.id}>
              <input
                className="admin-input grow"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <input
                className="admin-input grow"
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
              />
              <input
                className="admin-input stock"
                type="number"
                min={0}
                value={editStock}
                onChange={(e) => setEditStock(e.target.value)}
              />
              <input
                className="admin-input grow"
                placeholder="Barcode / ISBN"
                value={editBarcode}
                onChange={(e) => setEditBarcode(e.target.value)}
              />
              <button type="button" className="btn" onClick={() => saveEdit(b.id)}>
                Save
              </button>
              <button type="button" className="btn ghost" onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="admin-row" key={b.id}>
              <span className="grow">
                {b.title}
                <span className="sub"> · {b.author}</span>
                {!b.is_active && <span className="badge out"> Hidden</span>}
                {!b.barcode && <span className="badge out"> no barcode</span>}
              </span>
              <span className="sub">
                {b.on_shelf}/{b.stock_total} on shelf
              </span>
              <button type="button" className="btn ghost" onClick={() => startEdit(b)}>
                Edit
              </button>
              {b.is_active ? (
                <button type="button" className="btn ghost danger" onClick={() => setActive(b, false)}>
                  Hide
                </button>
              ) : (
                <button type="button" className="btn ghost" onClick={() => setActive(b, true)}>
                  Show
                </button>
              )}
            </div>
          )
        )}
      </div>
    </>
  );
}
