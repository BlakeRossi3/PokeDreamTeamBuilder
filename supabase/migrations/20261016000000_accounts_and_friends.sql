-- Dream Team Dex: accounts, cloud saves and friends.
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run: every object is created
-- "if not exists" or replaced. See docs/supabase-setup.md.
--
-- Who can see what (row-level security):
--   saves, save_versions ........ only the owner
--   profiles .................... the owner, and players they have a pending or accepted friendship with
--   public_profile .............. the owner and accepted friends
--   friendships ................. both players (a block is only visible to the player who blocked)
--   home_likes .................. the player who liked and the Home's owner
-- Everything that changes another player's data goes through the security-definer functions at the bottom,
-- which check friendship, blocks and rate limits.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  friend_code text not null unique check (friend_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  icon text check (char_length(icon) <= 40),
  title text check (char_length(title) <= 60),
  username_changed_at timestamptz not null default now(),
  last_active timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));

-- ---------------------------------------------------------------- saves (one per account, versioned)
create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  version bigint not null default 1,
  device text check (char_length(device) <= 80),
  updated_at timestamptz not null default now(),
  constraint saves_size check (octet_length(data::text) <= 1048576)   -- 1 MB cap
);
-- every earlier version is kept (the newest 20 per player), so an upload never silently loses progress
create table if not exists public.save_versions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  version bigint not null,
  data jsonb not null,
  device text,
  saved_at timestamptz not null default now()
);
create index if not exists save_versions_user on public.save_versions (user_id, saved_at desc);

-- ---------------------------------------------------------------- friends
create table if not exists public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee on public.friendships (addressee);

-- what friends can see: trainer card, the showcased team (members, cosmetics, items, moves) and its scene,
-- the Home layout and residents. Written by the owner on every sync.
create table if not exists public.public_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  card jsonb not null default '{}'::jsonb,
  showcase jsonb not null default '{}'::jsonb,
  home jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint public_profile_size check (octet_length(card::text) + octet_length(showcase::text) + octet_length(home::text) <= 262144)
);

-- one Like per visitor per Home per (UTC) day
create table if not exists public.home_likes (
  liker uuid not null references auth.users (id) on delete cascade,
  owner uuid not null references auth.users (id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  primary key (liker, owner, day),
  check (liker <> owner)
);
create index if not exists home_likes_owner on public.home_likes (owner, created_at);

-- ---------------------------------------------------------------- helpers
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships f
                 where f.status = 'accepted' and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)));
$$;

create or replace function public.is_blocked(a uuid, b uuid) returns boolean   -- either player blocked the other
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships f
                 where f.status = 'blocked' and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)));
$$;

-- usernames: 3–16 letters, numbers or underscores, and nothing offensive (checked with common look-alikes undone)
create or replace function public.username_ok(name text) returns boolean
language plpgsql immutable as $$
declare
  n text := translate(lower(coalesce(name, '')), '013457_', 'oieast');
  bad text[] := array['fuck','fuk','shit','bitch','cunt','dick','cock','pussy','nigg','nigga','fag','whore','slut','rape',
                      'nazi','hitler','porn','penis','vagina','boob','tits','bastard','retard','kkk','pedo','molest','sexy','horny',
                      'jizz','wank','twat','spic','chink','kike','dyke','tranny','cum','anus','arse','asshole','damn','hell'];
  w text;
begin
  if name is null or name !~ '^[A-Za-z0-9_]{3,16}$' then return false; end if;
  foreach w in array bad loop
    if w in ('cum','anus','arse','hell','damn') then
      if n = w or n like w || '%' and length(n) <= length(w) + 2 then return false; end if;   -- short words: only on their own
    elsif position(w in n) > 0 then return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.new_friend_code() returns text
language plpgsql volatile as $$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..8 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from public.profiles where friend_code = c);
  end loop;
  return c;
end $$;

-- keep save history: the version being replaced goes to save_versions; only the newest 20 are kept
create or replace function public.saves_keep_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.save_versions (user_id, version, data, device, saved_at) values (old.user_id, old.version, old.data, old.device, old.updated_at);
  delete from public.save_versions v where v.user_id = old.user_id and v.id not in
    (select id from public.save_versions where user_id = old.user_id order by saved_at desc, id desc limit 20);
  return new;
end $$;
drop trigger if exists saves_history on public.saves;
create trigger saves_history before update on public.saves for each row execute function public.saves_keep_history();

-- ---------------------------------------------------------------- row-level security
alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.save_versions enable row level security;
alter table public.friendships enable row level security;
alter table public.public_profile enable row level security;
alter table public.home_likes enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or exists (select 1 from public.friendships f where f.status in ('pending', 'accepted')
    and ((f.requester = auth.uid() and f.addressee = profiles.id) or (f.addressee = auth.uid() and f.requester = profiles.id))));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- players may only change their icon, title and last-active time directly; usernames go through claim_username()
revoke update on public.profiles from authenticated, anon;
grant select on public.profiles to authenticated;
grant update (icon, title, last_active) on public.profiles to authenticated;

drop policy if exists saves_own on public.saves;
create policy saves_own on public.saves for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.saves to authenticated;

drop policy if exists save_versions_own on public.save_versions;
create policy save_versions_own on public.save_versions for select to authenticated using (user_id = auth.uid());
grant select on public.save_versions to authenticated;

drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select to authenticated using (
  requester = auth.uid() or (addressee = auth.uid() and status <> 'blocked'));
grant select on public.friendships to authenticated;   -- changes only through the functions below

drop policy if exists public_profile_read on public.public_profile;
create policy public_profile_read on public.public_profile for select to authenticated using (
  user_id = auth.uid() or (public.are_friends(auth.uid(), user_id) and not public.is_blocked(auth.uid(), user_id)));
drop policy if exists public_profile_write on public.public_profile;
create policy public_profile_write on public.public_profile for insert to authenticated with check (user_id = auth.uid());
drop policy if exists public_profile_update on public.public_profile;
create policy public_profile_update on public.public_profile for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.public_profile to authenticated;

drop policy if exists home_likes_read on public.home_likes;
create policy home_likes_read on public.home_likes for select to authenticated using (liker = auth.uid() or owner = auth.uid());
grant select on public.home_likes to authenticated;   -- new Likes only through like_home()

revoke all on public.profiles, public.saves, public.save_versions, public.friendships, public.public_profile, public.home_likes from anon;

-- ---------------------------------------------------------------- functions the app calls (supabase.rpc)

-- create my profile, or change my username (once a week). Returns the profile.
create or replace function public.claim_username(p_name text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.profiles;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not public.username_ok(p_name) then raise exception 'username_not_allowed'; end if;
  if exists (select 1 from public.profiles where lower(username) = lower(p_name) and id <> me) then raise exception 'username_taken'; end if;
  select * into p from public.profiles where id = me;
  if not found then
    insert into public.profiles (id, username, friend_code) values (me, p_name, public.new_friend_code()) returning * into p;
  elsif lower(p.username) <> lower(p_name) or p.username <> p_name then
    if p.username_changed_at > now() - interval '7 days' and lower(p.username) <> lower(p_name) then raise exception 'username_rate_limited'; end if;
    update public.profiles set username = p_name, username_changed_at = case when lower(username) <> lower(p_name) then now() else username_changed_at end
      where id = me returning * into p;
  end if;
  return p;
end $$;

-- upload my save. p_base is the version this device last synced (0 for a first upload). If the cloud has moved on
-- since then nothing is written and ok=false comes back with the cloud's version, so the app can ask the player.
create or replace function public.put_save(p_data jsonb, p_base bigint, p_device text) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare me uuid := auth.uid(); v bigint;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if coalesce(p_base, 0) = 0 then
    insert into public.saves (user_id, data, version, device) values (me, p_data, 1, left(p_device, 80))
      on conflict (user_id) do nothing returning version into v;
  else
    update public.saves set data = p_data, version = version + 1, device = left(p_device, 80), updated_at = now()
      where user_id = me and version = p_base returning version into v;
  end if;
  if v is null then return jsonb_build_object('ok', false, 'version', (select version from public.saves where user_id = me)); end if;
  return jsonb_build_object('ok', true, 'version', v);
end $$;

-- send a friend request by friend code (with or without the dash) or exact username.
-- At most 20 new requests a day. If they already asked me, this accepts instead.
create or replace function public.add_friend(p_query text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); q text := trim(coalesce(p_query, '')); other uuid; f public.friendships;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'no_profile'; end if;
  select id into other from public.profiles where friend_code = upper(replace(replace(q, '-', ''), ' ', '')) or lower(username) = lower(q) limit 1;
  if other is null then return jsonb_build_object('status', 'not_found'); end if;
  if other = me then return jsonb_build_object('status', 'self'); end if;
  if public.is_blocked(me, other) then return jsonb_build_object('status', 'not_found'); end if;   -- a block hides you completely
  select * into f from public.friendships where (requester = me and addressee = other) or (requester = other and addressee = me);
  if found then
    if f.status = 'accepted' then return jsonb_build_object('status', 'already_friends'); end if;
    if f.requester = me then return jsonb_build_object('status', 'already_sent'); end if;
    update public.friendships set status = 'accepted', updated_at = now() where requester = other and addressee = me;
    return jsonb_build_object('status', 'accepted');
  end if;
  if (select count(*) from public.friendships where requester = me and created_at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  insert into public.friendships (requester, addressee, status) values (me, other, 'pending');
  return jsonb_build_object('status', 'sent');
end $$;

-- accept or decline a request someone sent me
create or replace function public.respond_friend(p_other uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_accept then
    update public.friendships set status = 'accepted', updated_at = now() where requester = p_other and addressee = me and status = 'pending';
  else
    delete from public.friendships where requester = p_other and addressee = me and status = 'pending';
  end if;
end $$;

-- remove a friend, or cancel a request I sent
create or replace function public.remove_friend(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  delete from public.friendships where status <> 'blocked'
    and ((requester = me and addressee = p_other) or (requester = p_other and addressee = me));
end $$;

-- block: ends any friendship or request, and the other player can no longer find or see me
create or replace function public.block_user(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_other = me then return; end if;
  delete from public.friendships where (requester = me and addressee = p_other) or (requester = p_other and addressee = me and status <> 'blocked');
  if not exists (select 1 from public.friendships where requester = p_other and addressee = me) then
    insert into public.friendships (requester, addressee, status) values (me, p_other, 'blocked');
  end if;
end $$;

create or replace function public.unblock_user(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships where requester = auth.uid() and addressee = p_other and status = 'blocked';
end $$;

-- my friends, requests and blocks, with what the app shows for each (no emails, no real names)
create or replace function public.friend_list() returns table (
  user_id uuid, username text, icon text, title text, last_active timestamptz, status text, outgoing boolean, since timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.icon, p.title, case when f.status = 'accepted' then p.last_active end,
         f.status, f.requester = auth.uid(), f.updated_at
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where (f.requester = auth.uid()) or (f.addressee = auth.uid() and f.status <> 'blocked')
  order by f.status, lower(p.username);
$$;

-- leave a Like on a friend's Home: once per day per Home. Both players get 20 PokéPoints (the app adds them;
-- the Home's owner collects theirs with likes_received()).
create or replace function public.like_home(p_owner uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if not public.are_friends(me, p_owner) then return jsonb_build_object('status', 'not_friends'); end if;
  insert into public.home_likes (liker, owner) values (me, p_owner) on conflict do nothing;
  if not found then return jsonb_build_object('status', 'already_liked'); end if;
  return jsonb_build_object('status', 'liked');
end $$;

-- Likes my Home received after a time (the app remembers when it last collected)
create or replace function public.likes_received(p_since timestamptz) returns table (liker text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(p.username, 'A friend'), l.created_at from public.home_likes l left join public.profiles p on p.id = l.liker
  where l.owner = auth.uid() and l.created_at > coalesce(p_since, 'epoch'::timestamptz) order by l.created_at;
$$;

-- everything the cloud stores about me, for "Download my data"
create or replace function public.my_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'save', (select to_jsonb(s) from public.saves s where s.user_id = auth.uid()),
    'save_versions', (select coalesce(jsonb_agg(jsonb_build_object('version', v.version, 'saved_at', v.saved_at, 'device', v.device, 'data', v.data) order by v.saved_at desc), '[]'::jsonb) from public.save_versions v where v.user_id = auth.uid()),
    'public_profile', (select to_jsonb(pp) from public.public_profile pp where pp.user_id = auth.uid()),
    'friends', (select coalesce(jsonb_agg(to_jsonb(fl)), '[]'::jsonb) from public.friend_list() fl),
    'likes_given', (select coalesce(jsonb_agg(jsonb_build_object('day', l.day)), '[]'::jsonb) from public.home_likes l where l.liker = auth.uid()),
    'likes_received', (select count(*) from public.home_likes l where l.owner = auth.uid()));
$$;

-- delete my account and every row about me (all tables cascade from auth.users)
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- only signed-in players may call these
revoke execute on function public.claim_username(text), public.put_save(jsonb, bigint, text), public.add_friend(text),
  public.respond_friend(uuid, boolean), public.remove_friend(uuid), public.block_user(uuid), public.unblock_user(uuid),
  public.friend_list(), public.like_home(uuid), public.likes_received(timestamptz), public.my_data(), public.delete_my_account(),
  public.are_friends(uuid, uuid), public.is_blocked(uuid, uuid), public.new_friend_code(), public.saves_keep_history()
  from public, anon;
grant execute on function public.claim_username(text), public.put_save(jsonb, bigint, text), public.add_friend(text),
  public.respond_friend(uuid, boolean), public.remove_friend(uuid), public.block_user(uuid), public.unblock_user(uuid),
  public.friend_list(), public.like_home(uuid), public.likes_received(timestamptz), public.my_data(), public.delete_my_account(),
  public.are_friends(uuid, uuid), public.is_blocked(uuid, uuid), public.username_ok(text)
  to authenticated;
