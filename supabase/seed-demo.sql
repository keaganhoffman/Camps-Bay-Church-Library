-- ============================================================
-- DEMO DATA — a lived-in library for client demos
--
-- HOW TO RUN: Supabase → SQL Editor → paste this whole file → Run.
--
-- ⚠ WIPES all existing members, books, loans, counts and email
--   history first. Do not run after real data has been loaded.
--
-- What it creates:
--   30 members (all PIN 1234, all fake @example.com emails)
--   40 books
--   ~220 returned loans spread over the past 11 months
--   6 open loans due later, 4 overdue, 2 marked lost
--   1 past stock count with 2 discrepancies
-- ============================================================

-- ---- make sure migration 003 is applied --------------------
-- (safe if it already is)
alter table loans add column if not exists lost_at timestamptz;

-- ---- wipe ---------------------------------------------------
delete from email_log;
delete from stock_count_lines;
delete from stock_counts;
delete from loans;
delete from members;
delete from books;

-- ---- members (PIN 1234) ------------------------------------
insert into members (full_name, email, pin_hash)
select full_name,
       lower(replace(full_name, ' ', '.')) || '@example.com',
       crypt('1234', gen_salt('bf', 10))
from (values
  ('Grace Ndlovu'), ('Pieter van Wyk'), ('Sarah Abrahams'), ('James Okafor'),
  ('Anke Botha'), ('Thandi Mokoena'), ('David Williams'), ('Lisa Petersen'),
  ('Sipho Dlamini'), ('Megan Daniels'), ('Johan Kruger'), ('Nadia Isaacs'),
  ('Michael Adams'), ('Zanele Khumalo'), ('Chris Fourie'), ('Robyn Jacobs'),
  ('Lungile Mthembu'), ('Werner Steyn'), ('Chloe Arendse'), ('Tumi Molefe'),
  ('Brandon Smith'), ('Yolanda Cloete'), ('Kagiso Sithole'), ('Elmarie du Plessis'),
  ('Ashwin Pillay'), ('Bianca Meyer'), ('Neo Mahlangu'), ('Danielle Solomons'),
  ('Ruan Nel'), ('Precious Zulu')
) as v(full_name);

-- Two real people with real inboxes (PIN 1234 like everyone else) —
-- used to show live emails during demos. Everyone else stays on fake
-- @example.com addresses on purpose.
insert into members (full_name, email, pin_hash) values
  ('Wayne Sandeman', 'wayne@christianlifecb.com', crypt('1234', gen_salt('bf', 10))),
  ('Keagan Hoffman', 'keagan.hoffman@gmail.com', crypt('1234', gen_salt('bf', 10)))
on conflict (email) do nothing;

-- ---- books --------------------------------------------------
insert into books (title, author, stock_total) values
  ('Mere Christianity', 'C.S. Lewis', 3),
  ('The Screwtape Letters', 'C.S. Lewis', 2),
  ('The Problem of Pain', 'C.S. Lewis', 1),
  ('The Great Divorce', 'C.S. Lewis', 2),
  ('Knowing God', 'J.I. Packer', 2),
  ('The Pursuit of God', 'A.W. Tozer', 1),
  ('The Attributes of God', 'A.W. Tozer', 1),
  ('Prayer', 'Timothy Keller', 2),
  ('The Reason for God', 'Timothy Keller', 2),
  ('The Prodigal God', 'Timothy Keller', 2),
  ('Counterfeit Gods', 'Timothy Keller', 1),
  ('The Cross of Christ', 'John Stott', 1),
  ('Gentle and Lowly', 'Dane Ortlund', 3),
  ('The Hiding Place', 'Corrie ten Boom', 2),
  ('Desiring God', 'John Piper', 2),
  ('Don''t Waste Your Life', 'John Piper', 1),
  ('Crazy Love', 'Francis Chan', 2),
  ('Radical', 'David Platt', 1),
  ('Celebration of Discipline', 'Richard Foster', 2),
  ('The Cost of Discipleship', 'Dietrich Bonhoeffer', 2),
  ('Life Together', 'Dietrich Bonhoeffer', 1),
  ('My Utmost for His Highest', 'Oswald Chambers', 2),
  ('The Purpose Driven Life', 'Rick Warren', 3),
  ('Boundaries', 'Henry Cloud', 2),
  ('The Five Love Languages', 'Gary Chapman', 3),
  ('Wild at Heart', 'John Eldredge', 1),
  ('Captivating', 'John & Stasi Eldredge', 1),
  ('The Practice of the Presence of God', 'Brother Lawrence', 1),
  ('The Pilgrim''s Progress', 'John Bunyan', 2),
  ('Confessions', 'Augustine', 1),
  ('Orthodoxy', 'G.K. Chesterton', 1),
  ('The Ragamuffin Gospel', 'Brennan Manning', 1),
  ('What''s So Amazing About Grace?', 'Philip Yancey', 2),
  ('Where Is God When It Hurts', 'Philip Yancey', 1),
  ('The Jesus I Never Knew', 'Philip Yancey', 1),
  ('Too Busy Not to Pray', 'Bill Hybels', 1),
  ('Spiritual Disciplines Handbook', 'Adele Calhoun', 1),
  ('Humility', 'Andrew Murray', 1),
  ('Abide in Christ', 'Andrew Murray', 1),
  ('With Christ in the School of Prayer', 'Andrew Murray', 1);

-- ---- ~220 returned loans over the past 11 months -----------
-- Random member + random book each time; returned 2–27 days after
-- borrowing. All safely in the past, so they only affect history.
with mem as (select array_agg(id) as ids from members),
     bks as (select array_agg(id) as ids from books)
insert into loans (member_id, book_id, borrowed_at, due_at, returned_at)
select
  mem.ids[1 + floor(random() * array_length(mem.ids, 1))::int],
  bks.ids[1 + floor(random() * array_length(bks.ids, 1))::int],
  t.borrowed_at,
  t.borrowed_at + interval '30 days',
  t.borrowed_at + ((2 + floor(random() * 26))::int) * interval '1 day'
from mem, bks,
     lateral (
       select now() - ((35 + floor(random() * 330))::int) * interval '1 day' as borrowed_at
       from generate_series(1, 220)
     ) as t;

-- ---- current loans: 6 due later, 4 overdue, 2 lost ---------
-- 12 distinct books so shelf counts stay sensible.
with mem as (select array_agg(id) as ids from members),
     pick as (
       select id, row_number() over () as rn
       from (select id from books order by random() limit 12) x
     ),
     plan as (
       select id as book_id, rn,
         case
           when rn <= 6  then now() - ((1 + floor(random() * 25))::int) * interval '1 day'
           when rn <= 10 then now() - interval '30 days'
                              - ((2 + floor(random() * 11))::int) * interval '1 day'
           else now() - interval '75 days'
         end as borrowed_at
       from pick
     )
insert into loans (member_id, book_id, borrowed_at, due_at, returned_at, lost_at)
select
  mem.ids[1 + floor(random() * array_length(mem.ids, 1))::int],
  plan.book_id,
  plan.borrowed_at,
  plan.borrowed_at + interval '30 days',
  case when plan.rn > 10 then now() - interval '10 days' end,
  case when plan.rn > 10 then now() - interval '10 days' end
from plan, mem;

-- ---- one past stock count (3 weeks ago), 2 discrepancies ---
with c as (
  insert into stock_counts (counted_at, counted_by)
  values (now() - interval '21 days', 'Margaret')
  returning id
)
insert into stock_count_lines
  (stock_count_id, book_id, expected_on_shelf, actual_on_shelf, adjustment_applied)
select c.id, v.id, v.on_shelf, v.on_shelf, 0
from c, books_with_availability v;

update stock_count_lines
set actual_on_shelf = expected_on_shelf - 1, adjustment_applied = -1
where id in (select id from stock_count_lines order by random() limit 2);

-- ---- restore the admin PIN in case it was ever changed -----
insert into admin_settings (id, admin_pin_hash)
values (true, crypt('123456', gen_salt('bf', 10)))
on conflict (id) do update set admin_pin_hash = excluded.admin_pin_hash;
