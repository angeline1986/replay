# Operação e recuperação

## Menu do Terminal

Na branch `feature/terminal-control`, instale o atalho com `npm link` após `npm ci`; `replay` abre nove opções. O link global aponta para esta cópia do projeto e para a versão ativa do Node 22 via nvm. `npm run replay` funciona sem o link. O comando exige `gh` autenticado como `angeline1986` para solicitar o workflow. Não cria GitHub App nem Edge Function.

As opções de canal usam a URL e a chave `sb_publishable_` de `.env.local`. No primeiro acesso a canais, a CLI abre o GitHub OAuth existente com PKCE e recebe o código em `http://localhost:5173/replay/`. O Supabase troca o código por sessão em memória; `getUser()` e `profiles.role = owner` são verificados antes de cada leitura e alteração. As consultas e atualizações passam pela RLS existente com o JWT do usuário; nenhuma chave privilegiada é lida pela CLI. A porta 5173 precisa estar livre. Encerrar o processo elimina a sessão local da CLI, sem afetar a sessão do dashboard.

As opções `Ativar todos` e `Pausar todos` calculam apenas canais cujo estado mudará, pedem `SIM <quantidade>`, conferem a lista novamente e verificam o número de linhas retornadas. Em caso de alteração concorrente ou parcial, consulte a lista antes de repetir. A opção manual exige confirmação, consulta os runs do dia local em São Paulo e recusa segunda manual ou run em andamento. O gate e a concorrência do Actions continuam decisivos; duas chamadas simultâneas da CLI podem criar um run extra bloqueado, mas só uma coleta manual é elegível. Um run verde sem etapa de coleta é mostrado como bloqueado, não como coleta concluída. O resultado e a cota só aparecem quando o log contém o resumo filtrado.

## Coleta

O workflow `Monitorar canais` agenda uma coleta diária às 17:00 em `America/Sao_Paulo` e oferece `Run workflow` para uma coleta manual. O botão e o agendamento só ficam disponíveis quando o arquivo estiver na branch padrão; a execução do job exige `refs/heads/main`. `scripts/check-daily-limit.ts` consulta o histórico do próprio workflow na `main` com `github.token` e `actions: read`: a primeira execução manual do dia local pode coletar; outra manual é ignorada. A automática mantém sua vaga, e no máximo duas execuções elegíveis coletam no mesmo dia. Reexecuções do mesmo run são bloqueadas. Se a consulta ao histórico falhar, o coletor não inicia. A concorrência por branch `replay-monitor-${{ github.ref }}` impede duas coletas simultâneas na `main`. Uma manual cancelada, falha ou executada sem canais ativos ainda ocupa sua vaga do dia, por segurança. O limite depende da integridade do histórico do Actions; excluir runs manualmente pode invalidar a contagem.

O workflow usa `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `YOUTUBE_API_KEY` nos GitHub Actions Secrets. Somente canais `is_active = true` entram na coleta. O coletor limita 100 canais, usa `channels.list` em lotes de 50 e lê até duas páginas de 50 vídeos por playlist de uploads. Cada chamada consome uma unidade de cota; não há retry automático. Para 62 canais ativos, o teto da coleta é 126 unidades por execução. A resolução de até 20 solicitações de `@handle` pode adicionar 20 unidades. O teto conjunto é 222 unidades por execução para 100 canais e 20 solicitações. O resumo do job informa canais ativos/processados, vídeos, falhas e unidades estimadas; os erros por canal ficam em `sync_runs`.

Falhas por canal são registradas em `sync_runs`; erro de cota interrompe os canais seguintes. Vídeos ausentes da resposta não são apagados. Reexecuções deduplicam por `UNIQUE(channel_id, youtube_video_id)`. Registros de execução com mais de 30 dias são removidos após a coleta. Se um canal falhar, confira `sync_runs` e o ID canônico; erros HTTP da YouTube API não devem expor a chave.

## Credenciais

Se a chave de serviço vazar, revogue/rotacione no Supabase e atualize apenas o GitHub Secret. Se a chave YouTube vazar, restrinja ou rotacione no Google Cloud e atualize apenas `YOUTUBE_API_KEY` em GitHub Actions Secrets. Se a chave publicável mudar, atualize a GitHub Variable e publique novamente. Nunca mostre chaves em logs. Revise o artefato `dist/` e o histórico Git antes de publicar.

## Backup e restauração

Antes de mudanças de esquema, exporte o banco com ferramenta oficial do Supabase/PostgreSQL para armazenamento controlado pela proprietária, protegido e fora do repositório. Teste a restauração em projeto separado; não presuma que o plano gratuito oferece backup suficiente. Registre data, tamanho e resultado do ensaio. Migrations destrutivas exigem aprovação explícita.

Para recuperar, restaure o último backup verificado em projeto de desenvolvimento, reaplique migrations posteriores, valide contas/RLS e teste a coleta com dados controlados. Só depois altere URLs e chaves do Pages/Actions. A API do YouTube pode repor parte dos vídeos, mas não substitui backup de favoritos e vistos.

## Exclusão

Remover canal pela interface elimina canal, vídeos e estados associados por cascata. A interface pede confirmação. Faça backup antes de exclusão de dados importantes.
