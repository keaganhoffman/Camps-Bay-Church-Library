# Camps Bay Church Library

Self-service library kiosk for Christian Life Camps Bay: an iPad borrow/return
kiosk, an admin area, and automated email reminders.

**Stack:** Next.js (App Router) + TypeScript · Supabase (PostgreSQL) · Resend · Vercel

## Build phases

| Phase | What | Status |
| ----- | ---- | ------ |
| 1 | Project scaffold, database schema, seed data | ✅ |
| 2 | Kiosk borrow flow | ✅ |
| 3 | Kiosk return flow + idle reset | ✅ this branch |
| 4 | Receipt + thank-you emails (Resend) | — |
| 5 | Daily cron: due-soon + overdue emails | — |
| 6 | Admin area (PIN gate, CRUD, CSV import) | — |
| 7 | Stock count | — |
| 8 | Polish, PWA, deploy | — |

## Phase 1 setup (do this once)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (free tier is fine).
2. Create a new project — any name, e.g. `camps-bay-library`. Pick a strong
   database password and save it somewhere safe (you rarely need it again).
3. Wait a minute or two for the project to finish provisioning.

### 2. Create the tables

1. In the Supabase dashboard, open **SQL Editor**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. Then paste the contents of [`supabase/seed.sql`](supabase/seed.sql) and **Run** that too.
   This adds 5 test members and 8 test books.

Test credentials created by the seed: every member's kiosk PIN is **1234**,
and the admin PIN is **123456**. The member emails are fake `@example.com`
addresses on purpose, so no real person can receive a test email.

### 3. Connect the app

1. Copy `.env.example` to `.env.local` (this file is git-ignored — secrets stay off GitHub).
2. In Supabase go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role** secret → `SUPABASE_SERVICE_ROLE_KEY` (server only — never share this one)
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see a status
page listing the 5 test members and 8 test books, each showing a green
"On shelf" badge. If you see that, Phase 1 works and we can start Phase 2.

## Testing Phase 2 (the borrow flow)

With `.env.local` filled in and `npm run dev` running, open
[http://localhost:3000](http://localhost:3000):

1. You'll see the kiosk **Welcome** screen. Tap **Borrow a book**.
2. Search for and tap a test member (e.g. *Grace Ndlovu*).
3. Enter PIN **1234** on the keypad. (Try a wrong PIN first — the dots shake.
   Five wrong attempts locks that member out for 5 minutes.)
4. Pick a book. Each shows a green **On shelf · N** badge; books with every
   copy out show a greyed **All out** badge and can't be tapped.
5. Confirm — you'll see the borrower, the return-by date (30 days out), and
   copies left. Tap confirm, get the success screen, tap **Done**.
6. Check [/status](http://localhost:3000/status): that book's shelf count is
   now one lower. The loan row is in Supabase under **Table Editor → loans**.

No emails are sent yet — that's Phase 4.

## Testing Phase 3 (returns + idle reset)

1. Borrow a book first (see above) so there's something to return.
2. From Welcome, tap **Return a book**, sign in as the same member (PIN
   **1234**). You'll see that member's open loans, each with a blue
   **Due 28 Aug**-style badge — or a red **N days late** badge if overdue.
3. Tap the book, confirm, and you'll get the **Thank you** screen ("you're
   all square" if nothing else is out). The shelf count on
   [/status](http://localhost:3000/status) goes back up, and the loan row in
   Supabase now has a `returned_at` timestamp.
4. To see an **overdue** badge: in Supabase **Table Editor → loans**, edit an
   open loan's `due_at` to a date in the past, then run the return flow again.
5. **Idle reset**: on any screen except Welcome, walk away for 60 seconds —
   the kiosk returns to Welcome by itself and forgets everything (any touch
   or keypress restarts the 60-second clock).

## How the pieces fit

- `supabase/schema.sql` — the database: members, books, loans, email_log,
  stock counts, admin settings. Every table has Row Level Security switched on
  with no policies, so the public key can access nothing; all reads and writes
  go through Next.js server code using the service role key.
- `supabase/seed.sql` — test data. PINs are stored only as bcrypt hashes.
- `lib/supabase/server.ts` — the single server-side Supabase client. Importing
  it from browser code fails the build (`server-only`), which protects the key.
- "On shelf" counts are never stored — the `books_with_availability` view
  derives them live as `stock_total − open loans`, so they can't drift.
- `app/` — the Next.js app. For now just the Phase 1 status page; the kiosk
  screens arrive in Phase 2.
