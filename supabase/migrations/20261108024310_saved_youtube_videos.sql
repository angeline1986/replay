create table public.saved_youtube_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  youtube_channel_id text not null check (youtube_channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  channel_name text not null check (length(channel_name) between 1 and 200),
  title text not null check (length(title) between 1 and 500),
  thumbnail_url text not null,
  published_at timestamptz not null,
  is_queued boolean not null default false,
  is_deprioritized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, youtube_video_id)
);

create index saved_youtube_videos_user_queue_idx on public.saved_youtube_videos
  (user_id, published_at desc) where is_queued;
create index saved_youtube_videos_user_deprioritized_idx on public.saved_youtube_videos
  (user_id, published_at desc) where is_deprioritized;

create trigger saved_youtube_videos_updated_at before update on public.saved_youtube_videos
for each row execute function public.set_updated_at();

alter table public.saved_youtube_videos enable row level security;
revoke all on public.saved_youtube_videos from public, anon, authenticated;
grant select, insert, update, delete on public.saved_youtube_videos to authenticated;

create policy saved_youtube_videos_select on public.saved_youtube_videos
  for select to authenticated using (user_id = (select auth.uid()));
create policy saved_youtube_videos_insert on public.saved_youtube_videos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy saved_youtube_videos_update on public.saved_youtube_videos
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy saved_youtube_videos_delete on public.saved_youtube_videos
  for delete to authenticated using (user_id = (select auth.uid()));
