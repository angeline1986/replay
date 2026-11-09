-- Apenas o dono de cada tentativa pode ler seu histórico no painel de consumo.
grant select on public.replay_import_attempts to authenticated;

create policy replay_import_attempts_owner_read
on public.replay_import_attempts for select to authenticated
using (owner_id = (select auth.uid()));
