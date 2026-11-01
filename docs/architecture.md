# Arquitetura RePlay

## Decisões de M0

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Frontend | Vite, TypeScript, HTML e CSS estáticos em `/replay/` | Compatível com GitHub Pages. |
| Identidade | Supabase Auth por link mágico | Evita armazenar senhas no aplicativo. |
| Acesso inicial | Perfil criado por administrador e lista de permissões no banco | Cadastro público não libera dados. |
| Persistência | PostgreSQL por proprietário, RLS em toda tabela exposta | Isolamento entre contas. |
| Vídeos | `UNIQUE(channel_id, youtube_video_id)` | IDs iguais não vazam entre proprietários. |
| Coleta | RSS no Actions a cada 15 minutos | Sem servidor permanente. |
| Handles | Solicitação pendente e YouTube Data API `channels.list(forHandle)` no Actions | Chave fora do navegador; ID manual quando indisponível. |
| Exclusão | Remover canal apaga vídeos e estados associados | Sem dados órfãos; exige confirmação na interface. |
| Demonstração | Dados estáticos em modo explícito, nunca no build de produção | Não confundir demonstração com dados reais. |

## Fluxo

O navegador autentica no Supabase com chave publicável. Todas as consultas e alterações usam a sessão e políticas RLS. O Actions consulta somente canais ativos com chave de serviço armazenada em Secrets, busca o RSS e faz upsert dos vídeos e registros de coleta. O Pages publica somente o build estático.

## Limites e riscos conhecidos

- O repositório remoto foi verificado vazio em 31/10/2026, com `main` padrão e Pages desativado.
- A sessão tem permissão de escrita no GitHub pelo conector. O Git local precisou de permissão ampliada para gravar em `.git`.
- Supabase não está conectado nesta sessão; plano, projeto, Auth, migrations e RLS em produção ainda não foram verificados.
- Agendamentos do GitHub Actions podem atrasar; RSS pode omitir vídeos antigos e não serve como inventário completo.
- O protótipo HTML não foi fornecido; a interface será original, baseada na descrição recebida.
- A coleta e o deploy reais dependem da configuração de projeto, Secrets, Pages e aprovação dos gates.

## Checklist de segredos

- [x] Repositório local inicialmente sem arquivos e sem credenciais.
- [x] Uso de variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` somente para dados públicos.
- [ ] Confirmar política RLS aplicada antes de publicar URL/chave do cliente.
- [ ] Guardar `SUPABASE_SERVICE_ROLE_KEY` apenas em GitHub Actions Secrets.
- [ ] Conferir build e logs quanto a segredos após integração real.
- [ ] Definir rotação de chaves e plano de backup/restauração.
