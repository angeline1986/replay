# RePlay

RePlay mostra vídeos dos canais do YouTube escolhidos pela proprietária. O frontend estático usa Supabase Auth e PostgreSQL com RLS. O GitHub Actions coleta pela YouTube Data API v3 diariamente às 17:00 em São Paulo e permite uma coleta manual por dia. Vídeos abrem no YouTube original.

## Estado

O MVP está publicado na `main`, com GitHub Pages, Auth e coleta agendada. A branch `feature/portal-monitor-control` prepara o controle dos canais e o disparo pelo portal; a Edge Function e o GitHub App ainda não foram publicados/configurados. Veja [relatório](docs/report.md) e [operações](docs/operations.md).

## Desenvolvimento

Requer Node.js 22. Execute `npm ci`, `npm run check` e `npm run dev`. Para dados fictícios locais, crie `.env.local` com `VITE_DEMO=true`. O build de produção não usa dados fictícios. Para dados reais, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local` (chave publicável; nunca chave de serviço).

O build usa a base `/replay/` para GitHub Pages. `npm run build` cria `dist/`. `npm run check:lines` valida o máximo de 200 linhas em todo arquivo de código e configuração mantido manualmente. `package-lock.json`, `node_modules`, `dist` e `coverage` são gerados/ignorados.

## Credenciais e publicação

O projeto Supabase existente é `fxbivwcfwqdvotohzrwg`. O Pages usa somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; o Actions guarda `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `YOUTUBE_API_KEY`. O controle pelo portal requer um GitHub App instalado apenas em `angeline1986/replay` e os três valores `REPLAY_GITHUB_APP_ID`, `REPLAY_GITHUB_INSTALLATION_ID` e `REPLAY_GITHUB_APP_PRIVATE_KEY` nos Secrets da Edge Function. Não publique a função nem crie credenciais sem autorização específica. Nunca coloque chaves em arquivos do Pages, commits, issues ou mensagens.

## Limites

A coleta usa a playlist de uploads pelo ID canônico e lê até duas páginas de 50 vídeos públicos por canal ativo. Não apaga vídeos ausentes da resposta. O workflow mantém uma execução manual e uma automática por dia, sem concorrência. ID `UC…` e URL `/channel/UC…` são cadastrados diretamente; `@handle` cria uma solicitação pendente resolvida pelo Actions. O portal só aciona o mesmo workflow após verificação de sessão e perfil owner no backend.
