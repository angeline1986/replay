# Relatório de execução

## M0 — 31/10/2026

Arquivos: `docs/architecture.md`, `docs/milestones.md`, `docs/report.md`.

Verificações: `git status`, `git remote -v`, API do GitHub, `node --version`, `npm --version`, busca da CLI Supabase e de `gh`.

Resultado: repositório público inicialmente vazio, `main` padrão, push Git local disponível, Node 22.23.3 e npm 10.9.9. `gh` e CLI Supabase ausentes. Não há conexão Supabase confirmada nem teste de banco executado.

Pendências: a proprietária escolheu usar o projeto Supabase existente `fxbivwcfwqdvotohzrwg`. Relatou estado saudável, `public` vazio e nenhuma Edge Function; a integração ainda não está acessível nesta conversa para confirmação independente. Faltam plano e Auth remotos. Pages está desativado.

O conector GitHub leu o repositório e mostrou permissão declarada de escrita, mas criar arquivo e PR retornou HTTP 403. O Git local enviou o commit inicial `4d7c696` à `main` vazia. A implementação está em `feature/replay-mvp`; PR não criado.

## M1 — base web e CI (preparado; gate pendente)

Arquivos: `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`, `src/app/*`, `src/features/*`, `src/shared/*`, `src/styles/*`, `scripts/*`, `.github/workflows/ci.yml`, `.gitignore`, `.env.example`.

Testes executados: `npm ci --offline`, `npm run check`, `curl -I http://127.0.0.1:5173/replay/` com Vite local. Resultado: instalação reproduzível; 19 testes unitários e de interação DOM aprovados; lint básico, typecheck, limite de 200 linhas, checagem de segredos e build aprovados; rota `/replay/` retornou HTTP 200. `npm audit` após atualização para Vite 8.3.5 reportou zero vulnerabilidades. Busca no build não encontrou dados fictícios nem padrões de chave de serviço. [CI da branch](https://github.com/angeline1986/replay/actions/runs/41261138629) passou com `npm ci`, auditoria e `npm run check`.

Pendências: navegação visual e interações em navegador real não verificadas. Cada novo commit precisa de sua própria execução CI verde. O lint é básico, focado em espaços finais, CRLF e marcadores de conflito.

## M2 — Supabase (código preparado; gate bloqueado)

Arquivos: `supabase/config.toml`, `supabase/migrations/202610310001_schema.sql`, `202610310002_rls.sql`, `202610310003_channel_requests.sql`, `src/shared/api.ts`, `src/app/main.ts`, `tests/security/rls.sql`, `tests/security/bootstrap-local.sql`, `tests/security/verify-schema.sql`, `docs/supabase-plan.md`, `README.md`, `.gitignore`, `package.json`, `package-lock.json`.

Testes executados: `npm run check` aprovou 19 testes locais, typecheck, lint básico, verificador de linhas, segredos e build. Em PostgreSQL 16.14 temporário, o stub `bootstrap-local.sql` e as três migrations executaram com `ON_ERROR_STOP=1`; a consulta mostrou seis tabelas com RLS e 14 políticas. `tests/security/rls.sql` passou com dois usuários simulados e `anon`. A primeira tentativa do teste usou IDs diferentes dos da fixture e falhou na FK; a repetição com os IDs corretos passou. Resultado: RLS, grants e isolamento local verificados; Auth, Data API e PostgreSQL 17.11 hospedados ainda sem prova.

Revisão de 01/11/2026: Supabase CLI 2.122.0 instalada como devDependency fixa (`package.json` e lockfile), com `--help` de `link`, `migration list` e `db push` consultados. `npx supabase projects list` falhou com `AccessTokenRequiredError`: não há sessão CLI autorizada. A integração Supabase está instalada na conta, porém suas ferramentas não estão disponíveis nesta conversa. O verificador somente leitura `tests/security/verify-schema.sql` passou no PostgreSQL temporário. A inspeção remota informada pela proprietária indica `public` vazio e histórico ausente, mas não foi repetida por esta sessão. Nenhuma migration foi aplicada no projeto hospedado; Security Advisor, Auth, Data API e teste RLS com contas reais não foram executados.

Pendências: confirmar configurações Auth e grants reais, obter aprovação da proprietária para aplicar as três migrations via CLI com histórico, executar `verify-schema.sql` e `rls.sql` com duas contas reais, testar Data API e Auth, executar Security Advisor e registrar evidências. URL/chave publicável ainda não estão configuradas para o frontend. O M2 não está aprovado.

Revisão remota de 01/11/2026: a proprietária autenticou e vinculou a CLI ao projeto `fxbivwcfwqdvotohzrwg`. `supabase/.temp/project-ref` confirmou o vínculo. `npx supabase migration list --linked` listou `202610310001`, `202610310002` e `202610310003` como locais, todas sem versão remota. `npx supabase db push --linked --dry-run --skip-vault` retornou somente os três arquivos esperados, `seeds: []` e `roles: []`, sem aplicar SQL. `npx supabase inspect db table-stats --linked` retornou `rows: []`. A tentativa de `db dump --linked --schema public` falhou com `DockerRunError` porque Docker/Podman não está instalado; não foi usada como prova de esquema vazio. O esquema remoto sem tabelas e histórico ausente foi informado pela proprietária em inspeção separada.

Revisão definitiva das migrations: `001` cria cinco tabelas, seis índices e a função/trigger de atualização, habilitando RLS; `002` revoga grants implícitos, concede acessos mínimos e cria políticas por proprietário; `003` cria `channel_requests`, dois índices, trigger, RLS, políticas e grants. Não há `DROP`, `TRUNCATE`, alteração de dados existentes, seed ou criação de projeto. Nenhuma migration foi aplicada. Próximo gate: aprovação da proprietária sobre esse diff, seguida de `db push` e testes remotos.

## M3 — coleta (código preparado; gate bloqueado)

Arquivos: `collector/feeds/*`, `collector/youtube/resolve.ts`, `collector/persistence/store.ts`, `collector/jobs/*`, `.github/workflows/monitor.yml`, `tests/unit/feed.test.ts`, `fetch.test.ts`, `resolve.test.ts`.

Testes executados: testes unitários de XML, datas, deduplicação, erro HTTP, retry, handle e cota/API indisponível. Resultado: testes locais aprovados. Não houve coleta de canal real, execução de workflow ou upsert em Supabase.

Pendências: canal escolhido e cadastrado, chave opcional da YouTube Data API para handles, Secrets no Actions, execução manual/agendada e observação de idempotência no banco.

## M4 — integração e entrega (parcial; gate bloqueado)

Arquivos: `src/features/videos/view.ts`, `src/features/channels/view.ts`, `src/features/auth/view.ts`, `src/app/*`, `.github/workflows/deploy-pages.yml`, `docs/operations.md`, `README.md`.

Testes executados: build estático, HTTP 200 local, testes de filtros/URLs/rotas e interações DOM de canais, vídeos e login. Resultado: interface e rotas hash preparadas, ações Supabase implementadas. Nenhuma sessão real, persistência entre sessões, Pages ou acessibilidade em navegador foi comprovada.

Pendências: CI verde para o commit final, Pages ativado/publicado, teste de teclado/contraste/responsividade em navegador, Auth real, coleta real e URL final verificada. Busca e filtros operam sobre as páginas já carregadas; carregar mais busca lotes adicionais de 50 vídeos.
