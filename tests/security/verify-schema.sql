-- Leitura somente; compatível com psql e supabase db query --linked --file.
do $$
declare
  table_name text;
  qualified_name text;
  index_name text;
begin
  foreach table_name in array array[
    'profiles', 'channels', 'videos', 'user_video_state',
    'sync_runs', 'channel_requests'
  ] loop
    qualified_name := format('public.%I', table_name);
    if to_regclass(qualified_name) is null then
      raise exception 'Tabela ausente: %', qualified_name;
    end if;
    if not (select relrowsecurity from pg_class where oid = to_regclass(qualified_name)) then
      raise exception 'RLS desabilitado: %', qualified_name;
    end if;
    if has_table_privilege('anon', qualified_name, 'SELECT')
      or has_table_privilege('anon', qualified_name, 'INSERT')
      or has_table_privilege('anon', qualified_name, 'UPDATE')
      or has_table_privilege('anon', qualified_name, 'DELETE') then
      raise exception 'anon tem acesso: %', qualified_name;
    end if;
  end loop;
  if (select count(*) from pg_policies where schemaname = 'public'
      and tablename = any(array[
        'profiles', 'channels', 'videos', 'user_video_state',
        'sync_runs', 'channel_requests'
      ])) <> 14 then
    raise exception 'Quantidade inesperada de políticas RLS';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'INSERT')
    or has_column_privilege('authenticated', 'public.channels', 'name', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.channels', 'is_active', 'UPDATE')
    or not has_table_privilege('service_role', 'public.videos', 'INSERT') then
    raise exception 'Grants divergentes do plano M2';
  end if;
  if (select count(*) from pg_constraint where connamespace = 'public'::regnamespace
      and contype = 'p') <> 6
    or (select count(*) from pg_constraint where connamespace = 'public'::regnamespace
      and contype = 'u') <> 2
    or (select count(*) from pg_constraint where connamespace = 'public'::regnamespace
      and contype = 'c') <> 11
    or (select count(*) from pg_constraint where connamespace = 'public'::regnamespace
      and contype = 'f' and confdeltype = 'c') <> 7 then
    raise exception 'PK, UNIQUE, CHECK ou FK com CASCADE divergentes';
  end if;
  foreach index_name in array array[
    'channels_owner_active_idx', 'videos_channel_published_idx',
    'videos_published_idx', 'sync_runs_channel_started_idx',
    'user_video_state_user_favorite_idx', 'user_video_state_video_id_idx',
    'channel_requests_pending_idx', 'channel_requests_owner_idx'
  ] loop
    if to_regclass(format('public.%I', index_name)) is null then
      raise exception 'Índice ausente: %', index_name;
    end if;
  end loop;
end;
$$;
