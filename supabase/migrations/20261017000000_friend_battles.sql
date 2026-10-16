-- Dream Team Dex: live battles between friends.
-- Invites (only between accepted friends, at most 5 open per player, expire after 2 minutes), the battle's random
-- seed and rules, and results that both players must confirm. A confirmed win pays 60 PokéPoints, at most 3 paid
-- wins per friend per (UTC) day; the app adds the points when report_battle says so.
-- The match itself runs over a private Realtime broadcast channel `battle:<match_id>` that only the two players
-- can join (policies on realtime.messages below). Re-runnable, like the first migration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables
create table if not exists public.battle_invites (
  match_id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  seed integer not null default (floor(random()*2147483647))::integer,
  rules jsonb not null default '{"format":3,"bag":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user <> to_user),
  constraint battle_rules_ok check (rules ?& array['format', 'bag'] and (rules->>'format') in ('1', '3', '6') and jsonb_typeof(rules->'bag') = 'boolean' and octet_length(rules::text) <= 200)
);
create index if not exists battle_invites_to on public.battle_invites (to_user, status, created_at);
create index if not exists battle_invites_from on public.battle_invites (from_user, status, created_at);

-- each player's report of how a round ended (round 0 is the first battle, then rematches)
create table if not exists public.battle_reports (
  match_id uuid not null references public.battle_invites (match_id) on delete cascade,
  round smallint not null check (round between 0 and 20),
  reporter uuid not null references auth.users (id) on delete cascade,
  winner uuid not null,
  turns integer not null check (turns between 0 and 1000),
  created_at timestamptz not null default now(),
  primary key (match_id, round, reporter)
);

-- the friend-battle record: one row per round both players agreed on
create table if not exists public.battle_results (
  match_id uuid not null references public.battle_invites (match_id) on delete cascade,
  round smallint not null,
  winner uuid not null references auth.users (id) on delete cascade,
  loser uuid not null references auth.users (id) on delete cascade,
  turns integer not null,
  paid boolean not null default false,
  ended_at timestamptz not null default now(),
  primary key (match_id, round)
);
create index if not exists battle_results_winner on public.battle_results (winner, loser, ended_at);

-- ---------------------------------------------------------------- privacy: only the two players see a match
alter table public.battle_invites enable row level security;
alter table public.battle_reports enable row level security;
alter table public.battle_results enable row level security;
drop policy if exists battle_invites_read on public.battle_invites;
create policy battle_invites_read on public.battle_invites for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());
drop policy if exists battle_reports_read on public.battle_reports;
create policy battle_reports_read on public.battle_reports for select to authenticated using (reporter = auth.uid());
drop policy if exists battle_results_read on public.battle_results;
create policy battle_results_read on public.battle_results for select to authenticated using (winner = auth.uid() or loser = auth.uid());
grant select on public.battle_invites, public.battle_reports, public.battle_results to authenticated;   -- changes only through the functions below
revoke all on public.battle_invites, public.battle_reports, public.battle_results from anon;

-- ---------------------------------------------------------------- functions
-- invites older than 2 minutes that nobody answered are expired
create or replace function public.expire_battle_invites() returns void
language sql security definer set search_path = public as $$
  update public.battle_invites set status = 'expired', updated_at = now() where status = 'pending' and created_at < now() - interval '2 minutes';
$$;

-- challenge a friend: {status:'sent', match_id, seed, rules} | not_friends | too_many | bad_rules
create or replace function public.invite_battle(p_to uuid, p_rules jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.battle_invites; open_n int;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_to is null or p_to = me or not public.are_friends(me, p_to) or public.is_blocked(me, p_to) then return jsonb_build_object('status', 'not_friends'); end if;
  if coalesce(p_rules->>'format', '') not in ('1', '3', '6') or jsonb_typeof(p_rules->'bag') is distinct from 'boolean' then return jsonb_build_object('status', 'bad_rules'); end if;
  perform public.expire_battle_invites();
  -- a new challenge to the same friend replaces the old one
  update public.battle_invites set status = 'cancelled', updated_at = now() where from_user = me and to_user = p_to and status = 'pending';
  select count(*) into open_n from public.battle_invites where from_user = me and status = 'pending';
  if open_n >= 5 then return jsonb_build_object('status', 'too_many'); end if;
  begin
    insert into public.battle_invites (from_user, to_user, rules)
      values (me, p_to, jsonb_build_object('format', (p_rules->>'format')::int, 'bag', coalesce((p_rules->>'bag')::boolean, true)))
      returning * into r;
  exception when others then return jsonb_build_object('status', 'bad_rules');
  end;
  return jsonb_build_object('status', 'sent', 'match_id', r.match_id, 'seed', r.seed, 'rules', r.rules);
end $$;

-- answer a challenge: {status:'accepted', match_id, seed, rules, from_user} | declined | expired | not_found
create or replace function public.respond_battle(p_match uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.battle_invites;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  perform public.expire_battle_invites();
  select * into r from public.battle_invites where match_id = p_match and to_user = me for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if r.status <> 'pending' then return jsonb_build_object('status', r.status); end if;
  if p_accept and not public.are_friends(me, r.from_user) then p_accept := false; end if;
  update public.battle_invites set status = case when p_accept then 'accepted' else 'declined' end, updated_at = now() where match_id = p_match returning * into r;
  return jsonb_build_object('status', r.status, 'match_id', r.match_id, 'seed', r.seed, 'rules', r.rules, 'from_user', r.from_user);
end $$;

-- withdraw a challenge, or leave an accepted match before it ends (either player)
create or replace function public.cancel_battle(p_match uuid) returns void
language sql security definer set search_path = public as $$
  update public.battle_invites set status = 'cancelled', updated_at = now()
  where match_id = p_match and (from_user = auth.uid() or to_user = auth.uid()) and status in ('pending', 'accepted');
$$;

-- challenges waiting for me (with who sent them), newest first
create or replace function public.battle_inbox() returns table (match_id uuid, from_user uuid, username text, rules jsonb, created_at timestamptz)
language sql security definer set search_path = public as $$
  select i.match_id, i.from_user, p.username, i.rules, i.created_at from public.battle_invites i join public.profiles p on p.id = i.from_user
  where i.to_user = auth.uid() and i.status = 'pending' and i.created_at >= now() - interval '2 minutes' and not public.is_blocked(i.from_user, i.to_user)
  order by i.created_at desc limit 5;
$$;

-- report how a round ended. Both players report; when they agree the result is recorded:
-- {status:'waiting'} | {status:'confirmed', winner, paid} | {status:'mismatch'} | not_found
create or replace function public.report_battle(p_match uuid, p_round int, p_winner uuid, p_turns int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r public.battle_invites; other public.battle_reports; res public.battle_results; v_loser uuid; paid_n int;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select * into r from public.battle_invites where match_id = p_match and (from_user = me or to_user = me);
  if not found or r.status not in ('accepted', 'cancelled') then return jsonb_build_object('status', 'not_found'); end if;
  if p_winner not in (r.from_user, r.to_user) or p_round not between 0 and 20 or p_turns not between 0 and 1000 then return jsonb_build_object('status', 'not_found'); end if;
  insert into public.battle_reports (match_id, round, reporter, winner, turns) values (p_match, p_round, me, p_winner, p_turns)
    on conflict (match_id, round, reporter) do nothing;
  select * into res from public.battle_results where match_id = p_match and round = p_round;
  if found then return jsonb_build_object('status', 'confirmed', 'winner', res.winner, 'paid', res.paid); end if;
  select * into other from public.battle_reports where match_id = p_match and round = p_round and reporter <> me;
  if not found then return jsonb_build_object('status', 'waiting'); end if;
  if other.winner <> p_winner then return jsonb_build_object('status', 'mismatch'); end if;
  v_loser := case when p_winner = r.from_user then r.to_user else r.from_user end;
  perform pg_advisory_xact_lock(hashtext(p_winner::text || v_loser::text));
  select count(*) into paid_n from public.battle_results
    where winner = p_winner and loser = v_loser and paid and ended_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  insert into public.battle_results (match_id, round, winner, loser, turns, paid) values (p_match, p_round, p_winner, v_loser, greatest(p_turns, other.turns), paid_n < 3)
    on conflict (match_id, round) do nothing returning * into res;
  if res.match_id is null then select * into res from public.battle_results where match_id = p_match and round = p_round; end if;
  return jsonb_build_object('status', 'confirmed', 'winner', res.winner, 'paid', res.paid);
end $$;

-- my friend-battle record: wins and losses (all time)
create or replace function public.battle_record() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('wins', count(*) filter (where winner = auth.uid()), 'losses', count(*) filter (where loser = auth.uid()))
  from public.battle_results where winner = auth.uid() or loser = auth.uid();
$$;

revoke execute on function public.expire_battle_invites(), public.invite_battle(uuid, jsonb), public.respond_battle(uuid, boolean),
  public.cancel_battle(uuid), public.battle_inbox(), public.report_battle(uuid, int, uuid, int), public.battle_record() from public, anon;
grant execute on function public.invite_battle(uuid, jsonb), public.respond_battle(uuid, boolean), public.cancel_battle(uuid),
  public.battle_inbox(), public.report_battle(uuid, int, uuid, int), public.battle_record() to authenticated;

-- ---------------------------------------------------------------- Realtime
-- invites arrive live (postgres_changes respects the read policy above)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'battle_invites') then
    execute 'alter publication supabase_realtime add table public.battle_invites';
  end if;
end $$;

-- the private match channel battle:<match_id>: only its two players can read or send, and only while it's on
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'realtime') and exists (select 1 from pg_tables where schemaname = 'realtime' and tablename = 'messages') then
    execute 'drop policy if exists battle_channel_read on realtime.messages';
    execute 'drop policy if exists battle_channel_send on realtime.messages';
    execute $p$create policy battle_channel_read on realtime.messages for select to authenticated using (
      realtime.topic() like 'battle:%' and exists (select 1 from public.battle_invites i where i.match_id::text = substr(realtime.topic(), 8)
        and i.status = 'accepted' and (i.from_user = auth.uid() or i.to_user = auth.uid())))$p$;
    execute $p$create policy battle_channel_send on realtime.messages for insert to authenticated with check (
      realtime.topic() like 'battle:%' and exists (select 1 from public.battle_invites i where i.match_id::text = substr(realtime.topic(), 8)
        and i.status = 'accepted' and (i.from_user = auth.uid() or i.to_user = auth.uid())))$p$;
  end if;
end $$;
