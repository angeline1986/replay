create temporary table videos_test (
  id bigint generated always as identity primary key,
  channel_id uuid not null,
  youtube_video_id text not null,
  title text not null,
  discovered_at timestamptz not null default now(),
  unique (channel_id, youtube_video_id)
);

insert into videos_test (channel_id, youtube_video_id, title)
values ('00000000-0000-0000-0000-000000000001', 'abcdefghijk', 'Primeiro título')
on conflict (channel_id, youtube_video_id) do update set title = excluded.title;

create temporary table first_save as select id, discovered_at from videos_test;

insert into videos_test (channel_id, youtube_video_id, title)
values ('00000000-0000-0000-0000-000000000001', 'abcdefghijk', 'Título atualizado')
on conflict (channel_id, youtube_video_id) do update set title = excluded.title;

do $$
begin
  if (select count(*) from videos_test) <> 1 then
    raise exception 'upsert duplicou o vídeo';
  end if;
  if not exists (
    select 1 from videos_test v cross join first_save f
    where v.id = f.id and v.discovered_at = f.discovered_at
      and v.title = 'Título atualizado'
  ) then
    raise exception 'upsert não preservou identidade ou não atualizou título';
  end if;
end;
$$;
