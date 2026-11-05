# Operação e recuperação

## Coleta

O workflow `Monitorar canais` agenda uma coleta diária às 17:00 em `America/Sao_Paulo` e oferece `Run workflow` para uma coleta manual. O botão e o agendamento só ficam disponíveis quando o arquivo estiver na branch padrão; a execução do job exige `refs/heads/main`. `scripts/check-daily-limit.ts` consulta o histórico do próprio workflow na `main` com `github.token` e `actions: read`: a primeira execução manual do dia local pode coletar; outra manual é ignorada. A automática mantém sua vaga, e no máximo duas execuções elegíveis coletam no mesmo dia. Reexecuções do mesmo run são bloqueadas. Se a consulta ao histórico falhar, o coletor não inicia. A concorrência por branch `replay-monitor-${{ github.ref }}` impede duas coletas simultâneas na `main`. Uma manual cancelada, falha ou executada sem canais ativos ainda ocupa sua vaga do dia, por segurança. O limite depende da integridade do histórico do Actions; excluir runs manualmente pode invalidar a contagem.

O workflow usa `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `YOUTUBE_API_KEY` nos GitHub Actions Secrets. Somente canais `is_active = true` entram na coleta. O coletor limita 100 canais, usa `channels.list` em lotes de 50 e lê até duas páginas de 50 vídeos por playlist de uploads. Cada chamada consome uma unidade de cota; não há retry automático. Para 62 canais ativos, o teto da coleta é 126 unidades por execução. A resolução de até 20 solicitações de `@handle` pode adicionar 20 unidades. O teto conjunto é 222 unidades por execução para 100 canais e 20 solicitações. O resumo do job informa canais ativos/processados, vídeos, falhas e unidades estimadas; os erros por canal ficam em `sync_runs`.

Falhas por canal são registradas em `sync_runs`; erro de cota interrompe os canais seguintes. Vídeos ausentes da resposta não são apagados. Reexecuções deduplicam por `UNIQUE(channel_id, youtube_video_id)`. Registros de execução com mais de 30 dias são removidos após a coleta. Se um canal falhar, confira `sync_runs` e o ID canônico; erros HTTP da YouTube API não devem expor a chave.

## Credenciais

O controle pelo portal está preparado em `feature/portal-monitor-control`, sem publicação remota. Para habilitar depois de aprovada a mudança: criar um GitHub App privado sob `angeline1986`, instalar somente em `angeline1986/replay`, conceder apenas `Actions: read/write` e guardar `REPLAY_GITHUB_APP_ID`, `REPLAY_GITHUB_INSTALLATION_ID` e `REPLAY_GITHUB_APP_PRIVATE_KEY` como Secrets da Edge Function `monitor-control`. O App de login GitHub OAuth é separado. A função usa chave publicável e JWT do usuário, valida `getUser()` e `profiles.role = 'owner'`, e usa RLS nas alterações de canais; não recebe a chave de serviço do coletor.

O portal confirma a quantidade antes de ações em massa e o backend recusa contagem desatualizada. A função bloqueia outra solicitação manual no mesmo dia ou enquanto há execução em andamento; o gate do Actions continua sendo a proteção final contra duas coletas. O status vem do run, das etapas e, quando disponível, do log exclusivo do coletor. Um workflow concluído sem a etapa de coleta é mostrado como bloqueado ou falho, nunca como vídeos coletados. O portal exibe 17:00 como horário programado e o início do job como horário efetivo. Logs ausentes deixam contagem e erros como indisponíveis.

Em duas solicitações verdadeiramente simultâneas, ambas podem passar na consulta prévia antes de o GitHub registrar a primeira. O gate do workflow permite somente a primeira coleta manual, mas pode restar um run adicional bloqueado. Impedir até a criação desse run exigiria um bloqueio persistente novo, fora do escopo sem autorização de esquema. O botão fica desativado após o primeiro clique e a consulta prévia impede repetições sequenciais.

Se a chave de serviço vazar, revogue/rotacione no Supabase e atualize apenas o GitHub Secret. Se a chave YouTube vazar, restrinja ou rotacione no Google Cloud e atualize apenas `YOUTUBE_API_KEY` em GitHub Actions Secrets. Se a chave publicável mudar, atualize a GitHub Variable e publique novamente. Nunca mostre chaves em logs. Revise o artefato `dist/` e o histórico Git antes de publicar.

## Backup e restauração

Antes de mudanças de esquema, exporte o banco com ferramenta oficial do Supabase/PostgreSQL para armazenamento controlado pela proprietária, protegido e fora do repositório. Teste a restauração em projeto separado; não presuma que o plano gratuito oferece backup suficiente. Registre data, tamanho e resultado do ensaio. Migrations destrutivas exigem aprovação explícita.

Para recuperar, restaure o último backup verificado em projeto de desenvolvimento, reaplique migrations posteriores, valide contas/RLS e teste a coleta com dados controlados. Só depois altere URLs e chaves do Pages/Actions. A API do YouTube pode repor parte dos vídeos, mas não substitui backup de favoritos e vistos.

## Exclusão

Remover canal pela interface elimina canal, vídeos e estados associados por cascata. A interface pede confirmação. Faça backup antes de exclusão de dados importantes.
