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
insert into public.user_video_state(user_id, video_id)
select c.owner_id, v.id from public.videos v join public.channels c on c.id = v.channel_id
where c.youtube_channel_id in ('UCaaaaaaaaaaaaaaaaaaaaaa', 'UCbbbbbbbbbbbbbbbbbbbbbb')
  and c.owner_id in (:'user_a'::uuid, :'user_b'::uuid)
on conflict (user_id, video_id) do nothing;
insert into public.channel_requests(owner_id, handle)
values (:'user_a'::uuid, 'teste-a'), (:'user_b'::uuid, 'teste-b');
insert into public.sync_runs(channel_id, status)
select id, 'success' from public.channels
where youtube_channel_id in ('UCaaaaaaaaaaaaaaaaaaaaaa', 'UCbbbbbbbbbbbbbbbbbbbbbb')
  and owner_id in (:'user_a'::uuid, :'user_b'::uuid);

select set_config('test.video_b', id::text, true) from public.videos
where youtube_video_id = 'lmnopqrstuv' and channel_id in (
  select id from public.channels where owner_id = :'user_b'::uuid
    and youtube_channel_id = 'UCbbbbbbbbbbbbbbbbbbbbbb'
);
select set_config('test.run_b', id::text, true) from public.sync_runs
where channel_id in (
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
  if not exists (select 1 from public.profiles where user_id = current_setting('test.owner_a')::uuid)
    or exists (select 1 from public.profiles where user_id = other_owner) then
    raise exception 'profiles não isolados';
  end if;
  if not exists (select 1 from public.channels where youtube_channel_id = 'UCaaaaaaaaaaaaaaaaaaaaaa')
    or exists (select 1 from public.channels where owner_id = other_owner) then
    raise exception 'channels não isolados';
  end if;
  if not exists (select 1 from public.videos where youtube_video_id = 'abcdefghijk')
    or exists (select 1 from public.videos where youtube_video_id = 'lmnopqrstuv') then
    raise exception 'videos não isolados';
  end if;
  if (select count(*) from public.user_video_state) < 1
    or exists (select 1 from public.user_video_state where user_id = other_owner) then
    raise exception 'user_video_state não isolado';
  end if;
  if not exists (select 1 from public.channel_requests where handle = 'teste-a')
    or exists (select 1 from public.channel_requests where owner_id = other_owner) then
    raise exception 'channel_requests não isolados';
  end if;
  if (select count(*) from public.sync_runs) < 1
    or exists (select 1 from public.sync_runs where id = current_setting('test.run_b')::uuid) then
    raise exception 'sync_runs não isolados';
  end if;
  update public.channels set is_active = false
    where youtube_channel_id = 'UCaaaaaaaaaaaaaaaaaaaaaa';
  if not found then raise exception 'Dono A não alterou o próprio canal'; end if;
  update public.user_video_state set is_favorite = true
    where user_id = current_setting('test.owner_a')::uuid;
  if not found then raise exception 'Dono A não alterou o próprio estado'; end if;
  insert into public.channel_requests(owner_id, handle)
    values (current_setting('test.owner_a')::uuid, 'pedido-proprio');
  update public.channels set is_active = false where owner_id = other_owner;
  if found then raise exception 'Dono A alterou canal B'; end if;
  delete from public.channels where owner_id = other_owner;
  if found then raise exception 'Dono A removeu canal B'; end if;
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
    insert into public.channel_requests(owner_id, handle) values (other_owner, 'invasao');
    raise exception 'Dono A inseriu solicitação B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_video_state(user_id, video_id)
    values (current_setting('test.owner_a')::uuid, current_setting('test.video_b')::uuid);
    raise exception 'Dono A alterou estado de vídeo B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles(user_id) values (other_owner);
    raise exception 'Cliente inseriu perfil';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.videos set title = 'Invadido' where youtube_video_id = 'abcdefghijk';
    raise exception 'Cliente alterou metadados de vídeo';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role anon;
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'channels', 'videos', 'user_video_state', 'sync_runs', 'channel_requests'
  ] loop
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT') then
      raise exception 'anon tem SELECT em %', table_name;
    end if;
    begin
      execute format('select 1 from public.%I limit 1', table_name);
      raise exception 'anon leu %', table_name;
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;
rollback;
