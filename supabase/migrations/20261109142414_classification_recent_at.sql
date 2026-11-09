alter table public.user_video_state
  add column favorited_at timestamptz,
  add column deprioritized_at timestamptz;
alter table public.saved_youtube_videos add column deprioritized_at timestamptz;

-- Antes desta migração, a última alteração é a melhor aproximação disponível.
update public.user_video_state set
  favorited_at = case when is_favorite then updated_at else null end,
  deprioritized_at = case when is_deprioritized then updated_at else null end
where is_favorite or is_deprioritized;
update public.saved_youtube_videos
  set deprioritized_at = updated_at where is_deprioritized;

create function public.set_classification_dates() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.favorited_at := case when new.is_favorite then coalesce(new.favorited_at, now()) else null end;
    new.deprioritized_at := case when new.is_deprioritized then coalesce(new.deprioritized_at, now()) else null end;
  else
    new.favorited_at := case when not new.is_favorite then null
      when not old.is_favorite then coalesce(new.favorited_at, now()) else old.favorited_at end;
    new.deprioritized_at := case when not new.is_deprioritized then null
      when not old.is_deprioritized then coalesce(new.deprioritized_at, now()) else old.deprioritized_at end;
  end if;
  return new;
end;
$$;

create function public.set_saved_deprioritized_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.deprioritized_at := case when new.is_deprioritized then now() else null end;
  else
    new.deprioritized_at := case when not new.is_deprioritized then null
      when not old.is_deprioritized then now() else old.deprioritized_at end;
  end if;
  return new;
end;
$$;

create trigger user_video_state_classification_dates before insert or update
  on public.user_video_state for each row execute function public.set_classification_dates();
create trigger saved_youtube_videos_deprioritized_at before insert or update
  on public.saved_youtube_videos for each row execute function public.set_saved_deprioritized_at();

revoke all on function public.set_classification_dates() from public, anon, authenticated;
revoke all on function public.set_saved_deprioritized_at() from public, anon, authenticated;
