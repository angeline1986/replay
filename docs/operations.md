# Operação e recuperação

## Coleta

O workflow `Monitorar canais` tem dois horários editáveis em `.github/workflows/monitor.yml` (09:17 e 21:17 em `America/Sao_Paulo`). Ele só será agendado após o arquivo entrar na branch padrão. Usa `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `YOUTUBE_API_KEY` nos GitHub Actions Secrets. Somente canais `is_active = true` entram na coleta. O coletor limita 100 canais, usa `channels.list` em lotes de 50 e lê até duas páginas de 50 vídeos por playlist de uploads. Cada chamada consome uma unidade de cota; não há retry automático. Para 62 canais ativos, o teto da coleta é 126 unidades por execução. A resolução de até 20 solicitações de `@handle` pode adicionar 20 unidades. O teto conjunto é 222 unidades por execução para 100 canais e 20 solicitações.

Falhas por canal são registradas em `sync_runs`; erro de cota interrompe os canais seguintes. Vídeos ausentes da resposta não são apagados. Reexecuções deduplicam por `UNIQUE(channel_id, youtube_video_id)`. Registros de execução com mais de 30 dias são removidos após a coleta. Se um canal falhar, confira `sync_runs` e o ID canônico; erros HTTP da YouTube API não devem expor a chave.

## Credenciais

Se a chave de serviço vazar, revogue/rotacione no Supabase e atualize apenas o GitHub Secret. Se a chave YouTube vazar, restrinja ou rotacione no Google Cloud e atualize apenas `YOUTUBE_API_KEY` em GitHub Actions Secrets. Se a chave publicável mudar, atualize a GitHub Variable e publique novamente. Nunca mostre chaves em logs. Revise o artefato `dist/` e o histórico Git antes de publicar.

## Backup e restauração

Antes de mudanças de esquema, exporte o banco com ferramenta oficial do Supabase/PostgreSQL para armazenamento controlado pela proprietária, protegido e fora do repositório. Teste a restauração em projeto separado; não presuma que o plano gratuito oferece backup suficiente. Registre data, tamanho e resultado do ensaio. Migrations destrutivas exigem aprovação explícita.

Para recuperar, restaure o último backup verificado em projeto de desenvolvimento, reaplique migrations posteriores, valide contas/RLS e teste a coleta com dados controlados. Só depois altere URLs e chaves do Pages/Actions. A API do YouTube pode repor parte dos vídeos, mas não substitui backup de favoritos e vistos.

## Exclusão

Remover canal pela interface elimina canal, vídeos e estados associados por cascata. A interface pede confirmação. Faça backup antes de exclusão de dados importantes.
