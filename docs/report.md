# Relatório de execução

## M0 — 31/10/2026

Arquivos: `docs/architecture.md`, `docs/milestones.md`, `docs/report.md`.

Verificações: `git status`, `git remote -v`, API do GitHub, `node --version`, `npm --version`, busca da CLI Supabase e de `gh`.

Resultado: repositório público vazio, `main` padrão, escrita GitHub disponível, Node 22.23.3 e npm 10.9.9. `gh` e CLI Supabase ausentes. Não há conexão Supabase confirmada nem teste de banco executado.

Pendências: a proprietária confirmou que ainda não existe projeto Supabase. Falta conectar o serviço, confirmar plano e provisionar projeto de desenvolvimento. Pages está desativado.

O conector GitHub leu o repositório e mostrou permissão declarada de escrita, mas a tentativa de criar arquivo retornou HTTP 403. O Git local conseguiu enviar o commit inicial `4d7c696` à `main` vazia. A implementação fica em `feature/replay-mvp`.

## M1 — base web e CI (preparado; gate pendente)

Arquivos: `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`, `src/app/*`, `src/features/*`, `src/shared/*`, `src/styles/*`, `scripts/*`, `.github/workflows/ci.yml`, `.gitignore`, `.env.example`.

Testes executados: `npm ci --offline`, `npm run check`, `curl -I http://127.0.0.1:5173/replay/` com Vite local. Resultado: instalação reproduzível; 14 testes unitários aprovados; lint básico, typecheck, limite de 200 linhas, checagem de segredos e build aprovados; rota `/replay/` retornou HTTP 200. `npm audit` após atualização para Vite 8.3.5 reportou zero vulnerabilidades. Busca no build não encontrou dados fictícios nem padrões de chave de serviço.

Pendências: navegação visual e interações em navegador não verificadas; CI remoto ainda não executado. O lint é básico, focado em espaços finais, CRLF e marcadores de conflito.

## M2 — Supabase (código preparado; gate bloqueado)

Arquivos: `supabase/config.toml`, `supabase/migrations/202610310001_schema.sql`, `202610310002_rls.sql`, `202610310003_channel_requests.sql`, `src/shared/api.ts`, `tests/security/rls.sql`.

Testes executados: apenas typecheck e build do cliente; o teste SQL RLS foi escrito, não executado. Resultado: schema e políticas versionados localmente. Não há prova de migrations aplicadas, CRUD autenticado ou isolamento real.

Pendências: criação e conexão de projeto Supabase, confirmação do plano, aplicação via CLI, duas contas de teste, teste anônimo e verificação de Auth/RLS. Não havia URL nem chave Supabase no ambiente.

## M3 — coleta (código preparado; gate bloqueado)

Arquivos: `collector/feeds/*`, `collector/youtube/resolve.ts`, `collector/persistence/store.ts`, `collector/jobs/*`, `.github/workflows/monitor.yml`, `tests/unit/feed.test.ts`, `fetch.test.ts`, `resolve.test.ts`.

Testes executados: testes unitários de XML, datas, deduplicação, erro HTTP, retry, handle e cota/API indisponível. Resultado: testes locais aprovados. Não houve coleta de canal real, execução de workflow ou upsert em Supabase.

Pendências: canal escolhido e cadastrado, chave opcional da YouTube Data API para handles, Secrets no Actions, execução manual/agendada e observação de idempotência no banco.

## M4 — integração e entrega (parcial; gate bloqueado)

Arquivos: `src/features/videos/view.ts`, `src/features/channels/view.ts`, `src/features/auth/view.ts`, `src/app/*`, `.github/workflows/deploy-pages.yml`, `docs/operations.md`, `README.md`.

Testes executados: build estático, HTTP 200 local e testes unitários de filtros/URLs. Resultado: interface e rotas hash preparadas, ações Supabase implementadas. Nenhuma sessão real, persistência entre sessões, Pages ou acessibilidade em navegador foi comprovada.

Pendências: CI verde remoto, Pages ativado/publicado, teste de teclado/contraste/responsividade em navegador, Auth real, coleta real e URL final verificada. Busca e filtros operam sobre as páginas já carregadas; carregar mais busca lotes adicionais de 50 vídeos.
