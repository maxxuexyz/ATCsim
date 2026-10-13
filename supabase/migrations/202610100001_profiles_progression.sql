-- Online profile and progression foundation for Approach Control.
-- Client apps may read profile/catalog data; economy writes stay behind
-- trusted server functions so browser clients cannot edit balances directly.

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  xp bigint not null default 0 check (xp >= 0),
  miles bigint not null default 0 check (miles >= 0),
  active_seconds bigint not null default 0 check (active_seconds >= 0),
  tower_handoffs integer not null default 0 check (tower_handoffs >= 0),
  center_handoffs integer not null default 0 check (center_handoffs >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.airport_catalog (
  airport_id text primary key,
  display_name text not null,
  miles_cost bigint not null default 0 check (miles_cost >= 0),
  available boolean not null default false
);

-- Riga is the only airport in the catalog until its content is complete.
insert into public.airport_catalog (airport_id, display_name, miles_cost, available)
values ('RIX', 'Riga', 0, true)
on conflict (airport_id) do update
set display_name = excluded.display_name,
    miles_cost = excluded.miles_cost,
    available = excluded.available;

create table if not exists public.player_airport_unlocks (
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  airport_id text not null references public.airport_catalog(airport_id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, airport_id)
);

create table if not exists public.progression_ledger (
  ledger_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  source_key text not null,
  event_type text not null check (event_type in (
    'active_play', 'tower_handoff', 'center_handoff', 'team_bonus', 'airport_purchase', 'trial_import'
  )),
  miles_delta bigint not null default 0,
  xp_delta bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);

create table if not exists public.session_reward_claims (
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  session_id uuid not null,
  is_trial_import boolean not null default false,
  active_seconds integer not null check (active_seconds between 0 and 7200),
  tower_handoffs integer not null check (tower_handoffs between 0 and 50),
  center_handoffs integer not null check (center_handoffs between 0 and 50),
  miles_earned bigint not null check (miles_earned >= 0),
  xp_earned bigint not null check (xp_earned >= 0),
  claimed_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

create table if not exists public.trial_progress_imports (
  user_id uuid primary key references public.player_profiles(user_id) on delete cascade,
  session_id uuid not null,
  imported_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create or replace function public.player_level(total_xp bigint)
returns integer
language sql immutable strict
as $$
  -- Level thresholds: 0, 100, 300, 600, 1000... (100 * triangular number).
  select greatest(1, floor((sqrt(1 + (8.0 * greatest(total_xp, 0) / 100)) - 1) / 2)::integer + 1);
$$;

create or replace function public.player_rank(level_number integer)
returns text
language sql immutable strict
as $$
  select case
    when level_number >= 20 then 'Supervising Controller'
    when level_number >= 12 then 'Senior Controller'
    when level_number >= 7 then 'Approach Controller'
    when level_number >= 3 then 'Junior Controller'
    else 'Trainee'
  end;
$$;

create or replace function public.create_player_profile()
returns trigger
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  requested_name text;
begin
  requested_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(requested_name) < 2 then
    requested_name := 'Controller ' || upper(substr(new.id::text, 1, 6));
  end if;

  insert into public.player_profiles (user_id, display_name)
  values (new.id, left(requested_name, 24));

  insert into public.player_airport_unlocks (user_id, airport_id)
  values (new.id, 'RIX');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_player_profile on auth.users;
create trigger on_auth_user_created_player_profile
  after insert on auth.users
  for each row execute function public.create_player_profile();

create or replace function public.set_player_display_name(new_name text)
returns void
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  clean_name text := btrim(new_name);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(clean_name) not between 2 and 24 then
    raise exception 'Display name must be 2 to 24 characters';
  end if;
  update public.player_profiles
     set display_name = clean_name, updated_at = now()
   where user_id = auth.uid();
end;
$$;

-- An airport purchase is atomic: charge once, unlock once, and ledger once.
create or replace function public.purchase_airport(target_airport_id text)
returns table (new_miles bigint, airport_id text)
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  buyer_id uuid := auth.uid();
  price bigint;
  balance bigint;
begin
  if buyer_id is null then
    raise exception 'Authentication required';
  end if;

  select c.miles_cost into price
    from public.airport_catalog c
   where c.airport_id = target_airport_id and c.available;
  if not found then
    raise exception 'Airport is not available';
  end if;

  if exists (
    select 1 from public.player_airport_unlocks u
     where u.user_id = buyer_id and u.airport_id = target_airport_id
  ) then
    select p.miles into balance from public.player_profiles p where p.user_id = buyer_id;
    return query select balance, target_airport_id;
    return;
  end if;

  update public.player_profiles p
     set miles = p.miles - price, updated_at = now()
   where p.user_id = buyer_id and p.miles >= price
   returning p.miles into balance;
  if not found then
    raise exception 'Not enough Miles';
  end if;

  insert into public.player_airport_unlocks (user_id, airport_id)
  values (buyer_id, target_airport_id);

  insert into public.progression_ledger (user_id, source_key, event_type, miles_delta)
  values (buyer_id, 'airport:' || target_airport_id, 'airport_purchase', -price);

  return query select balance, target_airport_id;
end;
$$;

-- Single-player rewards are credited once per session. The client can submit
-- a claim, but cannot directly edit balances or write ledger rows. Amounts are
-- capped here; multiplayer rewards will be issued from server-validated role
-- events when the shared-session service is added.
create or replace function public.claim_singleplayer_session(
  claimed_session_id uuid,
  claimed_active_seconds integer,
  claimed_tower_handoffs integer,
  claimed_center_handoffs integer,
  importing_trial boolean default false
)
returns table (credited_miles bigint, credited_xp bigint, current_miles bigint, current_xp bigint)
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  claimant uuid := auth.uid();
  active_minutes integer;
  earned_miles bigint;
  earned_xp bigint;
begin
  if claimant is null then
    raise exception 'Authentication required';
  end if;
  if claimed_session_id is null
     or claimed_active_seconds not between 0 and (case when importing_trial then 1200 else 7200 end)
     or claimed_tower_handoffs not between 0 and 50
     or claimed_center_handoffs not between 0 and 50 then
    raise exception 'Invalid session reward claim';
  end if;
  if importing_trial then
    insert into public.trial_progress_imports (user_id, session_id)
    values (claimant, claimed_session_id);
  end if;

  active_minutes := claimed_active_seconds / 60;
  earned_miles := active_minutes * 10
    + (claimed_tower_handoffs + claimed_center_handoffs) * 150;
  earned_xp := active_minutes * 10
    + (claimed_tower_handoffs + claimed_center_handoffs) * 100;

  insert into public.session_reward_claims (
    user_id, session_id, is_trial_import, active_seconds,
    tower_handoffs, center_handoffs, miles_earned, xp_earned
  ) values (
    claimant, claimed_session_id, importing_trial, claimed_active_seconds,
    claimed_tower_handoffs, claimed_center_handoffs, earned_miles, earned_xp
  );

  update public.player_profiles p
     set miles = p.miles + earned_miles,
         xp = p.xp + earned_xp,
         active_seconds = p.active_seconds + claimed_active_seconds,
         tower_handoffs = p.tower_handoffs + claimed_tower_handoffs,
         center_handoffs = p.center_handoffs + claimed_center_handoffs,
         updated_at = now()
   where p.user_id = claimant;

  if active_minutes > 0 then
    insert into public.progression_ledger (user_id, source_key, event_type, miles_delta, xp_delta)
    values (claimant, 'session:' || claimed_session_id || ':active', 'active_play', active_minutes * 10, active_minutes * 10);
  end if;
  if claimed_tower_handoffs > 0 then
    insert into public.progression_ledger (user_id, source_key, event_type, miles_delta, xp_delta)
    values (claimant, 'session:' || claimed_session_id || ':tower', 'tower_handoff', claimed_tower_handoffs * 150, claimed_tower_handoffs * 100);
  end if;
  if claimed_center_handoffs > 0 then
    insert into public.progression_ledger (user_id, source_key, event_type, miles_delta, xp_delta)
    values (claimant, 'session:' || claimed_session_id || ':center', 'center_handoff', claimed_center_handoffs * 150, claimed_center_handoffs * 100);
  end if;

  select p.miles, p.xp into current_miles, current_xp
    from public.player_profiles p where p.user_id = claimant;
  credited_miles := earned_miles;
  credited_xp := earned_xp;
  return next;
end;
$$;

alter table public.player_profiles enable row level security;
alter table public.airport_catalog enable row level security;
alter table public.player_airport_unlocks enable row level security;
alter table public.progression_ledger enable row level security;
alter table public.session_reward_claims enable row level security;
alter table public.trial_progress_imports enable row level security;

drop policy if exists player_profiles_read_own on public.player_profiles;
create policy player_profiles_read_own on public.player_profiles
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists airport_catalog_read_available on public.airport_catalog;
create policy airport_catalog_read_available on public.airport_catalog
  for select to anon, authenticated using (available);

drop policy if exists player_airport_unlocks_read_own on public.player_airport_unlocks;
create policy player_airport_unlocks_read_own on public.player_airport_unlocks
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists progression_ledger_read_own on public.progression_ledger;
create policy progression_ledger_read_own on public.progression_ledger
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists session_reward_claims_read_own on public.session_reward_claims;
create policy session_reward_claims_read_own on public.session_reward_claims
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists trial_progress_imports_read_own on public.trial_progress_imports;
create policy trial_progress_imports_read_own on public.trial_progress_imports
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.player_profiles from anon, authenticated;
grant select on public.player_profiles to authenticated;
revoke all on public.airport_catalog from anon, authenticated;
grant select on public.airport_catalog to anon, authenticated;
grant select on public.airport_catalog to anon;
revoke all on public.player_airport_unlocks from anon, authenticated;
grant select on public.player_airport_unlocks to authenticated;
revoke all on public.progression_ledger from anon, authenticated;
grant select on public.progression_ledger to authenticated;
revoke all on public.session_reward_claims from anon, authenticated;
grant select on public.session_reward_claims to authenticated;
revoke all on public.trial_progress_imports from anon, authenticated;
grant select on public.trial_progress_imports to authenticated;

revoke all on function public.set_player_display_name(text) from public, anon;
grant execute on function public.set_player_display_name(text) to authenticated;
revoke all on function public.purchase_airport(text) from public, anon;
grant execute on function public.purchase_airport(text) to authenticated;
revoke all on function public.claim_singleplayer_session(uuid, integer, integer, integer, boolean) from public, anon;
grant execute on function public.claim_singleplayer_session(uuid, integer, integer, integer, boolean) to authenticated;

grant execute on function public.player_level(bigint) to anon, authenticated;
grant execute on function public.player_rank(integer) to anon, authenticated;
