-- =====================================================================
-- Row names on a shelf: "אחורי" / "קדמי" (the row of a shelf, masculine)
-- instead of "אחורית" / "קדמית". New fridges get the new names from the
-- app; this renames the rows of fridges that already exist, and the same
-- words inside the "last location" text of past tastings.
-- =====================================================================

update public.shelf_zones set label = 'אחורי' where label = 'אחורית';
update public.shelf_zones set label = 'קדמי'  where label = 'קדמית';

update public.tastings
   set last_location = replace(replace(last_location, ' · אחורית · ', ' · אחורי · '), ' · קדמית · ', ' · קדמי · ')
 where last_location ~ ' · (אחורית|קדמית)( · |$)';
update public.tastings
   set last_location = regexp_replace(regexp_replace(last_location, ' · אחורית$', ' · אחורי'), ' · קדמית$', ' · קדמי')
 where last_location ~ ' · (אחורית|קדמית)$';
