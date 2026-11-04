# Arquitetura RePlay

## Arquitetura atual

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Frontend | Vite, TypeScript, HTML e CSS estáticos em `/replay/` | Compatível com GitHub Pages. |
| Identidade | Supabase Auth com GitHub OAuth; link mágico disponível para recuperação | Acesso principal sem senha no aplicativo. |
| Acesso inicial | Perfil criado por administrador e lista de permissões no banco | Cadastro público não libera dados. |
| Persistência | PostgreSQL por proprietário, RLS em toda tabela exposta | Isolamento entre contas. |
| Vídeos | `UNIQUE(channel_id, youtube_video_id)` | IDs iguais não vazam entre proprietários. |
| Coleta | YouTube Data API v3 no Actions, até duas vezes ao dia | Sem servidor permanente; playlist de uploads para canais ativos. |
| Handles | Solicitação pendente e YouTube Data API `channels.list(forHandle)` no Actions | Chave fora do navegador; ID manual quando indisponível. |
| Exclusão | Remover canal apaga vídeos e estados associados | Sem dados órfãos; exige confirmação na interface. |
| Demonstração | Dados estáticos em modo explícito, nunca no build de produção | Não confundir demonstração com dados reais. |

## Fluxo

O navegador autentica no Supabase com chave publicável. Todas as consultas e alterações usam a sessão e políticas RLS. O Actions consulta somente canais ativos com chave de serviço e `YOUTUBE_API_KEY` armazenadas em Secrets, busca a playlist de uploads pela API e faz upsert dos vídeos e registros de coleta. O Pages publica somente o build estático. O workflow de coleta ainda não foi ativado na branch padrão.

## Limites e riscos conhecidos

- Os 62 canais cadastrados permanecem pausados. O workflow de coleta está apenas na branch de trabalho; ativação exige revisão da proprietária.
- Agendamentos do GitHub Actions podem atrasar; a coleta consulta no máximo 100 vídeos por canal e não é um inventário histórico completo.
- A coleta real depende de `YOUTUBE_API_KEY` e das demais credenciais no Actions; nenhum teste remoto do novo coletor foi executado.

## Checklist de segredos

- [x] Repositório local inicialmente sem arquivos e sem credenciais.
- [x] Uso de variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` somente para dados públicos.
- [x] Confirmar política RLS aplicada antes de publicar URL/chave do cliente.
- [ ] Guardar `SUPABASE_SERVICE_ROLE_KEY` apenas em GitHub Actions Secrets.
- [ ] Guardar `YOUTUBE_API_KEY` apenas em GitHub Actions Secrets.
- [ ] Conferir build e logs quanto a segredos após integração real.
- [ ] Definir rotação de chaves e plano de backup/restauração.
