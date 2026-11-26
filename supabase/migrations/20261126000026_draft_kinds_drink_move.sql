-- =====================================================================
-- Two more kinds of AI suggestion (spec: "הצעת שתייה, הצעת הזזה"):
-- 'drink' – mark a bottle as drunk; 'move' – move a bottle to a new place.
-- Same rules as adding bottles: the AI only writes a pending draft, and a
-- person approves it on the site, one by one.
-- =====================================================================
alter type public.draft_kind add value if not exists 'drink';
alter type public.draft_kind add value if not exists 'move';
