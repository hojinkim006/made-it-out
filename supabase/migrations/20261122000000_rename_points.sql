-- Rename point fields in saved logs to match the app:
--   niche -> rarity, krillion -> firstBloom.
-- Safe to run more than once; rows already renamed are skipped.

update public.logs
set
  data = jsonb_set(
    data,
    '{points}',
    ((data -> 'points') - 'niche' - 'krillion')
      || jsonb_build_object(
        'rarity', coalesce(data -> 'points' -> 'rarity', data -> 'points' -> 'niche', '0'::jsonb),
        'firstBloom', coalesce(data -> 'points' -> 'firstBloom', data -> 'points' -> 'krillion', '0'::jsonb)
      )
  ),
  version = version + 1
where data -> 'points' ? 'niche' or data -> 'points' ? 'krillion';
