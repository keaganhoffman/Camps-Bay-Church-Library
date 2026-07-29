-- ============================================================
-- Migration 002 — Phase 6 (admin area)
--
-- HOW TO RUN: Supabase → SQL Editor → paste this file → Run.
-- Safe to run more than once.
--
-- Adds the ability to deactivate a book (hide it from the kiosk
-- without deleting it or its loan history), mirroring what members
-- already had.
-- ============================================================

alter table books add column if not exists is_active boolean not null default true;

-- Recreate the availability view so it exposes is_active too.
-- (New columns must be added at the end — Postgres rule for
-- CREATE OR REPLACE VIEW.)
create or replace view books_with_availability
  with (security_invoker = true) as
select
  b.id,
  b.title,
  b.author,
  b.stock_total,
  b.created_at,
  b.stock_total - count(l.id) filter (where l.returned_at is null) as on_shelf,
  b.is_active
from books b
left join loans l on l.book_id = b.id
group by b.id;
