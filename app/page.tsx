// Phase 1 status page.
//
// This is a temporary home page whose only job is to prove the
// database connection works: it reads the seeded members and books
// straight from Supabase. The real kiosk Welcome screen replaces
// it in Phase 2.
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

// Always fetch fresh data — never cache this page.
export const dynamic = "force-dynamic";

type Member = { id: string; full_name: string; email: string; is_active: boolean };
type BookAvailability = {
  id: string;
  title: string;
  author: string;
  stock_total: number;
  on_shelf: number;
};

export default async function Phase1StatusPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="status-page">
        <h1>Library</h1>
        <p className="lede">Phase 1 — almost there. Supabase isn&apos;t connected yet.</p>
        <div className="card">
          <h2>Finish setup</h2>
          <ol>
            <li>
              Copy <code>.env.example</code> to <code>.env.local</code>
            </li>
            <li>
              Fill in <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> from
              your Supabase project (Project Settings → API)
            </li>
            <li>Restart the dev server and refresh this page</li>
          </ol>
        </div>
      </main>
    );
  }

  const supabase = createServiceClient();
  const [membersRes, booksRes] = await Promise.all([
    supabase.from("members").select("id, full_name, email, is_active").order("full_name"),
    supabase.from("books_with_availability").select("*").order("title"),
  ]);

  if (membersRes.error || booksRes.error) {
    const message = membersRes.error?.message ?? booksRes.error?.message;
    return (
      <main className="status-page">
        <h1>Library</h1>
        <p className="lede">Phase 1 — connected to Supabase, but a query failed.</p>
        <div className="card">
          <h2>
            <span className="badge error">Database error</span>
          </h2>
          <p>{message}</p>
          <p className="sub" style={{ marginTop: 12 }}>
            Most likely cause: <code>supabase/schema.sql</code> and{" "}
            <code>supabase/seed.sql</code> haven&apos;t been run in the Supabase SQL Editor yet.
          </p>
        </div>
      </main>
    );
  }

  const members = membersRes.data as Member[];
  const books = booksRes.data as BookAvailability[];

  return (
    <main className="status-page">
      <h1>Library</h1>
      <p className="lede">
        Phase 1 complete — Supabase is connected and the tables are live. The kiosk itself
        arrives in Phase 2.
      </p>

      <div className="card">
        <h2>
          Members <span className="badge accent">{members.length}</span>
        </h2>
        {members.map((m) => (
          <div className="row" key={m.id}>
            <span>{m.full_name}</span>
            <span className="sub">{m.email}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>
          Books <span className="badge accent">{books.length}</span>
        </h2>
        {books.map((b) => (
          <div className="row" key={b.id}>
            <span>
              {b.title}
              <span className="sub"> · {b.author}</span>
            </span>
            {b.on_shelf > 0 ? (
              <span className="badge ok">On shelf · {b.on_shelf}</span>
            ) : (
              <span className="badge out">All out</span>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
