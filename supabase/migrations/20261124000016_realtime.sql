-- =====================================================================
-- Real-time sync (stage 2): changes made by one household member show up
-- for the others without a reload.
--
-- Supabase Realtime streams row changes of the tables in this publication.
-- For INSERT/UPDATE it checks each subscriber against the table's RLS
-- select policy, so a user only hears about their own cellar's rows.
-- (DELETE events carry only the deleted row's id, never its data.)
-- The app uses the events only as a "something changed" signal and then
-- reloads the page data through the normal, RLS-protected queries.
-- =====================================================================

alter publication supabase_realtime add table
  public.bottles,
  public.bottle_prices,
  public.wines,
  public.wine_vintages,
  public.critic_scores,
  public.ratings,
  public.tastings,
  public.fridges,
  public.shelves,
  public.shelf_zones,
  public.cellar_members;
