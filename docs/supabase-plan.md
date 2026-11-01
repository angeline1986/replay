# Plano M2 — Supabase do RePlay

## Projeto e estado inicial

A proprietária identificou `ange line's Project` (`fxbivwcfwqdvotohzrwg`) como o projeto a usar. A inspeção feita em outra conversa informou PostgreSQL 17.11, estado `ACTIVE_HEALTHY`, schema `public` sem tabelas, nenhuma Edge Function e histórico `supabase_migrations.schema_migrations` ausente. A CLI vinculada confirmou o ID, o histórico sem migrations aplicadas e o `dry-run` com apenas os três arquivos esperados. A exportação do esquema não foi possível sem Docker/Podman; confirmar os objetos antes do push. Não criar outro projeto.

Tratar o projeto existente como ambiente de desenvolvimento durante a validação. Confirmar plano e recursos disponíveis, histórico de migrations, grants padrão da Data API, configuração Auth e backup antes de promover o uso para produção. Uma mudança externa feita entre a inspeção e a aplicação exige nova revisão do diff.

## Sequência das migrations ainda não aplicadas

| Arquivo | Responsabilidade | Segurança |
| --- | --- | --- |
| `202610310001_schema.sql` | Tabelas, FKs, constraints, índices e trigger de `updated_at` | RLS habilitado na mesma transação de criação; acesso negado por padrão. |
| `202610310002_rls.sql` | Grants explícitos e políticas das cinco tabelas principais | Nenhum grant a `anon`; operações do cliente restritas por proprietário. |
| `202610310003_channel_requests.sql` | Solicitações de `@handle` processadas pelo Actions | RLS e grants explícitos; cliente só cria pedido pendente. |

`gen_random_uuid()` já faz parte do PostgreSQL 17; não instalar `pgcrypto` apenas para gerar UUIDs. Os vídeos pertencem ao canal e usam `UNIQUE(channel_id, youtube_video_id)`, preservando isolamento entre proprietários. `user_video_state(video_id)` tem índice para consultas e exclusões em cascata.

### Matriz de acesso da Data API

| Tabela | `anon` | `authenticated` | `service_role` |
| --- | --- | --- | --- |
| `profiles` | nenhum | SELECT próprio | SELECT |
| `channels` | nenhum | SELECT/DELETE próprios; INSERT das colunas de cadastro; UPDATE só de `is_active` | SELECT/INSERT/UPDATE |
| `videos` | nenhum | SELECT dos canais próprios | SELECT/INSERT/UPDATE |
| `user_video_state` | nenhum | SELECT/INSERT/UPDATE/DELETE de estado próprio em vídeo próprio | nenhum uso previsto |
| `sync_runs` | nenhum | SELECT dos canais próprios | SELECT/INSERT/DELETE |
| `channel_requests` | nenhum | SELECT/DELETE próprios; INSERT só de `owner_id` e `handle` | SELECT/UPDATE |

RLS aplica `auth.uid()` e vínculos por canal, além dos grants. O frontend recebe apenas URL e chave publicável; a chave de serviço fica somente nos Secrets do Actions. `profiles` não tem política de INSERT/UPDATE para usuários, portanto nenhum login consegue conceder acesso a si mesmo.

## Auth e primeiro usuário

1. Confirmar no projeto remoto: autenticação por e-mail habilitada, novos cadastros e login anônimo desabilitados, confirmação de e-mail ativa.
2. Configurar Site URL e redirect permitido `https://angeline1986.github.io/replay/`; para desenvolvimento, permitir `http://localhost:5173/replay/`.
3. Convidar administrativamente o primeiro usuário autorizado e registrar o `user_id` em `public.profiles` por canal administrativo. Não solicitar senha ou token na conversa.
4. O cliente usa `signInWithOtp` com `shouldCreateUser: false`, verifica usuário com `getUser()`, exige perfil e mantém sessão pelo cliente Supabase. Consultas após eventos Auth são agendadas fora do callback.
5. Conferir o template de Magic Link. O serviço de e-mail padrão do Supabase é limitado e serve apenas para testes com membros da equipe; definir SMTP próprio antes de uso fora desse escopo.

`supabase/config.toml` configura o ambiente local da CLI; não altera automaticamente as configurações Auth do projeto hospedado. As opções remotas precisam ser lidas e ajustadas separadamente.

## Aplicação e gate de testes

1. Confirmar leitura do projeto, histórico de migrations, objetos existentes e configurações. Fazer backup/ensaio de restauração conforme o plano disponível.
2. Usar a Supabase CLI 2.122.0 fixada em `package.json`. Após login autorizado na CLI, executar `npx supabase link --project-ref fxbivwcfwqdvotohzrwg`, `npx supabase migration list --linked` e `npx supabase db push --linked --dry-run --skip-vault`. Conferir que somente as três migrations esperadas aparecem; se o remoto tiver novos objetos, interromper e revisar o diff. Aplicar com `npx supabase db push --linked --skip-vault` e repetir `migration list --linked`. Não usar `db reset --linked`, `migration repair` ou SQL avulso para substituir o histórico.
3. Executar `tests/security/verify-schema.sql` em conexão administrativa para conferir seis tabelas com RLS, 14 políticas e grants críticos; verificar também FKs, checks e índices. Executar Security Advisor no Dashboard e registrar resultados/correções.
4. Executar `tests/security/rls.sql` em ambiente de desenvolvimento com duas contas Auth reais: dono, outro usuário e role anônima. O script usa transação com `ROLLBACK` e deve passar leitura e escrita permitidas/negadas nas seis tabelas.
5. Exercitar a Data API com chave publicável e sessões reais: login, cadastro e pausa de canal, estados de vídeo, tentativa cruzada e ausência de sessão. Confirmar erros 403/42501 esperados e persistência após novo login.
6. Registrar comandos, resultados, versão da CLI e evidência no relatório. Só depois configurar Variables/Secrets e prosseguir para coleta e Pages.

As três migrations foram aplicadas apenas em PostgreSQL 16.14 temporário e descartável, com um stub local de `auth`. A consulta local confirmou seis tabelas com RLS e 14 políticas; `tests/security/rls.sql` passou com dois usuários simulados e `anon`. A CLI 2.122.0 está vinculada ao projeto informado: `migration list --linked` mostrou três versões somente locais, e `db push --linked --dry-run --skip-vault` não aplicou SQL. O PostgreSQL 17.11 e a Data API do projeto hospedado ainda não foram testados. A proprietária pediu aprovação antes da aplicação. O stub de `tests/security/bootstrap-local.sql` nunca deve ser executado no Supabase hospedado.

## Fontes verificadas

- [Mudança de grants explícitos na Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Grants e RLS na Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Magic Link e `shouldCreateUser`](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Configuração geral de Auth](https://supabase.com/docs/guides/auth/general-configuration)
- [Limitações do e-mail padrão](https://supabase.com/docs/guides/auth/auth-smtp)
- [Deploy de migrations pela CLI](https://supabase.com/docs/guides/deployment/database-migrations)
- [UUIDs do PostgreSQL 17](https://www.postgresql.org/docs/17/functions-uuid.html)
