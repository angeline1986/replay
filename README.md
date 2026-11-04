# RePlay

RePlay mostra somente vídeos dos canais do YouTube escolhidos pelo usuário. O frontend estático usa Supabase Auth e PostgreSQL com RLS. Um workflow do GitHub Actions está preparado para coletar vídeos pela YouTube Data API v3 às 17:00 em São Paulo e por acionamento manual limitado. Vídeos abrem no YouTube original.

## Estado

O código está na branch `feature/replay-mvp`. A proprietária escolheu um projeto Supabase existente; migrations, Secrets, coleta real e Pages ainda exigem aplicação e validação. Veja [plano Supabase](docs/supabase-plan.md), [relatório](docs/report.md) e [marcos](docs/milestones.md).

## Desenvolvimento

Requer Node.js 22. Execute `npm ci`, `npm run check` e `npm run dev`. Para dados fictícios locais, crie `.env.local` com `VITE_DEMO=true`. O build de produção não usa dados fictícios. Para dados reais, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local` (chave publicável; nunca chave de serviço).

O build usa a base `/replay/` para GitHub Pages. `npm run build` cria `dist/`. `npm run check:lines` valida o máximo de 200 linhas em todo arquivo de código e configuração mantido manualmente. `package-lock.json`, `node_modules`, `dist` e `coverage` são gerados/ignorados.

## Primeira instalação

1. Use o projeto Supabase existente `fxbivwcfwqdvotohzrwg`, escolhido pela proprietária. Confirme o estado e o plano antes de aplicar migrations ou ativar recursos pagos; não crie outro projeto.
2. Aplique as migrations versionadas em `supabase/migrations/` primeiro em desenvolvimento, com a CLI Supabase, e execute os testes RLS com duas contas e sessão anônima.
3. Desative cadastro público no Supabase Auth. Crie o primeiro usuário autorizado por convite administrativo e insira seu `user_id` em `public.profiles` via interface administrativa segura.
4. Configure o URL de redirecionamento `https://angeline1986.github.io/replay/` no Auth.
5. No GitHub, configure as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; configure os Secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `YOUTUBE_API_KEY` para a coleta.
6. Ative GitHub Pages com fonte GitHub Actions. Faça merge na `main` após CI verde. Execute `Monitorar canais` manualmente e verifique logs, banco e a URL do Pages.

Não cole credenciais em issues, chat, commits, variáveis `VITE_` de serviço ou arquivos no Pages. O nome `RePlay` e a interface foram definidos pela descrição da especificação; nenhum protótipo HTML foi recebido.

## Limites

A coleta usa a YouTube Data API v3: resolve a playlist de uploads pelo ID canônico e lê até duas páginas de 50 vídeos públicos por canal ativo. Não apaga vídeos ausentes da resposta. O workflow em `.github/workflows/monitor.yml` agenda 17:00 em `America/Sao_Paulo` e oferece `Run workflow`; o limite é uma execução manual e uma automática por dia, com no máximo duas coletas totais. ID `UC…` e URL `/channel/UC…` são cadastrados diretamente. `@handle` cria uma solicitação pendente que a coleta resolve pela API. Mantenha as chaves apenas em GitHub Actions Secrets.
