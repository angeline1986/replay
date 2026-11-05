create table public.tracked_stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  seed_video_id uuid references public.videos(id) on delete set null,
  name text not null check (length(name) between 2 and 200),
  canonical_key text not null check (length(canonical_key) between 3 and 200),
  aliases text[] not null default '{}' check (cardinality(aliases) <= 10),
  is_followed boolean not null default true,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, canonical_key)
);

create table public.story_matches (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.tracked_stories(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  score smallint not null check (score between 0 and 100),
  reason text not null check (length(reason) between 1 and 200),
  position_kind text check (position_kind in ('part', 'episode', 'chapter')),
  position_first integer check (position_first > 0),
  position_last integer check (position_last > 0),
  season integer check (season > 0),
  detected_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (story_id, video_id),
  check ((status = 'pending') = (decided_at is null)),
  check ((position_kind is null and position_first is null and position_last is null)
    or (position_kind is not null and position_first is not null and
      position_last is not null and position_last >= position_first))
);

create index tracked_stories_owner_followed_idx on public.tracked_stories(owner_id, is_followed);
create index tracked_stories_seed_video_idx on public.tracked_stories(seed_video_id);
create index story_matches_story_status_idx on public.story_matches(story_id, status, detected_at desc);
create index story_matches_video_idx on public.story_matches(video_id);
create index story_matches_pending_idx on public.story_matches(story_id, detected_at desc)
  where status = 'pending';

create function public.story_seed_guard() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'Proprietário da história é imutável' using errcode = '23514';
    end if;
  end if;
  if new.seed_video_id is null then
    if tg_op = 'INSERT' then
      raise exception 'Vídeo inicial obrigatório' using errcode = '23514';
    end if;
  elsif not exists (
    select 1 from public.videos v join public.channels c on c.id = v.channel_id
    where v.id = new.seed_video_id and c.owner_id = new.owner_id
  ) then
    raise exception 'Vídeo inicial pertence a outro proprietário' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.name is distinct from old.name or new.aliases is distinct from old.aliases or
        new.canonical_key is distinct from old.canonical_key then
      new.last_scanned_at = null;
    end if;
  end if;
  return new;
end;
$$;

create function public.story_match_guard() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.story_id is distinct from old.story_id or new.video_id is distinct from old.video_id then
      raise exception 'Vínculo história/vídeo é imutável' using errcode = '23514';
    end if;
  end if;
  if not exists (
    select 1 from public.tracked_stories s
    join public.videos v on v.id = new.video_id
    join public.channels c on c.id = v.channel_id
    where s.id = new.story_id and s.owner_id = c.owner_id
  ) then
    raise exception 'História e vídeo têm proprietários diferentes' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tracked_stories_seed_guard before insert or update on public.tracked_stories
for each row execute function public.story_seed_guard();
create trigger tracked_stories_updated_at before update on public.tracked_stories
for each row execute function public.set_updated_at();
create trigger story_matches_owner_guard before insert or update on public.story_matches
for each row execute function public.story_match_guard();

alter table public.tracked_stories enable row level security;
alter table public.story_matches enable row level security;

create policy tracked_stories_read on public.tracked_stories for select to authenticated
using (owner_id = (select auth.uid()));
create policy tracked_stories_insert on public.tracked_stories for insert to authenticated
with check (owner_id = (select auth.uid()) and seed_video_id is not null and exists (
  select 1 from public.videos v join public.channels c on c.id = v.channel_id
  where v.id = seed_video_id and c.owner_id = (select auth.uid())
));
create policy tracked_stories_update on public.tracked_stories for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()) and (seed_video_id is null or exists (
  select 1 from public.videos v join public.channels c on c.id = v.channel_id
  where v.id = seed_video_id and c.owner_id = (select auth.uid())
)));

create policy story_matches_read on public.story_matches for select to authenticated
using (exists (
  select 1 from public.tracked_stories s
  join public.videos v on v.id = story_matches.video_id
  join public.channels c on c.id = v.channel_id
  where s.id = story_matches.story_id and s.owner_id = (select auth.uid())
    and c.owner_id = (select auth.uid())
));
create policy story_matches_decide on public.story_matches for update to authenticated
using (status = 'pending' and exists (
  select 1 from public.tracked_stories s
  join public.videos v on v.id = story_matches.video_id
  join public.channels c on c.id = v.channel_id
  where s.id = story_matches.story_id and s.owner_id = (select auth.uid())
    and c.owner_id = (select auth.uid())
))
with check (status in ('confirmed', 'rejected') and exists (
  select 1 from public.tracked_stories s
  join public.videos v on v.id = story_matches.video_id
  join public.channels c on c.id = v.channel_id
  where s.id = story_matches.story_id and s.owner_id = (select auth.uid())
    and c.owner_id = (select auth.uid())
));

revoke all on public.tracked_stories, public.story_matches
  from public, anon, authenticated, service_role;
grant select on public.tracked_stories, public.story_matches to authenticated;
grant insert (owner_id, seed_video_id, name, canonical_key, aliases)
  on public.tracked_stories to authenticated;
grant update (name, canonical_key, aliases, is_followed)
  on public.tracked_stories to authenticated;
grant update (status, decided_at) on public.story_matches to authenticated;
grant select, insert, update on public.tracked_stories, public.story_matches to service_role;
