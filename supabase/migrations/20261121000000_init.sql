-- made it out: initial schema.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste this file -> Run.
-- Plans, past plans and the feed live as JSON on each group row so web/src/lib/plans.ts works unchanged.
-- `version` columns let the app detect two people saving the same group or log at once.

-------------------------------------------------------------------------------
-- Profiles
-------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null check (length(trim(display_name)) > 0),
  region text not null,
  school text,
  created_at timestamptz not null default now()
);

-- Private to the owner: other users can read profiles, but never these columns.
create table public.private_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  phone text unique,            -- digits only
  school_email text
);

-- Create both rows when someone signs up. Fields come from signUp({ options: { data } }).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name, region, school)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    trim(new.raw_user_meta_data ->> 'display_name'),
    coalesce(new.raw_user_meta_data ->> 'region', 'Boston, MA'),
    nullif(new.raw_user_meta_data ->> 'school', '')
  );
  insert into public.private_profiles (id, phone, school_email)
  values (
    new.id,
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'), ''),
    nullif(new.raw_user_meta_data ->> 'school_email', '')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Which of username / phone are already taken, checked before sign-up.
create function public.signup_conflicts(p_username text, p_phone text) returns text[]
language sql security definer stable set search_path = '' as $$
  select array_remove(array[
    case when exists (select 1 from public.profiles where username = lower(trim(p_username))) then 'username' end,
    case when exists (
      select 1 from public.private_profiles
      where phone is not null and right(phone, 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
    ) then 'phone' end
  ], null)
$$;

-------------------------------------------------------------------------------
-- Log in with username or phone.
-- Returns the account email only when the password is right, so it can't be
-- used to look up someone's email. Five failures per identifier per 15 minutes.
-------------------------------------------------------------------------------

create table public.login_attempts (
  identifier text not null,
  at timestamptz not null default now()
);
create index on public.login_attempts (identifier, at);

create function public.login_email(p_identifier text, p_password text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_id text := regexp_replace(lower(trim(p_identifier)), '^@', '');
  v_digits text := regexp_replace(p_identifier, '\D', '', 'g');
  v_email text;
  v_hash text;
begin
  if (select count(*) from public.login_attempts
      where identifier = v_id and at > now() - interval '15 minutes') >= 5 then
    raise exception 'too_many_attempts';
  end if;

  select u.email, u.encrypted_password into v_email, v_hash
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.private_profiles pp on pp.id = u.id
  where p.username = v_id
     or (length(v_digits) >= 10 and right(pp.phone, 10) = right(v_digits, 10))
  limit 1;

  if v_hash is not null and v_hash = extensions.crypt(p_password, v_hash) then
    return v_email;
  end if;

  insert into public.login_attempts (identifier) values (v_id);
  delete from public.login_attempts where at < now() - interval '1 day';
  return null;
end $$;

-------------------------------------------------------------------------------
-- Friends (always mutual: adding someone writes both directions)
-------------------------------------------------------------------------------

create table public.friendships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create function public.add_friend(p_username text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_them public.profiles;
begin
  if v_me is null then raise exception 'not_signed_in'; end if;
  select * into v_them from public.profiles
  where username = regexp_replace(lower(trim(p_username)), '^@', '');
  if not found then raise exception 'no_user'; end if;
  if v_them.id = v_me then raise exception 'self'; end if;
  if exists (select 1 from public.friendships where user_id = v_me and friend_id = v_them.id) then
    raise exception 'already_friends';
  end if;
  insert into public.friendships (user_id, friend_id)
  values (v_me, v_them.id), (v_them.id, v_me)
  on conflict do nothing;
  return v_them;
end $$;

-------------------------------------------------------------------------------
-- Groups
-------------------------------------------------------------------------------

create table public.groups (
  id uuid primary key,
  name text not null,
  region text not null,
  hood text not null default '',
  school text,
  created_at date not null default current_date,
  plan jsonb,
  past_plans jsonb not null default '[]',
  feed jsonb not null default '[]',
  version int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.group_members (user_id);

-- Used by every policy below. Security definer so policies don't recurse.
create function public.is_member(p_group uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.group_members where group_id = p_group and user_id = auth.uid()
  )
$$;

-- Create a group with the caller and some of their friends (2-8 people).
-- Safe to call twice with the same id.
create function public.create_group(
  p_id uuid, p_name text, p_region text, p_hood text, p_school text, p_created_at date, p_member_ids uuid[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_ids uuid[] := array(select distinct x from unnest(array_append(p_member_ids, auth.uid())) x);
begin
  if v_me is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.groups where id = p_id) then
    if public.is_member(p_id) then return; end if;
    raise exception 'group_exists';
  end if;
  if cardinality(v_ids) not between 2 and 8 then raise exception 'bad_group_size'; end if;
  if exists (
    select 1 from unnest(v_ids) x
    where x <> v_me and not exists (select 1 from public.friendships where user_id = v_me and friend_id = x)
  ) then raise exception 'not_friends'; end if;

  insert into public.groups (id, name, region, hood, school, created_at)
  values (p_id, trim(p_name), p_region, coalesce(p_hood, ''), nullif(p_school, ''), coalesce(p_created_at, current_date));
  insert into public.group_members (group_id, user_id) select p_id, x from unnest(v_ids) x;
end $$;

-- Add some of the caller's friends to a group the caller is in (max 8 members).
create function public.add_group_members(p_group uuid, p_user_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if not public.is_member(p_group) then raise exception 'not_member'; end if;
  if exists (
    select 1 from unnest(p_user_ids) x
    where not exists (select 1 from public.friendships where user_id = v_me and friend_id = x)
  ) then raise exception 'not_friends'; end if;
  insert into public.group_members (group_id, user_id)
  select p_group, x from unnest(p_user_ids) x
  on conflict do nothing;
  if (select count(*) from public.group_members where group_id = p_group) > 8 then
    raise exception 'group_full';
  end if;
end $$;

-------------------------------------------------------------------------------
-- Activity logs
-------------------------------------------------------------------------------

create table public.logs (
  id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  date date not null,
  cat text not null,
  labels text[] not null default '{}',
  points_total int not null default 0,
  data jsonb not null,            -- the full ActivityLog from web/src/lib/types.ts
  version int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.logs (group_id);

-------------------------------------------------------------------------------
-- Leaderboards and the First Bloom bonus need every group's score, but not its
-- plans, photos or comments. This returns only those summary fields.
-------------------------------------------------------------------------------

create function public.board() returns json
language sql security definer stable set search_path = '' as $$
  select json_build_object(
    'groups', coalesce((
      select json_agg(json_build_object(
        'id', g.id, 'name', g.name, 'region', g.region, 'hood', g.hood, 'school', g.school,
        'createdAt', g.created_at,
        'memberIds', (select coalesce(json_agg(m.user_id), '[]'::json) from public.group_members m where m.group_id = g.id)
      )) from public.groups g), '[]'::json),
    'logs', coalesce((
      select json_agg(json_build_object(
        'id', l.id, 'groupId', l.group_id, 'authorId', l.author_id, 'date', l.date,
        'cat', l.cat, 'labels', l.labels, 'pts', l.points_total
      )) from public.logs l), '[]'::json)
  )
$$;

-------------------------------------------------------------------------------
-- Row level security
-------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.login_attempts enable row level security;  -- no policies: only functions touch it
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.logs enable row level security;

create policy "signed-in users read profiles" on public.profiles
  for select to authenticated using (true);
create policy "edit own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "read own private profile" on public.private_profiles
  for select to authenticated using (id = auth.uid());
create policy "edit own private profile" on public.private_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "read own friendships" on public.friendships
  for select to authenticated using (user_id = auth.uid());

create policy "members read group" on public.groups
  for select to authenticated using (public.is_member(id));
create policy "members edit group" on public.groups
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

create policy "members see members" on public.group_members
  for select to authenticated using (public.is_member(group_id));

create policy "members read logs" on public.logs
  for select to authenticated using (public.is_member(group_id));
create policy "members add logs" on public.logs
  for insert to authenticated with check (public.is_member(group_id) and author_id = auth.uid());
create policy "members edit logs" on public.logs
  for update to authenticated using (public.is_member(group_id)) with check (public.is_member(group_id));

-- Table and column privileges (RLS still applies on top).
revoke all on public.profiles, public.private_profiles, public.login_attempts, public.friendships,
  public.groups, public.group_members, public.logs from anon, authenticated;
grant select on public.profiles, public.private_profiles, public.friendships, public.groups,
  public.group_members, public.logs to authenticated;
grant update (display_name, region, school) on public.profiles to authenticated;
grant update (phone, school_email) on public.private_profiles to authenticated;
grant update (name, hood, plan, past_plans, feed, version, updated_at) on public.groups to authenticated;
grant insert on public.logs to authenticated;
grant update (data, points_total, cat, labels, date, version) on public.logs to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.handle_new_user() to supabase_auth_admin;
grant execute on function public.signup_conflicts(text, text) to anon, authenticated;
grant execute on function public.login_email(text, text) to anon, authenticated;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.create_group(uuid, text, text, text, text, date, uuid[]) to authenticated;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;
grant execute on function public.board() to authenticated;

-------------------------------------------------------------------------------
-- Realtime: push row changes to every member's open app
-------------------------------------------------------------------------------

alter publication supabase_realtime add table public.groups, public.logs, public.group_members, public.friendships;

-------------------------------------------------------------------------------
-- Photo and video storage.
-- Public bucket with unguessable paths: {group id}/{log id}/{media id}.{ext}.
-- Only group members can upload into their group's folder.
-------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do nothing;

create policy "members upload group media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );
