-- ============================================================
-- Migration 004 — book barcodes (ISBN scanning)
--
-- HOW TO RUN: Supabase → SQL Editor → paste → Run.
-- Safe to run more than once.
--
-- Books get an optional barcode (the ISBN printed on the back
-- cover). Two copies of the same title share the same ISBN, which
-- fits the per-title stock model. Books without barcodes keep
-- working through search — scanning is a faster path, not a
-- requirement.
-- ============================================================

alter table books add column if not exists barcode text;

-- No two titles may claim the same barcode (blank is fine).
create unique index if not exists books_barcode_key
  on books (barcode) where barcode is not null;

-- Expose the barcode through the availability view (new columns
-- must be appended at the end — Postgres CREATE OR REPLACE rule).
create or replace view books_with_availability
  with (security_invoker = true) as
select
  b.id,
  b.title,
  b.author,
  b.stock_total,
  b.created_at,
  b.stock_total - count(l.id) filter (where l.returned_at is null) as on_shelf,
  b.is_active,
  b.barcode
from books b
left join loans l on l.book_id = b.id
group by b.id;
