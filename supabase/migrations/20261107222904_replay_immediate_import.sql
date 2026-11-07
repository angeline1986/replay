-- Cadastro imediato de canal: concorrencia e limite de 12 tentativas/dia.
-- Nao altera canais, videos nem a coleta diaria.
create table public.replay_import_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  identifier text not null,
  status text not null default 'running'
    check (status in ('running', 'done', 'failed')),
  created_at timestamptz not null default now()
);

create index replay_import_attempts_owner_date
  on public.replay_import_attempts(owner_id, created_at desc);

alter table public.replay_import_attempts enable row level security;
revoke all on public.replay_import_attempts from public, anon, authenticated;
grant select, insert, update on public.replay_import_attempts to service_role;

create function public.reserve_replay_import(p_owner uuid, p_identifier text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(28719, 42);
  if p_owner is null or p_identifier is null
     or length(trim(p_identifier)) = 0 or length(p_identifier) > 120
     or not exists (
       select 1 from public.profiles
       where user_id = p_owner and role = 'owner'
     ) then
    return null;
  end if;

  if (
    select count(*) from public.replay_import_attempts
    where owner_id = p_owner
      and created_at >= date_trunc(
        'day', now() at time zone 'America/Sao_Paulo'
      ) at time zone 'America/Sao_Paulo'
  ) >= 12 then
    return null;
  end if;

  -- Operacoes presas exigem reconciliacao administrativa.
  if exists (
    select 1 from public.replay_import_attempts
    where owner_id = p_owner and status = 'running'
  ) then
    return null;
  end if;

  insert into public.replay_import_attempts(owner_id, identifier)
  values (p_owner, p_identifier)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.reserve_replay_import(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reserve_replay_import(uuid, text)
  to service_role;
