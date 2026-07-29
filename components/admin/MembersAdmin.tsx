"use client";

import { useEffect, useState } from "react";
import CsvImport from "./CsvImport";
import { daysLate, formatShortDate } from "@/lib/dates";

type AdminMember = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
};

type HistoryLoan = {
  id: string;
  title: string;
  borrowedLabel: string;
  badge: { label: string; tone: "accent" | "error" | "out" | "ok" };
};

export default function MembersAdmin() {
  const [members, setMembers] = useState<AdminMember[] | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Add form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPin, setNewPin] = useState("");

  // Inline edit / PIN reset
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [pinResetId, setPinResetId] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState("");

  // Borrowing history, expanded inline under one member at a time.
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyLoans, setHistoryLoans] = useState<HistoryLoan[] | null>(null);

  function load() {
    fetch("/api/admin/members", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setMembers(data.members))
      .catch(() => setMessage("Couldn't load members."));
  }

  useEffect(load, []);

  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: newName, email: newEmail, pin: newPin }),
    });
    if (res.ok) {
      setNewName("");
      setNewEmail("");
      setNewPin("");
      load();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.error ?? "Couldn't add the member.");
    }
  }

  async function patchMember(id: string, patch: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/admin/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setMessage(data?.error ?? "Couldn't save changes.");
      return false;
    }
    load();
    return true;
  }

  async function saveEdit(id: string) {
    if (await patchMember(id, { full_name: editName, email: editEmail })) {
      setEditingId(null);
    }
  }

  async function toggleHistory(id: string) {
    if (historyId === id) {
      setHistoryId(null);
      return;
    }
    setHistoryId(id);
    setHistoryLoans(null);
    const res = await fetch(`/api/admin/members/${id}/loans`, { cache: "no-store" });
    if (!res.ok) {
      setMessage("Couldn't load that member's history.");
      setHistoryId(null);
      return;
    }
    const data = await res.json();
    setHistoryLoans(
      (
        data.loans as {
          id: string;
          title: string;
          borrowed_at: string;
          due_at: string;
          returned_at: string | null;
          lost: boolean;
        }[]
      ).map((l) => {
        let badge: HistoryLoan["badge"];
        if (l.lost) badge = { label: "lost", tone: "out" };
        else if (l.returned_at)
          badge = { label: `returned ${formatShortDate(l.returned_at)}`, tone: "ok" };
        else if (daysLate(l.due_at) > 0)
          badge = { label: `${daysLate(l.due_at)} days late`, tone: "error" };
        else badge = { label: `due ${formatShortDate(l.due_at)}`, tone: "accent" };
        return {
          id: l.id,
          title: l.title,
          borrowedLabel: formatShortDate(l.borrowed_at),
          badge,
        };
      })
    );
  }

  async function savePinReset(id: string) {
    if (await patchMember(id, { pin: resetPin })) {
      setPinResetId(null);
      setResetPin("");
      setMessage("PIN updated.");
    }
  }

  const filtered = (members ?? []).filter((m) =>
    (m.full_name + " " + m.email).toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <h1>Members</h1>
      <p className="lede">Add, edit, reset PINs, deactivate, or import in bulk.</p>

      <form className="card admin-form" onSubmit={addMember}>
        <h2>Add a member</h2>
        <div className="admin-form-row">
          <input
            className="admin-input grow"
            placeholder="Full name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <input
            className="admin-input grow"
            type="email"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          <input
            className="admin-input stock"
            placeholder="4-digit PIN"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            required
          />
          <button type="submit" className="btn">
            Add
          </button>
        </div>
      </form>

      <CsvImport
        endpoint="/api/admin/members/import"
        columnsHint="full_name, email, pin"
        mapRow={(cells) =>
          cells.length >= 3 ? { full_name: cells[0], email: cells[1], pin: cells[2] } : null
        }
        onImported={load}
      />

      {message && <p className="admin-message">{message}</p>}

      <input
        type="search"
        className="kiosk-search"
        placeholder="Search members…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginTop: 24 }}
      />
      <div className="kiosk-list">
        {members === null && <p className="sub list-note">Loading…</p>}
        {members !== null && filtered.length === 0 && (
          <p className="sub list-note">No members match.</p>
        )}
        {filtered.map((m) => {
          if (editingId === m.id) {
            return (
              <div className="admin-row" key={m.id}>
                <input
                  className="admin-input grow"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
                <input
                  className="admin-input grow"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
                <button type="button" className="btn" onClick={() => saveEdit(m.id)}>
                  Save
                </button>
                <button type="button" className="btn ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </div>
            );
          }
          if (pinResetId === m.id) {
            return (
              <div className="admin-row" key={m.id}>
                <span className="grow">{m.full_name}</span>
                <input
                  className="admin-input stock"
                  placeholder="New 4-digit PIN"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={resetPin}
                  onChange={(e) => setResetPin(e.target.value)}
                  autoFocus
                />
                <button type="button" className="btn" onClick={() => savePinReset(m.id)}>
                  Set PIN
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setPinResetId(null);
                    setResetPin("");
                  }}
                >
                  Cancel
                </button>
              </div>
            );
          }
          return (
            <div key={m.id}>
            <div className="admin-row">
              <span className="grow">
                {m.full_name}
                <span className="sub"> · {m.email}</span>
                {!m.is_active && <span className="badge out"> Deactivated</span>}
              </span>
              <button type="button" className="btn ghost" onClick={() => toggleHistory(m.id)}>
                {historyId === m.id ? "Hide history" : "History"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setEditingId(m.id);
                  setEditName(m.full_name);
                  setEditEmail(m.email);
                  setMessage(null);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setPinResetId(m.id);
                  setResetPin("");
                  setMessage(null);
                }}
              >
                Reset PIN
              </button>
              {m.is_active ? (
                <button
                  type="button"
                  className="btn ghost danger"
                  onClick={() => patchMember(m.id, { is_active: false })}
                >
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => patchMember(m.id, { is_active: true })}
                >
                  Reactivate
                </button>
              )}
            </div>
            {historyId === m.id && (
              <div className="history-block">
                {historyLoans === null && <p className="sub">Loading history…</p>}
                {historyLoans !== null && historyLoans.length === 0 && (
                  <p className="sub">No loans yet.</p>
                )}
                {(historyLoans ?? []).map((l) => (
                  <div className="history-row" key={l.id}>
                    <span className="grow">
                      {l.title}
                      <span className="sub"> · borrowed {l.borrowedLabel}</span>
                    </span>
                    <span className={`badge ${l.badge.tone}`}>{l.badge.label}</span>
                  </div>
                ))}
              </div>
            )}
            </div>
          );
        })}
      </div>
    </>
  );
}
