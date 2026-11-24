-- =====================================================================
-- update_wine_details(): the "more details" part of the add/edit forms,
-- in one transaction. Each field lands on its own level (ADR 0002):
--   wine    : grape, country, region, kosher, shape
--   vintage : alcohol, peak years, window source, critic scores
-- Critic scores are REPLACED by the given list ([{ "critic": "...", "score": 94 }]).
-- Runs as the caller, so RLS decides what may be changed.
-- =====================================================================

create function public.update_wine_details(
  p_wine_id       uuid,
  p_vintage_id    uuid,
  p_grape         text,
  p_country       text,
  p_region        text,
  p_kosher        public.kosher_status,
  p_shape         public.bottle_shape,
  p_alcohol       numeric,
  p_peak_from     int,
  p_peak_to       int,
  p_window_source public.window_source,
  p_critics       jsonb default '[]'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cellar uuid;
  v_item   jsonb;
begin
  -- The vintage must belong to this wine (and be visible to the caller).
  select cellar_id into v_cellar
    from public.wine_vintages
   where id = p_vintage_id and wine_id = p_wine_id;
  if v_cellar is null then
    raise exception 'vintage not found' using errcode = 'no_data_found';
  end if;
  if jsonb_typeof(p_critics) is distinct from 'array' or jsonb_array_length(p_critics) > 20 then
    raise exception 'critics must be a list of up to 20' using errcode = 'check_violation';
  end if;

  update public.wines
     set grape   = nullif(trim(p_grape), ''),
         country = nullif(trim(p_country), ''),
         region  = nullif(trim(p_region), ''),
         kosher  = coalesce(p_kosher, 'unknown'),
         shape   = coalesce(p_shape, 'standard')
   where id = p_wine_id;

  update public.wine_vintages
     set alcohol = p_alcohol, peak_from = p_peak_from, peak_to = p_peak_to, window_source = p_window_source
   where id = p_vintage_id;

  delete from public.critic_scores where vintage_id = p_vintage_id;
  for v_item in select * from jsonb_array_elements(p_critics) loop
    insert into public.critic_scores (vintage_id, cellar_id, critic, score)
    values (p_vintage_id, v_cellar, trim(v_item ->> 'critic'), (v_item ->> 'score')::int);
  end loop;
end;
$$;

revoke execute on function public.update_wine_details(uuid, uuid, text, text, text, public.kosher_status, public.bottle_shape, numeric, int, int, public.window_source, jsonb) from public, anon;
grant  execute on function public.update_wine_details(uuid, uuid, text, text, text, public.kosher_status, public.bottle_shape, numeric, int, int, public.window_source, jsonb) to authenticated;
