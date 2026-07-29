# Camps Bay Church Library

Self-service library kiosk for Christian Life Camps Bay: an iPad borrow/return
kiosk, an admin area, and automated email reminders.

**Stack:** Next.js (App Router) + TypeScript · Supabase (PostgreSQL) · Resend · Vercel

## Build phases

| Phase | What | Status |
| ----- | ---- | ------ |
| 1 | Project scaffold, database schema, seed data | ✅ |
| 2 | Kiosk borrow flow | ✅ |
| 3 | Kiosk return flow + idle reset | ✅ |
| 4 | Receipt + thank-you emails (Resend) | ✅ |
| 5 | Daily cron: due-soon + overdue emails | ✅ |
| 6 | Admin area (PIN gate, CRUD, CSV import) | ✅ this branch |
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

## Testing Phase 4 (receipt + thank-you emails)

One-time setup:

1. Create a free account at [resend.com](https://resend.com) (sign up with
   **your own** email address — that matters below).
2. In Resend go to **API Keys → Create API Key**, copy it, and paste it into
   `.env.local` as `RESEND_API_KEY=re_...`. Restart `npm run dev`.
3. **Important:** until we verify a domain in Phase 8, Resend's sandbox
   sender only delivers to the email address that owns the Resend account.
   So in Supabase **Table Editor → members**, change one test member's
   `email` to your own address.

Then test:

1. Borrow a book as that member → within a minute you should receive
   **"Your book: …"** with the title, your first name, and the return-by date.
2. Return it → you should receive **"Thanks for returning …"**.
3. Each sent email is recorded in **Table Editor → email_log** (types
   `receipt` and `thank_you`) — that log is what stops the Phase 5 cron from
   ever double-sending.
4. Members with fake `@example.com` addresses simply won't get mail (Resend
   declines it, the kiosk carries on) — emails failing never blocks a
   borrow or return.

## Testing Phase 5 (daily reminder emails)

One-time setup:

1. In Vercel → Settings → your Production environment variables, add
   **`CRON_SECRET`** with any long random string you invent (20+ characters,
   letters and numbers — it's a password for the reminder job).
2. Redeploy (Deployments → ⋯ → Redeploy). Vercel reads `vercel.json` and
   schedules the job daily at 06:00 UTC (08:00 South African time).

Create two fake loans to trigger both email types — paste this into the
Supabase **SQL Editor** and Run (it lends Grace two books with artificial
due dates: one due in 2 days, one 4 days overdue):

```sql
insert into loans (member_id, book_id, borrowed_at, due_at)
select m.id, b.id, now() - interval '28 days', now() + interval '2 days'
from members m, books b
where m.full_name = 'Grace Ndlovu' and b.title = 'Knowing God';

insert into loans (member_id, book_id, borrowed_at, due_at)
select m.id, b.id, now() - interval '34 days', now() - interval '4 days'
from members m, books b
where m.full_name = 'Grace Ndlovu' and b.title = 'Prayer';
```

Then trigger a run by opening this in your browser (swap in your site and
your secret):

```
https://YOUR-SITE.vercel.app/api/cron/reminders?key=YOUR-CRON-SECRET
```

What you should see:

- The page shows a JSON summary: 1 due-soon sent, 1 overdue sent.
- Your inbox gets **"A gentle reminder: Knowing God is due soon"** and
  **"Prayer is overdue"**.
- **Refresh the page** — the summary now shows 0 sent (already-sent counts
  instead). That's the email_log idempotency working: due-soon goes out once
  ever per loan; overdue at most once per day (it would send again tomorrow).
- Clean up afterwards: return both books via the kiosk, or delete the two
  loan rows in Table Editor.

## Testing Phase 6 (admin area)

One-time setup — run the migration: Supabase → **SQL Editor** → paste the
contents of [`supabase/migrations/002_admin.sql`](supabase/migrations/002_admin.sql)
→ Run. (Adds the ability to hide a book from the kiosk.)

Then on the site, tap the small **Admin** link in the Welcome footer and
enter PIN **123456**:

- **Books** — add one, edit it, **Hide** it (check it vanishes from the
  kiosk borrow list), Show it again. Try the import box: paste a couple of
  rows like `New Book Title, Some Author, 2` and Import. Re-import the same
  rows — they're skipped as duplicates.
- **Members** — add someone, edit them, **Reset PIN** (then sign in on the
  kiosk with the new PIN), Deactivate (they disappear from kiosk sign-in).
  Import expects `full_name, email, pin` rows.
- **Loans** — everything currently out with due badges, an overdue-only
  filter, and **Mark returned** for books left at the desk (no email is
  sent for desk returns).
- The admin session lasts 1 hour (then the PIN is asked again); 5 minutes
  of inactivity returns the iPad to the Welcome screen.

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
