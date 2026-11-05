# Arquitetura RePlay

## Arquitetura atual

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Frontend | Vite, TypeScript, HTML e CSS estáticos em `/replay/` | Compatível com GitHub Pages. |
| Identidade | Supabase Auth com GitHub OAuth; link mágico disponível para recuperação | Acesso principal sem senha no aplicativo. |
| Acesso inicial | Perfil criado por administrador e lista de permissões no banco | Cadastro público não libera dados. |
| Persistência | PostgreSQL por proprietário, RLS em toda tabela exposta | Isolamento entre contas. |
| Vídeos | `UNIQUE(channel_id, youtube_video_id)` | IDs iguais não vazam entre proprietários. |
| Coleta | YouTube Data API v3 no Actions, 17:00 e até uma execução manual diária | Sem servidor permanente; playlist de uploads para canais ativos. |
| Controle no portal | Edge Function autenticada e GitHub App restrito ao repositório | Disparo e status sem credencial privilegiada no navegador. |
| Handles | Solicitação pendente e YouTube Data API `channels.list(forHandle)` no Actions | Chave fora do navegador; ID manual quando indisponível. |
| Exclusão | Remover canal apaga vídeos e estados associados | Sem dados órfãos; exige confirmação na interface. |
| Demonstração | Dados estáticos em modo explícito, nunca no build de produção | Não confundir demonstração com dados reais. |

## Fluxo

O navegador autentica no Supabase com chave publicável. O portal envia a sessão à Edge Function, que valida o usuário e o perfil owner; atualizações de canais continuam sob RLS. A função usa um GitHub App para disparar e consultar o workflow na `main`. O Actions consulta canais ativos com chave de serviço e `YOUTUBE_API_KEY` em Secrets, busca uploads e faz upsert. O Pages publica somente o build estático. A nova função ainda não foi publicada.

## Limites e riscos conhecidos

- O estado dos canais pode mudar pelo portal; a última leitura nesta etapa contou 62 canais, 2 ativos e 100 vídeos. Nenhuma alteração remota foi feita nesta branch.
- Agendamentos do GitHub Actions podem atrasar; a coleta consulta no máximo 100 vídeos por canal e não é um inventário histórico completo.
- O status detalhado depende da disponibilidade dos logs do GitHub. Sem log, o portal mostra a contagem como indisponível em vez de presumir zero.

## Checklist de segredos

- [x] Repositório local inicialmente sem arquivos e sem credenciais.
- [x] Uso de variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` somente para dados públicos.
- [x] Confirmar política RLS aplicada antes de publicar URL/chave do cliente.
- [x] Guardar `SUPABASE_SERVICE_ROLE_KEY` apenas em GitHub Actions Secrets.
- [x] Guardar `YOUTUBE_API_KEY` apenas em GitHub Actions Secrets.
- [ ] Guardar a chave privada do GitHub App apenas nos Secrets da Edge Function, após autorização.
- [ ] Conferir build e logs quanto a segredos após integração real.
- [ ] Definir rotação de chaves e plano de backup/restauração.
