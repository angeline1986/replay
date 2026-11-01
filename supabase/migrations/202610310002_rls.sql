alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.videos enable row level security;
alter table public.user_video_state enable row level security;
alter table public.sync_runs enable row level security;

revoke all on table public.profiles, public.channels, public.videos,
  public.user_video_state, public.sync_runs from public, anon, authenticated, service_role;
grant usage on schema public to authenticated, service_role;
grant select on public.profiles, public.videos, public.sync_runs to authenticated;
grant select, delete on public.channels to authenticated;
grant insert (owner_id, youtube_channel_id, name, is_active)
  on public.channels to authenticated;
grant update (is_active) on public.channels to authenticated;
grant select, insert, update, delete on public.user_video_state to authenticated;

grant select on public.profiles to service_role;
grant select, insert, update on public.channels, public.videos to service_role;
grant select, insert, delete on public.sync_runs to service_role;

create policy profiles_owner_read on public.profiles for select to authenticated
using (user_id = (select auth.uid()));

create policy channels_owner_read on public.channels for select to authenticated
using (owner_id = (select auth.uid()));
create policy channels_owner_insert on public.channels for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy channels_owner_update on public.channels for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy channels_owner_delete on public.channels for delete to authenticated
using (owner_id = (select auth.uid()));

create policy videos_owner_read on public.videos for select to authenticated
using (exists (
  select 1 from public.channels c
  where c.id = videos.channel_id and c.owner_id = (select auth.uid())
));

create policy state_owner_read on public.user_video_state for select to authenticated
using (user_id = (select auth.uid()) and exists (
  select 1 from public.videos v join public.channels c on c.id = v.channel_id
  where v.id = user_video_state.video_id and c.owner_id = (select auth.uid())
));
create policy state_owner_insert on public.user_video_state for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.videos v join public.channels c on c.id = v.channel_id
  where v.id = user_video_state.video_id and c.owner_id = (select auth.uid())
));
create policy state_owner_update on public.user_video_state for update to authenticated
using (user_id = (select auth.uid()) and exists (
  select 1 from public.videos v join public.channels c on c.id = v.channel_id
  where v.id = user_video_state.video_id and c.owner_id = (select auth.uid())
))
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.videos v join public.channels c on c.id = v.channel_id
  where v.id = user_video_state.video_id and c.owner_id = (select auth.uid())
));
create policy state_owner_delete on public.user_video_state for delete to authenticated
using (user_id = (select auth.uid()) and exists (
  select 1 from public.videos v join public.channels c on c.id = v.channel_id
  where v.id = user_video_state.video_id and c.owner_id = (select auth.uid())
));

create policy sync_runs_owner_read on public.sync_runs for select to authenticated
using (exists (
  select 1 from public.channels c
  where c.id = sync_runs.channel_id and c.owner_id = (select auth.uid())
));
