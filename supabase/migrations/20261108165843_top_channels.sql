alter table public.channels add column is_top boolean not null default false;

grant update (is_top) on public.channels to authenticated;

update public.channels set is_top = true
where youtube_channel_id in (
  'UCH1eNIx62_JNxyeZcQOqz0w',
  'UCL-0IZ830ZczbgHEEOh-3hA',
  'UCDkaX7QmS7V3A2NNWvFHbXQ'
);
