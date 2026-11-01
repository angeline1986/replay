# RePlay

RePlay mostra somente vídeos dos canais do YouTube escolhidos pelo usuário. O frontend estático usa Supabase Auth e PostgreSQL com RLS. Um workflow do GitHub Actions coleta RSS a cada 15 minutos. Vídeos abrem no YouTube original.

## Estado

O código está preparado localmente. Projeto Supabase, migrations aplicadas, Secrets, execução real da coleta e Pages publicado exigem conexão e validação. Veja [relatório](docs/report.md) e [marcos](docs/milestones.md).

## Desenvolvimento

Requer Node.js 22. Execute `npm ci`, `npm run check` e `npm run dev`. Para dados fictícios locais, crie `.env.local` com `VITE_DEMO=true`. O build de produção não usa dados fictícios. Para dados reais, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local` (chave publicável; nunca chave de serviço).

O build usa a base `/replay/` para GitHub Pages. `npm run build` cria `dist/`. `npm run check:lines` valida o máximo de 200 linhas em todo arquivo de código e configuração mantido manualmente. `package-lock.json`, `node_modules`, `dist` e `coverage` são gerados/ignorados.

## Primeira instalação

1. Crie projeto Supabase dedicado em uma conta da proprietária e confirme o plano e custos antes de ativar recursos pagos.
2. Aplique as migrations versionadas em `supabase/migrations/` primeiro em desenvolvimento, com a CLI Supabase, e execute os testes RLS com duas contas e sessão anônima.
3. Desative cadastro público no Supabase Auth. Crie o primeiro usuário autorizado por convite administrativo e insira seu `user_id` em `public.profiles` via interface administrativa segura.
4. Configure o URL de redirecionamento `https://angeline1986.github.io/replay/` no Auth.
5. No GitHub, configure as variables `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; configure os Secrets `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para a coleta.
6. Ative GitHub Pages com fonte GitHub Actions. Faça merge na `main` após CI verde. Execute `Monitorar canais` manualmente e verifique logs, banco e a URL do Pages.

Não cole credenciais em issues, chat, commits, variáveis `VITE_` de serviço ou arquivos no Pages. O nome `RePlay` e a interface foram definidos pela descrição da especificação; nenhum protótipo HTML foi recebido.

## Limites

O RSS do YouTube pode ser incompleto. A coleta não apaga vídeos ausentes do feed. A rotina agendada pode atrasar. A versão inicial aceita ID `UC…` ou URL `/channel/UC…`; `@handle` é reconhecido mas exige resolução confiável por API antes de cadastro, ainda pendente de integração.
