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

## M2 — Supabase (migrations aplicadas; gate pendente)

Arquivos: `supabase/config.toml`, `supabase/migrations/202610310001_schema.sql`, `202610310002_rls.sql`, `202610310003_channel_requests.sql`, `src/shared/api.ts`, `src/app/main.ts`, `tests/security/rls.sql`, `tests/security/bootstrap-local.sql`, `tests/security/verify-schema.sql`, `docs/supabase-plan.md`, `README.md`, `.gitignore`, `package.json`, `package-lock.json`.

Testes executados: `npm run check` aprovou 19 testes locais, typecheck, lint básico, verificador de linhas, segredos e build. Em PostgreSQL 16.14 temporário, o stub `bootstrap-local.sql` e as três migrations executaram com `ON_ERROR_STOP=1`; a consulta mostrou seis tabelas com RLS e 14 políticas. `tests/security/rls.sql` passou com dois usuários simulados e `anon`. A primeira tentativa do teste usou IDs diferentes dos da fixture e falhou na FK; a repetição com os IDs corretos passou. Resultado: RLS, grants e isolamento local verificados; Auth, Data API e PostgreSQL 17.11 hospedados ainda sem prova.

Revisão de 01/11/2026: Supabase CLI 2.122.0 instalada como devDependency fixa (`package.json` e lockfile), com `--help` de `link`, `migration list` e `db push` consultados. `npx supabase projects list` falhou com `AccessTokenRequiredError`: não há sessão CLI autorizada. A integração Supabase está instalada na conta, porém suas ferramentas não estão disponíveis nesta conversa. O verificador somente leitura `tests/security/verify-schema.sql` passou no PostgreSQL temporário. A inspeção remota informada pela proprietária indica `public` vazio e histórico ausente, mas não foi repetida por esta sessão. Nenhuma migration foi aplicada no projeto hospedado; Security Advisor, Auth, Data API e teste RLS com contas reais não foram executados.

Pendências registradas antes da aplicação: confirmar Auth e grants remotos, obter aprovação para o push e executar os testes reais. URL/chave publicável ainda não estão configuradas para o frontend.

Revisão remota de 01/11/2026: a proprietária autenticou e vinculou a CLI ao projeto `fxbivwcfwqdvotohzrwg`. `supabase/.temp/project-ref` confirmou o vínculo. `npx supabase migration list --linked` listou `202610310001`, `202610310002` e `202610310003` como locais, todas sem versão remota. `npx supabase db push --linked --dry-run --skip-vault` retornou somente os três arquivos esperados, `seeds: []` e `roles: []`, sem aplicar SQL. `npx supabase inspect db table-stats --linked` retornou `rows: []`. A tentativa de `db dump --linked --schema public` falhou com `DockerRunError` porque Docker/Podman não está instalado; não foi usada como prova de esquema vazio. O esquema remoto sem tabelas e histórico ausente foi informado pela proprietária em inspeção separada.

Revisão definitiva das migrations: `001` cria cinco tabelas, seis índices e a função/trigger de atualização, habilitando RLS; `002` revoga grants implícitos, concede acessos mínimos e cria políticas por proprietário; `003` cria `channel_requests`, dois índices, trigger, RLS, políticas e grants. Não há `DROP`, `TRUNCATE`, alteração de dados existentes, seed ou criação de projeto. Este registro precedeu a aprovação e o push abaixo.

### Aplicação aprovada e encerramento controlado — 01/11/2026

Pré-condições: `supabase/.temp/project-ref` confirmou `fxbivwcfwqdvotohzrwg`; `git status` estava limpo; três arquivos de migration presentes. As hashes SHA-256 coincidiram com a revisão aprovada: `001` começa em `46837825`, `002` em `c5383ab2`, `003` em `00611bd5`. `migration list --linked` indicou três versões apenas locais; `db push --linked --dry-run --skip-vault` listou exatamente os três arquivos, sem seeds ou roles.

Aplicação: `npx supabase db push --linked --skip-vault` terminou com código 0 e informou aplicação de `202610310001_schema.sql`, `202610310002_rls.sql` e `202610310003_channel_requests.sql`. Nova `migration list --linked` mostrou as três versões locais e remotas iguais. `bootstrap-local.sql` não foi executado no projeto hospedado.

Validações remotas concluídas: `inspect db table-stats --linked` listou as seis tabelas esperadas, cada uma com estimativa de zero linhas; a primeira tentativa paralela falhou na autenticação da role temporária da CLI e a repetição isolada passou. `db query --linked` confirmou PostgreSQL 17.11. A versão então vigente de `tests/security/verify-schema.sql` passou via Management API, verificando seis tabelas com RLS, 14 políticas, grants críticos, seis PKs, duas UNIQUE, sete FKs com CASCADE e oito índices explícitos. Consulta adicional contou 11 CHECK constraints. `db advisors --linked --type security --level info --fail-on none` retornou `No issues found`. Na Data API, GET anônimo com chave publicável retornou HTTP 401 / código 42501 nas seis tabelas.

Bloqueios: `config diff` mostrou cadastro geral e por e-mail habilitado no remoto, Site URL `http://localhost:3000` e ausência do redirect local previsto; nenhuma configuração Auth foi alterada. Consulta remota contou zero usuários Auth e zero perfis. Assim, login real, Data API autenticada, isolamento entre duas contas e `tests/security/rls.sql` no hospedado não foram executados. O verificador SQL local foi ampliado depois da execução bem-sucedida para exigir 11 CHECK constraints; sua repetição remota não ocorreu por instrução de interrupção da proprietária. M2 permanece PENDENTE; M3 não iniciado.

### Auth privado autorizado — 03/11/2026

Arquivos alterados localmente: `supabase/config.toml`, `src/shared/api.ts`, `src/app/main.ts`, `docs/auth-rollout.md`, `docs/supabase-plan.md`, `docs/report.md` e `tests/security/verify-schema.sql`. `.env.local` contém somente URL e chave publicável; está ignorado pelo Git. As migrations permaneceram intactas e não foram reaplicadas.

Configuração remota: a CLI confirmou o projeto vinculado `fxbivwcfwqdvotohzrwg`; `config push` aplicou cadastro global desabilitado, Site URL do GitHub Pages e redirects exatos de Pages/localhost. A configuração inicial desligou também o provedor de e-mail; a leitura da API Auth identificou o problema. Uma correção isolada restaurou `auth.email.enable_signup = true`. A leitura final de `/auth/v1/settings` retornou `email_provider: true`, `disable_signup: true`, `anonymous_sign_ins: false`, `autoconfirm: false`. Nenhuma migration foi reaplicada.

Convite: a CLI identificou `angeline.fm@gmail.com` como conta da equipe. O serviço aceitou o convite administrativo para esse e-mail, com retorno a `http://localhost:5173/replay/`. O ID de usuário retornado foi registrado em `public.profiles` como `owner`; `INSERT ... RETURNING` confirmou. O servidor Vite local respondeu HTTP 200. A proprietária confirmou recebimento do convite e abertura do painel autenticado.

Teste remoto executado: `auth.signUp` público para endereço inválido retornou HTTP 422 / `signup_disabled`, sem usuário criado. Antes desta etapa, a Data API anônima já havia retornado HTTP 401 / 42501 nas seis tabelas e o Security Advisor não encontrou problemas. Os testes RLS locais passaram com dois usuários simulados. A captura do painel mostrou o erro anterior `email rate limit exceeded` ainda visível depois do login; o bootstrap foi corrigido para limpar avisos anteriores quando a sessão e os dados carregam, mas a correção visual ainda não foi confirmada.

Verificação local após a correção: `npm run check` passou integralmente, com limite de 200 linhas, verificador de segredos, lint básico, typecheck, 19 testes e build. O painel aberto sugere que as consultas autenticadas de `profiles`, `channels`, `channel_requests` e `videos` passaram, pois o bootstrap chama todas antes de renderizar o feed; faltam evidências independentes de status/resposta da Data API.

Observação inicial: após atualizar o painel em uma janela normal do Brave, o formulário apareceu sem erro. O diagnóstico posterior da proprietária confirmou a chave de sessão, access token e refresh token no `localStorage`, access token não expirado e retorno automático do dashboard sem novo login. Assim, o problema era a exibição transitória do login, sem prova de perda persistente da sessão. `@supabase/supabase-js` havia sido atualizado de 2.57.0 para 2.118.0; isso não foi estabelecido como causa nem solução. `npm install` reportou zero vulnerabilidades e o `npm run check` da época passou com 19 testes.

Pendências: validar a nova renderização durante refresh no Brave, testar logout nesse navegador e isolamento entre contas reais. Não foi criada segunda conta. M2 segue **PENDENTE**; M3 não foi iniciado.

Teste administrativo adicional, sem envio de e-mail nem criação de usuário: `generateLink` de Magic Link para a conta existente e `verifyOtp` produziram sessão com o mesmo ID do convite. Uma segunda instância do cliente restaurou a sessão de armazenamento de teste. A Data API autenticada consultou as seis tabelas sem erro: `profiles` retornou 1 e as demais 0. `signOut({ scope: 'local' })` limpou a sessão desse armazenamento. Resultado: Auth, Data API e logout passaram no processo de teste; persistência e logout no Brave continuam sem validação após a atualização do cliente. O isolamento entre duas contas reais segue pendente.

Segurança operacional: a listagem `projects api-keys` da CLI exibiu o valor completo da chave legacy `service_role` na saída da ferramenta, mesmo sem `--reveal`. A chave não foi adicionada ao repositório nem repetida neste relatório. Antes de produção, sua rotação/desativação deve ser planejada e autorizada; nenhuma rotação foi feita nesta etapa.

### Correção pontual da inicialização Auth — 03/11/2026

Arquivos alterados: `src/app/auth-gate.ts` (novo controlador de estado e serialização), `src/app/main.ts` (renderização por fase), `tests/unit/auth-gate.test.ts` (refresh e concorrência), `docs/auth-rollout.md` e `docs/report.md`. Nenhuma configuração remota, migration ou política RLS foi alterada; M3 não foi iniciado.

Verificações: `npm run check` passou na versão final com 24 testes, incluindo sessão válida, sessão ausente, login durante recuperação, logout com resultado atrasado e falha de rede com retry. Typecheck, lint, verificador de segredos, limite de 200 linhas e build também passaram. Duas capturas fornecidas pela proprietária mostram “Restaurando sessão…” seguido do dashboard autenticado, sem formulário de login intermediário. O refresh visual no Brave passou; logout no Brave e isolamento entre contas reais seguem pendentes para o M2.

### Preparação da migração para GitHub OAuth — 03/11/2026

Leitura remota, sem mutação: o projeto `fxbivwcfwqdvotohzrwg` está ativo. A consulta a `auth.users`, `auth.identities` e `public.profiles` confirmou `angeline.fm@gmail.com`, e-mail verificado, `user_id = b53f859e-178e-4abb-b4f4-9e17f0bd08f8`, perfil `owner` e somente identidade `email`. O conector GitHub retornou login `angeline1986` e ID `44986789`. Ainda não existe identidade GitHub para comprovar vínculo.

Arquivos locais: `src/shared/api.ts` inicia `signInWithOAuth` para GitHub com `redirectTo` exato `https://angeline1986.github.io/replay/` em produção; `src/features/auth/view.ts` mostra GitHub como botão principal e mantém Magic Link como recuperação; `src/app/main.ts`, CSS e teste de UI foram ajustados. `npm run check` passou: 24 testes, lint, typecheck, verificador de segredos, limite de 200 linhas e build. A sessão real de OAuth não foi testada.

Gate: a proprietária autorizou a criação do OAuth App e a habilitação do provedor GitHub, preservando `user_id`, `owner`, cadastro fechado, Magic Link e RLS. Os conectores disponíveis não criam OAuth Apps nem editam Auth; foram enviados passos para registrar o app com callback `https://fxbivwcfwqdvotohzrwg.supabase.co/auth/v1/callback` e inserir ID/segredo diretamente no painel Supabase, sem expor o segredo ao frontend, logs ou conversa. A intervenção da proprietária está pendente. No primeiro login, consultar novamente identidades e perfil e comparar o `user_id` e o GitHub ID acima. Se divergirem, parar; nenhum perfil ou dado será criado/transferido. Login, refresh, logout e recuperação no Brave, além da comparação de permissões, continuam pendentes. Nenhuma migration ou política RLS foi alterada; M3 não foi iniciado.

Após confirmação da proprietária, leitura de `/auth/v1/settings` com a chave publicável local retornou `external.github: true`, `external.email: true`, `disable_signup: true` e `external.anonymous_users: false`. O Client Secret não foi lido. Nova consulta remota somente leitura confirmou `user_id = b53f859e-178e-4abb-b4f4-9e17f0bd08f8`, `owner` e nenhuma identidade GitHub antes do primeiro login. `npm run check` repetiu 24 testes aprovados, typecheck, lint, verificador de segredos, limite de 200 linhas e build. O app ainda não foi publicado nem testado com OAuth neste ponto.

Publicação: commit `596fb70` enviado a `feature/replay-mvp`; [CI](https://github.com/angeline1986/replay/actions/runs/41742190488) e [Pages](https://github.com/angeline1986/replay/actions/runs/41742190517) terminaram com sucesso. `HEAD https://angeline1986.github.io/replay/` retornou HTTP 200. Consulta ao banco confirmou exatamente um perfil, o `owner` original. A proprietária foi orientada a fazer somente o primeiro login GitHub no Brave e aguardar a conferência da identidade antes de refresh/logout. Nenhuma migration ou política RLS foi alterada; M3 não foi iniciado.

Primeiro login: a proprietária confirmou que o dashboard abriu em `/replay/` no Brave após autenticar com GitHub. Consulta imediata, somente leitura, mostrou identidades `email` e `github` (`provider_id = 44986789`) no mesmo `user_id = b53f859e-178e-4abb-b4f4-9e17f0bd08f8`, com perfil `owner`. Contagens: um usuário Auth, um perfil, uma identidade GitHub correspondente e 14 políticas em `public`, mesma quantidade registrada antes. Como `currentUser()` exige `getUser()` e consulta `profiles` por `user.id` antes de abrir o dashboard, e existe somente esse perfil, a sessão autenticada manteve o ID e as permissões originais. Nenhum perfil alternativo ou transferência de dados foi feito. Refresh, recuperação e logout no Brave ainda pendem de confirmação.

Teste Brave: a proprietária confirmou que fechar e reabrir a aba restaurou o dashboard sem novo login; clicar em Sair voltou à tela de login. A atualização com sessão ativa e o novo login GitHub após o logout ainda estão pendentes.

Segundo login: após o logout, a proprietária confirmou novo acesso pelo GitHub. Consulta remota repetida contou um usuário Auth, um perfil `owner` e uma identidade GitHub `44986789`, sempre no `user_id` original. A atualização da página no Brave continua pendente.

Validação final no Brave: a proprietária confirmou que atualizar `/replay/` com sessão GitHub ativa voltou ao dashboard sem pedir novo login. Primeiro login, segunda entrada após logout, refresh da página, reabertura da aba com recuperação da sessão e logout passaram. A rotação automática do token por expiração não foi forçada. O vínculo GitHub foi verificado por `provider_id = 44986789` na conta Supabase original; um único usuário Auth e um único perfil `owner` permaneceram. O cadastro público continuou fechado, o provedor de e-mail e o Magic Link permaneceram disponíveis, e as 14 políticas `public` não foram alteradas. A migração de acesso normal para GitHub OAuth está validada; o teste de isolamento com duas contas reais, pendente do M2 anterior, não foi feito porque nenhuma segunda conta foi criada. M3 não foi iniciado.

## M3 — coleta (código preparado; gate bloqueado)

Arquivos: `collector/feeds/*`, `collector/youtube/resolve.ts`, `collector/persistence/store.ts`, `collector/jobs/*`, `.github/workflows/monitor.yml`, `tests/unit/feed.test.ts`, `fetch.test.ts`, `resolve.test.ts`.

Testes executados: testes unitários de XML, datas, deduplicação, erro HTTP, retry, handle e cota/API indisponível. Resultado: testes locais aprovados. Não houve coleta de canal real, execução de workflow ou upsert em Supabase.

Pendências: canal escolhido e cadastrado, chave opcional da YouTube Data API para handles, Secrets no Actions, execução manual/agendada e observação de idempotência no banco.

## M4 — integração e entrega (parcial; gate bloqueado)

Arquivos: `src/features/videos/view.ts`, `src/features/channels/view.ts`, `src/features/auth/view.ts`, `src/app/*`, `.github/workflows/deploy-pages.yml`, `docs/operations.md`, `README.md`.

Testes executados: build estático, HTTP 200 local, testes de filtros/URLs/rotas e interações DOM de canais, vídeos e login. Resultado: interface e rotas hash preparadas, ações Supabase implementadas. Nenhuma sessão real, persistência entre sessões, Pages ou acessibilidade em navegador foi comprovada.

Pendências: CI verde para o commit final, Pages ativado/publicado, teste de teclado/contraste/responsividade em navegador, Auth real, coleta real e URL final verificada. Busca e filtros operam sobre as páginas já carregadas; carregar mais busca lotes adicionais de 50 vídeos.

## Ajuste de layout com protótipo — 03/11/2026

Referência visual fornecida pela proprietária: `replay_prototipo (1).html`. O frontend passou a usar tema claro, barra lateral com Favoritos/Canais/Últimos lançamentos, cabeçalhos e cartões de resumo, grade de vídeos e lista de canais no estilo do protótipo. A rota inicial abre Favoritos; busca, filtros e ordenação A–Z usam os vídeos reais já carregados. O botão de inclusão leva a Canais, ação já suportada. O cadastro manual de vídeos e os dados locais fictícios do protótipo não foram incorporados.

Verificações: `npm run check` passou com 25 testes, typecheck, lint, segredos, limite de 200 linhas e build. Playwright renderizou o protótipo e a versão local em 1440 × 900 e 390 × 844; foram inspecionados Favoritos, Últimos lançamentos, Canais e login. A inspeção visual revelou e levou à correção do texto vazio no filtro de canal, agora exibindo “Todos os canais”. Nenhuma configuração Supabase, migration, política RLS ou dado remoto foi alterado. O Magic Link continua disponível; M3 não foi iniciado.
