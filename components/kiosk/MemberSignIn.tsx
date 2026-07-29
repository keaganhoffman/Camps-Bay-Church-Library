"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PinPad from "./PinPad";
import { firstName, initials, colorIndex } from "@/lib/names";

export type Member = { id: string; full_name: string };

const AVATAR_BUCKETS = 6;

// Shared sign-in for both kiosk flows: searchable member list, then
// the PIN pad. Calls onSignedIn(member, pin) once the server has
// verified the PIN. The PIN is passed up so the final action
// (checkout / return) can be re-verified server-side.
export default function MemberSignIn({
  heading,
  onSignedIn,
}: {
  heading: string;
  onSignedIn: (member: Member, pin: string) => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [search, setSearch] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/kiosk/members", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setMembers(data.members))
      .catch(() => setLoadError("Couldn't load the member list. Is the database connected?"));
  }, []);

  async function verifyPin(entered: string): Promise<string | null> {
    if (!member) return "Something went wrong — start again.";
    const res = await fetch("/api/kiosk/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, pin: entered }),
    });
    if (res.ok) {
      onSignedIn(member, entered);
      return null;
    }
    if (res.status === 423) {
      const data = await res.json().catch(() => null);
      const minutes = Math.max(1, Math.ceil((data?.retryAfterSeconds ?? 300) / 60));
      return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
    }
    return "That PIN isn't right — try again.";
  }

  if (loadError) {
    return (
      <div className="kiosk-card">
        <h2>Hmm, that didn&apos;t work</h2>
        <p className="sub">{loadError}</p>
        <Link href="/" className="big-btn" style={{ marginTop: 24 }}>
          Back to start
        </Link>
      </div>
    );
  }

  if (member) {
    return (
      <>
        <h1>Hi, {firstName(member.full_name)}</h1>
        <p className="lede">Enter your 4-digit PIN.</p>
        <PinPad onSubmit={verifyPin} />
        <button type="button" className="link-btn" onClick={() => setMember(null)}>
          Not you? Go back
        </button>
      </>
    );
  }

  const searching = search.trim().length > 0;
  const filtered = (members ?? []).filter((m) =>
    m.full_name.toLowerCase().includes(search.trim().toLowerCase())
  );

  // A–Z sections (only while browsing — search results stay flat).
  const groups: [string, Member[]][] = [];
  if (!searching) {
    for (const m of filtered) {
      const letter = /^[a-z]/i.test(m.full_name) ? m.full_name[0].toUpperCase() : "#";
      const last = groups[groups.length - 1];
      if (last && last[0] === letter) last[1].push(m);
      else groups.push([letter, [m]]);
    }
  }

  const memberRow = (m: Member) => (
    <button key={m.id} type="button" className="kiosk-row" onClick={() => setMember(m)}>
      <span className="row-left">
        <span className={`avatar avatar-${colorIndex(m.full_name, AVATAR_BUCKETS)}`}>
          {initials(m.full_name)}
        </span>
        {m.full_name}
      </span>
    </button>
  );

  return (
    <>
      <Link href="/" className="back-btn">
        <span className="chevron">‹</span> Back
      </Link>
      <h1>{heading}</h1>
      <p className="lede">Find your name, then enter your PIN.</p>
      <input
        type="search"
        className="kiosk-search"
        placeholder="Search your name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="kiosk-list">
        {members === null && <p className="sub list-note">Loading members…</p>}
        {members !== null && filtered.length === 0 && (
          <div className="list-note">
            <p className="sub">No one found by that name.</p>
            <Link href="/join" className="link-btn" style={{ margin: "8px 0 0" }}>
              Can&apos;t find your name? Create an account
            </Link>
          </div>
        )}
        {searching
          ? filtered.map(memberRow)
          : groups.map(([letter, ms]) => (
              <div key={letter}>
                <div className="kiosk-letter">{letter}</div>
                {ms.map(memberRow)}
              </div>
            ))}
      </div>
    </>
  );
}
