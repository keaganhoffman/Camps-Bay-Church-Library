-- ============================================================
-- Migration 003 — lost books
--
-- HOW TO RUN: Supabase → SQL Editor → paste → Run.
-- Safe to run more than once.
--
-- A loan marked lost gets BOTH returned_at and lost_at set: setting
-- returned_at closes it everywhere (shelf counts, open-loan lists,
-- reminder emails) with no query changes, while lost_at records the
-- real reason for history and reports. The book's stock_total is
-- reduced by one at the same time, so shelf numbers stay truthful.
-- ============================================================

alter table loans add column if not exists lost_at timestamptz;
