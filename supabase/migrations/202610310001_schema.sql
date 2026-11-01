create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  youtube_channel_id text not null check (youtube_channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  handle text,
  name text not null check (length(name) between 1 and 200),
  avatar_url text,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, youtube_channel_id)
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (length(title) between 1 and 500),
  url text not null,
  thumbnail_url text not null,
  published_at timestamptz not null,
  youtube_updated_at timestamptz,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, youtube_video_id)
);

create table public.user_video_state (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  is_favorite boolean not null default false,
  is_watched boolean not null default false,
  watched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, video_id),
  check ((is_watched and watched_at is not null) or (not is_watched and watched_at is null))
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('success', 'error')),
  item_count integer not null default 0 check (item_count >= 0),
  error_message text,
  duration_ms integer check (duration_ms >= 0)
);

create index channels_owner_active_idx on public.channels(owner_id, is_active);
create index videos_channel_published_idx on public.videos(channel_id, published_at desc);
create index videos_published_idx on public.videos(published_at desc);
create index sync_runs_channel_started_idx on public.sync_runs(channel_id, started_at desc);
create index user_video_state_user_favorite_idx on public.user_video_state(user_id, is_favorite);
create index user_video_state_video_id_idx on public.user_video_state(video_id);

create function public.set_updated_at() returns trigger language plpgsql
set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger channels_updated_at before update on public.channels
for each row execute function public.set_updated_at();
create trigger videos_updated_at before update on public.videos
for each row execute function public.set_updated_at();
create trigger user_video_state_updated_at before update on public.user_video_state
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.videos enable row level security;
alter table public.user_video_state enable row level security;
alter table public.sync_runs enable row level security;
