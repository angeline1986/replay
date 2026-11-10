# RePlay — Fase 2: backend proposto (não implantado)

Esta fase adiciona uma Edge Function `import-channel`, mas NÃO a publica, NÃO cria tabela nem altera o frontend.

## Contrato
- POST `{ "handle": "MestredoKimchi" }` ou `{ "channelId": "UC..." }`
- Autenticação: `withSupabase({auth: 'user'})` e autorização por `profiles.role = owner`.
- Backend usa `ctx.supabaseAdmin` e `YOUTUBE_API_KEY` (somente secrets).
- Reserva atômica via RPC `reserve_replay_import` antes da primeira chamada YouTube.
- Máximo de 12 tentativas/dia por owner; uma importação simultânea por owner (janela 120s).
- Coleta até duas páginas de 50 itens. Dados persistidos via UPSERT.

## Bloqueios obrigatórios antes de deploy
1. Revisar o SQL proposto (não aplicado): `docs/architecture/replay-import-guard.proposal.sql`.
2. Criar migration com a CLI (`supabase migration new ...`), revisar e aplicar em ambiente de testes.
3. Confirmar que `@supabase/server` fornece `ctx.supabaseAdmin` na versão implantada, testando autenticação real.
4. Testar concorrência, cota diária, canal duplicado, falha após INSERT e retry.
5. Configurar `YOUTUBE_API_KEY` somente em Edge Function Secrets e `verify_jwt = false` com autenticação `auth: user` pela SDK.
6. O coletor diário permanece independente e não compartilha ainda o orçamento de API: revisar cota TOTAL do projeto antes de ativar.
7. Não executar deploy da Edge Function nem integrar UI até fechar os bloqueios.

## Limitações da fase
- A função não está ativada nem testada no runtime Deno.
- Não há interface de progresso nesta fase.
- `initial-channel.ts` da Fase 1 continua um núcleo desacoplado; a versão Edge implementa
  a adaptação Deno necessária sem importar os módulos Node do coletor diário.


## Fase 2B — Correcoes para revisao (ainda sem deploy)
- Lock fail-closed: `running` bloqueia novas reservas sem vencimento automatico.
  Se houver falha de runtime, conferir logs e ausencia de worker ativo ANTES
  de atualizar manualmente o registro para `failed` com conta privilegiada.
- A operacao de sucesso/erro deve confirmar que o status foi realmente persistido;
  quando falhar, responde 503 e exige reconciliacao, sem liberar lock implicitamente.
- Retry de canal incompleto reutiliza o mesmo registro, sem reativar canal pausado.
- Respostas de playlist com token repetido sao rejeitadas.
- O limite de 12 tentativas por proprietario NAO e cota compartilhada de YouTube.
  O coletor diario continua independente. E PROIBIDO implantar a funcao antes
  de implementar/reservar o orcamento global de API e testar concorrencia real.
- `npm run check` nao executa nem tipa a Edge Function Deno: validar com
  `supabase functions serve` e testes de integracao autenticados antes de deploy.
- A SQL acima permanece PROPOSTA, nao migration. Nao executar no banco de producao.
