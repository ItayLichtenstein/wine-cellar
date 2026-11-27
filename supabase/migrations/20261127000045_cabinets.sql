-- =====================================================================
-- A cabinet (or a plain shelf unit) next to wine fridges: people who keep
-- wine in a cupboard still get shelves and places. Same shelves and zones
-- as a fridge; only the kind changes how it is drawn and named, and a
-- cabinet has no brand or model.
-- Existing fridges stay 'fridge'. RLS: the existing fridges policies
-- (members read, editors update) cover the new column.
-- =====================================================================

alter table public.fridges
  add column kind text not null default 'fridge'
  check (kind in ('fridge', 'cabinet'));
