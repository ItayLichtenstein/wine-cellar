-- =====================================================================
-- "First steps" card for new users (spec: "צעדים ראשונים").
-- Shown once: null = never shown; 'shown' = shown once and ignored, so it
-- never comes back; 'using' = the user tapped a step, so it stays until
-- they close it or finish; 'closed' = gone for good.
-- Everyone who signed up before this card existed starts at 'closed', so
-- existing users never get a new popup.
-- =====================================================================
alter table public.profiles
  add column first_steps text
  check (first_steps in ('shown', 'using', 'closed'));

update public.profiles set first_steps = 'closed';
