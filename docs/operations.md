# Operação e recuperação

## Coleta

O workflow `Monitorar canais` roda a cada 15 minutos e pode ser executado manualmente. Usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` nos Secrets do Actions. Processa apenas canais ativos, isola falhas por canal e registra `sync_runs`. Falha parcial marca o job como falho, sem apagar vídeos. Reexecutar é seguro por `UNIQUE(channel_id, youtube_video_id)`. Registros com mais de 30 dias são removidos após a coleta.

Se um canal falhar, confira o último `sync_runs` e o RSS público `https://www.youtube.com/feeds/videos.xml?channel_id=UC…`. Corrija o ID ou aguarde falha transitória. Não remova dados em massa por feed vazio.

## Credenciais

Se a chave de serviço vazar, revogue/rotacione no Supabase, atualize apenas o GitHub Secret e execute coleta manual. Se a chave publicável mudar, atualize a GitHub Variable e publique novamente. Nunca mostre chaves em logs. Revise o artefato `dist/` e o histórico Git antes de publicar.

## Backup e restauração

Antes de mudanças de esquema, exporte o banco com ferramenta oficial do Supabase/PostgreSQL para armazenamento controlado pela proprietária, protegido e fora do repositório. Teste a restauração em projeto separado; não presuma que o plano gratuito oferece backup suficiente. Registre data, tamanho e resultado do ensaio. Migrations destrutivas exigem aprovação explícita.

Para recuperar, restaure o último backup verificado em projeto de desenvolvimento, reaplique migrations posteriores, valide contas/RLS e teste coleta manual. Só depois altere URLs e chaves do Pages/Actions. O RSS recente pode repor parte dos vídeos, mas não substitui backup de favoritos e vistos.

## Exclusão

Remover canal pela interface elimina canal, vídeos e estados associados por cascata. A interface pede confirmação. Faça backup antes de exclusão de dados importantes.
