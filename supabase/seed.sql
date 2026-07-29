-- ============================================================
-- Christian Life Camps Bay Library — test data (Phase 1)
--
-- HOW TO RUN: in the Supabase SQL Editor, run this AFTER
-- schema.sql. Safe to run more than once (duplicates are skipped).
--
-- Test PINs (for kiosk testing in later phases):
--   Every test member's PIN is  1234
--   The admin PIN is            123456
-- Only bcrypt hashes are stored — crypt(..., gen_salt('bf', 10))
-- is PostgreSQL's built-in bcrypt.
--
-- The @example.com emails are deliberately fake so no real person
-- ever receives a test email. Before testing the email phases,
-- change one member's email to your own.
-- ============================================================

insert into members (full_name, email, pin_hash) values
  ('Grace Ndlovu',   'grace@example.com',   crypt('1234', gen_salt('bf', 10))),
  ('Pieter van Wyk', 'pieter@example.com',  crypt('1234', gen_salt('bf', 10))),
  ('Sarah Abrahams', 'sarah@example.com',   crypt('1234', gen_salt('bf', 10))),
  ('James Okafor',   'james@example.com',   crypt('1234', gen_salt('bf', 10))),
  ('Anke Botha',     'anke@example.com',    crypt('1234', gen_salt('bf', 10)))
on conflict (email) do nothing;

insert into books (title, author, stock_total)
select * from (values
  ('Mere Christianity',            'C.S. Lewis',        3),
  ('The Screwtape Letters',        'C.S. Lewis',        2),
  ('Knowing God',                  'J.I. Packer',       2),
  ('The Pursuit of God',           'A.W. Tozer',        1),
  ('Prayer',                       'Timothy Keller',    2),
  ('The Cross of Christ',          'John Stott',        1),
  ('Gentle and Lowly',             'Dane Ortlund',      3),
  ('The Hiding Place',             'Corrie ten Boom',   2)
) as v(title, author, stock_total)
where not exists (select 1 from books b where b.title = v.title);

insert into admin_settings (id, admin_pin_hash)
values (true, crypt('123456', gen_salt('bf', 10)))
on conflict (id) do nothing;
