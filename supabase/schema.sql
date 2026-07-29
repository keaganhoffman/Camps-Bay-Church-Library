-- ============================================================
-- Christian Life Camps Bay Library — database schema (Phase 1)
--
-- HOW TO RUN: open your Supabase project → SQL Editor →
-- paste this whole file → Run. Run it once only.
-- ============================================================

-- pgcrypto gives us gen_random_uuid() for IDs and crypt()/gen_salt()
-- for bcrypt PIN hashing (used by seed.sql).
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- members — everyone who can borrow a book
-- ------------------------------------------------------------
create table members (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  email      text not null unique,
  pin_hash   text not null,                     -- bcrypt hash of a 4-digit PIN, never the PIN itself
  is_active  boolean not null default true,     -- deactivate instead of delete, so loan history is kept
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- books — one row per title (not per physical copy)
-- ------------------------------------------------------------
create table books (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  author      text not null,
  stock_total int  not null default 1 check (stock_total >= 0),  -- copies the library owns
  created_at  timestamptz not null default now()
);
-- "On shelf" is NOT stored. It is always derived as:
--   stock_total - (open loans for that book)
-- Storing it separately would let the two numbers drift apart.

-- ------------------------------------------------------------
-- loans — one row every time a book goes out
-- ------------------------------------------------------------
create table loans (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id),
  book_id     uuid not null references books(id),
  borrowed_at timestamptz not null default now(),
  due_at      timestamptz not null,             -- borrowed_at + 30 days (set by the app)
  returned_at timestamptz,                      -- NULL means the book is still out
  created_at  timestamptz not null default now()
);

-- Speeds up the two questions we ask constantly:
-- "how many open loans does this book have?" and "what does this member have out?"
create index loans_open_by_book_idx   on loans (book_id) where returned_at is null;
create index loans_by_member_idx      on loans (member_id);

-- ------------------------------------------------------------
-- email_log — record of every email sent, so we never double-send
-- ------------------------------------------------------------
create table email_log (
  id      uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id),
  type    text not null check (type in ('receipt', 'due_soon', 'overdue', 'thank_you')),
  sent_at timestamptz not null default now()
);

create index email_log_by_loan_idx on email_log (loan_id, type);

-- ------------------------------------------------------------
-- stock_counts + stock_count_lines — monthly physical count
-- ------------------------------------------------------------
create table stock_counts (
  id         uuid primary key default gen_random_uuid(),
  counted_at timestamptz not null default now(),
  counted_by text not null
);

create table stock_count_lines (
  id                 uuid primary key default gen_random_uuid(),
  stock_count_id     uuid not null references stock_counts(id),
  book_id            uuid not null references books(id),
  expected_on_shelf  int not null,   -- what the system thought was on the shelf
  actual_on_shelf    int not null,   -- what the admin physically counted
  adjustment_applied int not null default 0  -- change made to stock_total, if any
);

-- ------------------------------------------------------------
-- admin_settings — a single row holding the admin PIN hash
-- ------------------------------------------------------------
-- The primary key is a boolean that must always be TRUE, which
-- makes it impossible to ever insert a second row.
create table admin_settings (
  id             boolean primary key default true check (id),
  admin_pin_hash text not null       -- bcrypt hash of a 6-digit PIN
);

-- ------------------------------------------------------------
-- books_with_availability — a live view that derives "on shelf"
-- ------------------------------------------------------------
-- security_invoker makes the view respect Row Level Security too.
create view books_with_availability
  with (security_invoker = true) as
select
  b.id,
  b.title,
  b.author,
  b.stock_total,
  b.created_at,
  b.stock_total - count(l.id) filter (where l.returned_at is null) as on_shelf
from books b
left join loans l on l.book_id = b.id
group by b.id;

-- ------------------------------------------------------------
-- Row Level Security — lock every table down
-- ------------------------------------------------------------
-- With RLS enabled and NO policies created, the public "anon" key
-- (the one that could end up in a browser) can read and write
-- NOTHING. All real access goes through Next.js server routes
-- using the service role key, which bypasses RLS. This is exactly
-- what the brief requires: the iPad never holds a privileged key.
alter table members           enable row level security;
alter table books             enable row level security;
alter table loans             enable row level security;
alter table email_log         enable row level security;
alter table stock_counts      enable row level security;
alter table stock_count_lines enable row level security;
alter table admin_settings    enable row level security;
