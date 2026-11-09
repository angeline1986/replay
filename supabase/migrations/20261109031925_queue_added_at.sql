alter table public.user_video_state add column queued_at timestamptz;
alter table public.saved_youtube_videos add column queued_at timestamptz;

-- Para registros antigos, updated_at é a melhor aproximação disponível.
update public.user_video_state set queued_at = updated_at where is_queued;
update public.saved_youtube_videos set queued_at = updated_at where is_queued;

create function public.set_queue_added_at() returns trigger
language plpgsql
security invoker
set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.queued_at := case when new.is_queued then coalesce(new.queued_at, now()) else null end;
  elsif not new.is_queued then
    new.queued_at := null;
  elsif not old.is_queued then
    new.queued_at := coalesce(new.queued_at, now());
  else
    new.queued_at := old.queued_at;
  end if;
  return new;
end;
$$;

create trigger user_video_state_queue_added_at before insert or update on public.user_video_state
for each row execute function public.set_queue_added_at();
create trigger saved_youtube_videos_queue_added_at before insert or update on public.saved_youtube_videos
for each row execute function public.set_queue_added_at();

revoke all on function public.set_queue_added_at() from public, anon, authenticated;
