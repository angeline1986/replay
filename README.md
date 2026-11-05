# RePlay

RePlay mostra somente vídeos dos canais do YouTube escolhidos pelo usuário. O frontend estático usa Supabase Auth e PostgreSQL com RLS. Um workflow do GitHub Actions está preparado para coletar vídeos pela YouTube Data API v3 às 17:00 em São Paulo e por acionamento manual limitado. Vídeos abrem no YouTube original.

## Estado

O portal e o coletor estão na `main`. O menu para macOS está preparado separadamente em `feature/terminal-control`; a proposta anterior de GitHub App e Edge Function permanece isolada em `feature/portal-monitor-control`. Veja [relatório](docs/report.md) e [operação](docs/operations.md).

## Desenvolvimento

Requer Node.js 22. Execute `npm ci`, `npm run check` e `npm run dev`. Para dados fictícios locais, crie `.env.local` com `VITE_DEMO=true`. O build de produção não usa dados fictícios. Para dados reais, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local` (chave publicável; nunca chave de serviço).

O build usa a base `/replay/` para GitHub Pages. `npm run build` cria `dist/`. `npm run check:lines` valida o máximo de 200 linhas em todo arquivo de código e configuração mantido manualmente. `package-lock.json`, `node_modules`, `dist` e `coverage` são gerados/ignorados.

## Menu no Terminal do macOS

Use Node.js 22, `gh auth login` na conta `angeline1986`, e `.env.local` com `VITE_SUPABASE_URL` do projeto RePlay e `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`. No diretório do projeto, execute `npm ci` e `npm link` uma vez; depois digite `replay` em qualquer diretório enquanto esta versão do Node estiver ativa. `npm run replay` também abre o menu sem instalar o comando global.

O menu usa `gh` para consultar e solicitar o workflow manual na `main`. Para listar ou mudar canais, abre o login GitHub já configurado no Supabase e recebe o callback PKCE em `http://localhost:5173/replay/`, URL já permitida no Auth. Feche um Vite local que ocupe a porta 5173 antes de acessar canais. A sessão fica somente na memória do processo; a chave publicável e o JWT do usuário passam pelas políticas RLS. Não configure `service_role` ou `sb_secret_` no Terminal. Ações em massa exigem confirmação com a quantidade; detalhes em [operação](docs/operations.md).

## Configuração existente

O projeto Supabase `fxbivwcfwqdvotohzrwg`, o login GitHub, o GitHub Pages e os três Actions Secrets da coleta já foram configurados. As migrations e políticas RLS existentes não são reaplicadas pelo menu. Não coloque credenciais em issues, chat, commits, variáveis `VITE_` de serviço ou arquivos do Pages.

## Limites

A coleta usa a YouTube Data API v3: resolve a playlist de uploads pelo ID canônico e lê até duas páginas de 50 vídeos públicos por canal ativo. Não apaga vídeos ausentes da resposta. O workflow em `.github/workflows/monitor.yml` agenda 17:00 em `America/Sao_Paulo` e oferece `Run workflow`; o limite é uma execução manual e uma automática por dia, com no máximo duas coletas totais. ID `UC…` e URL `/channel/UC…` são cadastrados diretamente. `@handle` cria uma solicitação pendente que a coleta resolve pela API. Mantenha as chaves apenas em GitHub Actions Secrets.
