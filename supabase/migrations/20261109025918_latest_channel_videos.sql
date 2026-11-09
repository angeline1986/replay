-- Um vídeo recente por canal em uma chamada, usando videos_channel_published_idx.
create function public.latest_channel_videos()
returns setof public.videos
language sql
stable
security invoker
set search_path = ''
as $$
  select v.*
  from public.channels c
  join lateral (
    select v.* from public.videos v
    where v.channel_id = c.id
    order by v.published_at desc
    limit 1
  ) v on true
  where c.owner_id = (select auth.uid());
$$;

revoke all on function public.latest_channel_videos() from public, anon;
grant execute on function public.latest_channel_videos() to authenticated;
