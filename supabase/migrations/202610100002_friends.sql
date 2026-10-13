-- Username discovery, friend requests, and friend-only presence.
-- Apply after 202610100001_profiles_progression.sql.

alter table public.player_profiles
  add column if not exists username text,
  add column if not exists username_changed_at timestamptz,
  add column if not exists presence_visible boolean not null default true,
  add column if not exists presence_state text not null default 'offline'
    check (presence_state in ('offline', 'online', 'in_session')),
  add column if not exists last_seen_at timestamptz;

-- Seed existing display names into unique, URL-safe usernames.
with normalized as (
  select user_id,
    lower(trim(both '_' from regexp_replace(display_name, '[^a-zA-Z0-9]+', '_', 'g'))) as base
  from public.player_profiles
), ranked as (
  select user_id, base, row_number() over (partition by base order by user_id) as ordinal
  from normalized
)
update public.player_profiles p
set username = case
  when length(coalesce(r.base, '')) < 3 then 'controller_' || substr(p.user_id::text, 1, 6)
  when r.ordinal = 1 and length(r.base) <= 20 then r.base
  else left(r.base, 13) || '_' || substr(p.user_id::text, 1, 6)
end
from ranked r where r.user_id = p.user_id and p.username is null;

alter table public.player_profiles alter column username set not null;
create unique index if not exists player_profiles_username_lower_unique
  on public.player_profiles (lower(username));

create or replace function public.assign_initial_username()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  base_name text;
begin
  if new.username is null or btrim(new.username) = '' then
    base_name := lower(trim(both '_' from regexp_replace(new.display_name, '[^a-zA-Z0-9]+', '_', 'g')));
    if length(base_name) < 3 then base_name := 'controller'; end if;
    new.username := left(base_name, 17) || '_' || substr(new.user_id::text, 1, 6);
  end if;
  new.username := lower(new.username);
  return new;
end;
$$;
drop trigger if exists player_profiles_assign_username on public.player_profiles;
create trigger player_profiles_assign_username before insert on public.player_profiles
for each row execute function public.assign_initial_username();

-- Use the signup name as the initial username, adding a short suffix only on collision.
create or replace function public.create_player_profile()
returns trigger language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  requested_name text;
  requested_username text;
begin
  requested_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(requested_name) < 2 then requested_name := 'Controller ' || upper(substr(new.id::text, 1, 6)); end if;
  requested_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  if requested_username !~ '^[a-z0-9_]{3,20}$' then
    requested_username := lower(trim(both '_' from regexp_replace(requested_name, '[^a-zA-Z0-9]+', '_', 'g')));
  end if;
  if requested_username !~ '^[a-z0-9_]{3,20}$' or exists (select 1 from public.player_profiles p where lower(p.username) = requested_username) then
    requested_username := left(coalesce(nullif(requested_username, ''), 'controller'), 13) || '_' || substr(new.id::text, 1, 6);
  end if;
  insert into public.player_profiles (user_id, display_name, username)
  values (new.id, left(requested_name, 24), requested_username);
  insert into public.player_airport_unlocks (user_id, airport_id) values (new.id, 'RIX');
  return new;
end;
$$;

create table if not exists public.friend_requests (
  sender_id uuid not null references public.player_profiles(user_id) on delete cascade,
  recipient_id uuid not null references public.player_profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);
create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests (recipient_id, status, created_at desc);

create table if not exists public.player_blocks (
  blocker_id uuid not null references public.player_profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.player_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.friend_requests enable row level security;
alter table public.player_blocks enable row level security;
revoke all on public.friend_requests, public.player_blocks from anon, authenticated;

create or replace function public.change_player_username(new_username text)
returns table (username text, next_change_at timestamptz)
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  owner_id uuid := auth.uid();
  clean_name text := lower(btrim(new_username));
  changed_at timestamptz;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if clean_name !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username must be 3 to 20 characters using letters, numbers, or underscores';
  end if;
  select p.username_changed_at into changed_at from public.player_profiles p where p.user_id = owner_id for update;
  if changed_at is not null and changed_at > now() - interval '30 days' then
    raise exception 'Username can be changed again after %', changed_at + interval '30 days';
  end if;
  if exists (select 1 from public.player_profiles p where lower(p.username) = clean_name and p.user_id <> owner_id) then
    raise exception 'That username is already taken';
  end if;
  update public.player_profiles p set username = clean_name, username_changed_at = now(), updated_at = now()
    where p.user_id = owner_id;
  return query select clean_name, now() + interval '30 days';
end;
$$;

create or replace function public.find_player_by_username(username_query text)
returns table (user_id uuid, username text, level integer, rank text)
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare query_name text := lower(btrim(username_query)); viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Authentication required'; end if;
  if length(query_name) not between 3 and 20 then raise exception 'Enter a username (3 to 20 characters)'; end if;
  return query select p.user_id, p.username, public.player_level(p.xp), public.player_rank(public.player_level(p.xp))
    from public.player_profiles p
    where lower(p.username) = query_name and p.user_id <> viewer
      and not exists (select 1 from public.player_blocks b where (b.blocker_id = viewer and b.blocked_id = p.user_id) or (b.blocker_id = p.user_id and b.blocked_id = viewer));
end;
$$;

create or replace function public.send_friend_request(target_username text)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare sender uuid := auth.uid(); target uuid;
begin
  if sender is null then raise exception 'Authentication required'; end if;
  select p.user_id into target from public.player_profiles p where lower(p.username) = lower(btrim(target_username));
  if target is null then raise exception 'No player found with that username'; end if;
  if target = sender then raise exception 'You cannot add yourself'; end if;
  if exists (select 1 from public.player_blocks b where (b.blocker_id = sender and b.blocked_id = target) or (b.blocker_id = target and b.blocked_id = sender)) then
    raise exception 'Friend request unavailable';
  end if;
  if exists (select 1 from public.friend_requests f where f.status = 'accepted' and ((f.sender_id = sender and f.recipient_id = target) or (f.sender_id = target and f.recipient_id = sender))) then
    raise exception 'You are already friends';
  end if;
  if exists (select 1 from public.friend_requests f where f.sender_id = target and f.recipient_id = sender and f.status = 'pending') then
    update public.friend_requests set status = 'accepted', accepted_at = now() where sender_id = target and recipient_id = sender;
    return;
  end if;
  insert into public.friend_requests(sender_id, recipient_id) values (sender, target)
    on conflict (sender_id, recipient_id) do update set status = 'pending', created_at = now(), accepted_at = null
    where public.friend_requests.status <> 'accepted';
end;
$$;

create or replace function public.list_friend_connections()
returns table (user_id uuid, username text, level integer, rank text, relation text, presence text, last_seen_at timestamptz)
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
declare viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Authentication required'; end if;
  return query
  select p.user_id, p.username, public.player_level(p.xp), public.player_rank(public.player_level(p.xp)),
    'friend'::text,
    case when p.presence_visible and p.last_seen_at > now() - interval '2 minutes' then p.presence_state else 'offline' end,
    case when p.presence_visible and p.last_seen_at > now() - interval '2 minutes' then p.last_seen_at else null end
  from public.friend_requests f join public.player_profiles p on p.user_id = case when f.sender_id = viewer then f.recipient_id else f.sender_id end
  where f.status = 'accepted' and (f.sender_id = viewer or f.recipient_id = viewer)
  union all
  select p.user_id, p.username, public.player_level(p.xp), public.player_rank(public.player_level(p.xp)),
    case when f.recipient_id = viewer then 'incoming' else 'outgoing' end,
    'offline'::text, null::timestamptz
  from public.friend_requests f join public.player_profiles p on p.user_id = case when f.sender_id = viewer then f.recipient_id else f.sender_id end
  where f.status = 'pending' and (f.sender_id = viewer or f.recipient_id = viewer)
  order by 5, 2;
end;
$$;

create or replace function public.respond_friend_request(target_user_id uuid, accept_request boolean)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Authentication required'; end if;
  if accept_request then
    update public.friend_requests set status = 'accepted', accepted_at = now()
      where sender_id = target_user_id and recipient_id = viewer and status = 'pending';
    if not found then raise exception 'Friend request no longer exists'; end if;
  else
    delete from public.friend_requests where sender_id = target_user_id and recipient_id = viewer and status = 'pending';
  end if;
end;
$$;

create or replace function public.remove_friend_or_request(target_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Authentication required'; end if;
  delete from public.friend_requests where (sender_id = viewer and recipient_id = target_user_id) or (sender_id = target_user_id and recipient_id = viewer);
end;
$$;

create or replace function public.block_player(target_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Authentication required'; end if;
  if target_user_id = viewer then raise exception 'You cannot block yourself'; end if;
  insert into public.player_blocks(blocker_id, blocked_id) values (viewer, target_user_id) on conflict do nothing;
  delete from public.friend_requests where (sender_id = viewer and recipient_id = target_user_id) or (sender_id = target_user_id and recipient_id = viewer);
end;
$$;

create or replace function public.set_player_presence(show_presence boolean, current_activity text)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Authentication required'; end if;
  if current_activity not in ('online', 'in_session', 'offline') then raise exception 'Invalid presence state'; end if;
  update public.player_profiles set presence_visible = case when current_activity = 'offline' then presence_visible else show_presence end,
    presence_state = case when current_activity = 'offline' or not show_presence then 'offline' else current_activity end,
    last_seen_at = now(), updated_at = now() where user_id = viewer;
end;
$$;

do $$ declare fn text; begin
  foreach fn in array array[
    'change_player_username(text)', 'find_player_by_username(text)', 'send_friend_request(text)',
    'list_friend_connections()', 'respond_friend_request(uuid,boolean)', 'remove_friend_or_request(uuid)',
    'block_player(uuid)', 'set_player_presence(boolean,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;
