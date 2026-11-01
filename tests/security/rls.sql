-- Execute somente em projeto de desenvolvimento, com dois auth.users existentes:
-- psql "$DATABASE_URL" -v user_a=UUID -v user_b=UUID -f tests/security/rls.sql
\set ON_ERROR_STOP on
begin;

insert into public.profiles(user_id) values (:'user_a'::uuid), (:'user_b'::uuid)
on conflict (user_id) do nothing;
insert into public.channels(owner_id, youtube_channel_id, name)
values (:'user_a'::uuid, 'UCaaaaaaaaaaaaaaaaaaaaaa', 'Teste A')
on conflict (owner_id, youtube_channel_id) do update set name = excluded.name;
insert into public.channels(owner_id, youtube_channel_id, name)
values (:'user_b'::uuid, 'UCbbbbbbbbbbbbbbbbbbbbbb', 'Teste B')
on conflict (owner_id, youtube_channel_id) do update set name = excluded.name;
insert into public.videos(channel_id, youtube_video_id, title, url, thumbnail_url, published_at)
select id, 'abcdefghijk', 'Vídeo de A', 'https://www.youtube.com/watch?v=abcdefghijk',
  'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg', now()
from public.channels where owner_id = :'user_a'::uuid and youtube_channel_id = 'UCaaaaaaaaaaaaaaaaaaaaaa'
on conflict (channel_id, youtube_video_id) do nothing;
insert into public.videos(channel_id, youtube_video_id, title, url, thumbnail_url, published_at)
select id, 'lmnopqrstuv', 'Vídeo de B', 'https://www.youtube.com/watch?v=lmnopqrstuv',
  'https://i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg', now()
from public.channels where owner_id = :'user_b'::uuid and youtube_channel_id = 'UCbbbbbbbbbbbbbbbbbbbbbb'
on conflict (channel_id, youtube_video_id) do nothing;

select set_config('test.video_b', id::text, true) from public.videos
where youtube_video_id = 'lmnopqrstuv' and channel_id in (
  select id from public.channels where owner_id = :'user_b'::uuid
    and youtube_channel_id = 'UCbbbbbbbbbbbbbbbbbbbbbb'
);

select set_config('test.owner_a', :'user_a', true);
select set_config('test.owner_b', :'user_b', true);
select set_config('request.jwt.claim.sub', :'user_a', true);
set local role authenticated;

do $$
declare other_owner uuid := current_setting('test.owner_b')::uuid;
begin
  if (select count(*) from public.channels) <> 1 then
    raise exception 'Dono A não está isolado em channels';
  end if;
  if (select count(*) from public.videos) <> 1 then
    raise exception 'Dono A não está isolado em videos';
  end if;
  if exists (select 1 from public.profiles where user_id = other_owner) then
    raise exception 'Dono A pode ler perfil B';
  end if;
  update public.channels set name = 'Invadido' where owner_id = other_owner;
  if found then raise exception 'Dono A alterou canal B'; end if;
end;
$$;

do $$
declare other_owner uuid := current_setting('test.owner_b')::uuid;
begin
  begin
    insert into public.channels(owner_id, youtube_channel_id, name)
    values (other_owner, 'UCcccccccccccccccccccccc', 'Invasão');
    raise exception 'Dono A inseriu canal B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_video_state(user_id, video_id)
    values (current_setting('test.owner_a')::uuid, current_setting('test.video_b')::uuid);
    raise exception 'Dono A alterou estado de vídeo B';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role anon;
do $$
begin
  if exists (select 1 from public.channels) or exists (select 1 from public.videos) then
    raise exception 'Sessão anônima leu dados';
  end if;
end;
$$;
rollback;
