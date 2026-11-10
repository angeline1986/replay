-- Proposta Fase 2: executar somente após revisão e gerar migration via CLI.
create table public.replay_import_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  identifier text not null,
  status text not null default 'running' check (status in ('running','done','failed')),
  created_at timestamptz not null default now()
);
create index replay_import_attempts_owner_date on public.replay_import_attempts(owner_id, created_at desc);
alter table public.replay_import_attempts enable row level security;
revoke all on public.replay_import_attempts from public, anon, authenticated;
grant select, insert, update on public.replay_import_attempts to service_role;

create or replace function public.reserve_replay_import(p_owner uuid, p_identifier text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  -- Serializa novas importações, inclusive em instâncias Edge concorrentes.
  perform pg_catalog.pg_advisory_xact_lock(28719, 42);
  if p_owner is null or p_identifier is null or length(p_identifier) > 120 or
    not exists(select 1 from public.profiles where user_id = p_owner and role = 'owner') then
    return null;
  end if;
  -- Máximo de 12 tentativas por dia (incluindo falhas): teto conservador de até 36 consultas YouTube.
  if (select count(*) from public.replay_import_attempts
      where owner_id = p_owner and created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo')
        at time zone 'America/Sao_Paulo') >= 12 then
    return null;
  end if;
  -- Fail-closed: nao liberar uma segunda operacao por passagem de tempo.
  -- Operacoes presas devem ser reconciliadas manualmente, apos confirmar
  -- que nenhum worker ainda esta executando.
  if exists (select 1 from public.replay_import_attempts
      where owner_id = p_owner and status = 'running') then
    return null;
  end if;
  insert into public.replay_import_attempts(owner_id, identifier)
    values(p_owner, p_identifier) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.reserve_replay_import(uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_replay_import(uuid,text) to service_role;
