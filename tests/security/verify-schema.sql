-- Leitura somente; executar após aplicar as migrations no projeto hospedado.
\set ON_ERROR_STOP on
do $$
declare
  table_name text;
  qualified_name text;
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
end;
$$;
