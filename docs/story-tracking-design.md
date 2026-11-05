# Proposta — Acompanhar histórias (v1)

Status: **aguardando aprovação da interface e da migration**. Nenhum esquema, RLS remoto, workflow ou dado foi alterado por esta proposta. Branch: `feature/story-tracking`, criada a partir de `main`.

## Base inspecionada

`videos` já guarda título, canal, datas e ID YouTube; `user_video_state` guarda favoritos e vistos. O coletor faz upsert por `(channel_id, youtube_video_id)` e registra `sync_runs`. Não há tabela de histórias. Em leitura somente de consulta em 05/11/2026, o projeto tinha 35 canais e 2.481 vídeos; títulos reais incluem sequências com obra explícita (`Lábios Afiados como uma Faca – Parte 1…4`, `Frost & Greyson`) e títulos de chamada com somente `Parte 02`. Esta distinção orienta o limite de confiança.

## Algoritmo proposto

1. Ao acompanhar um vídeo, sugerir um nome de obra extraído do título. O usuário confirma ou corrige esse nome. A v1 exige um nome distintivo; `manhwa`, `recap`, `parte` e termos semelhantes sozinhos não bastam. O usuário pode informar até alguns aliases na criação.
2. Normalizar Unicode, acentos, caixa e pontuação; identificar `Parte`, `Part`, `#parte03`, `Episódio`, `EP`, `Chapter` e `S4 EP11`, inclusive faixa `Parte 01–02`.
3. Procurar o nome/alias como frase inteira no título. Uma semelhança de tokens só gera candidato se for forte, do mesmo canal e com numeração seguinte. Priorizar mesmo canal; aceitar outro canal quando a obra aparece explicitamente.
4. Descartar vídeo já confirmado/rejeitado, parte igual ou anterior e título composto só de palavras genéricas. Marcar confiança **alta** para obra exata, mesmo canal e parte seguinte; **média** para obra exata em outro canal, sem parte ou com salto, ou título muito semelhante no mesmo canal.
5. **Todos os resultados são candidatos pendentes.** Nenhum vídeo é associado automaticamente. O usuário confirma ou rejeita e essa decisão não é desfeita por outra coleta. Se o nome da obra não aparecer nem houver forte semelhança textual, a v1 não sugere a continuação; o usuário poderá acompanhá-la explicitamente.

O módulo puro [story-match.ts](../src/shared/story-match.ts) e seus testes já estão na branch para revisar esses critérios. Não consulta YouTube nem grava no Supabase.

## Migration proposta (ainda não criada)

| Tabela | Campos principais | Função |
| --- | --- | --- |
| `tracked_stories` | `id` UUID PK, `owner_id` FK `profiles`, `seed_video_id` FK `videos` (`ON DELETE SET NULL`), `name`, `canonical_key`, `aliases text[]`, `is_followed`, `last_scanned_at`, datas | Identidade da história, vídeo inicial e cursor de varredura. `UNIQUE(owner_id, canonical_key)` impede duplicação para o proprietário. |
| `story_matches` | `id` UUID PK, `story_id` FK `tracked_stories` (`ON DELETE CASCADE`), `video_id` FK `videos` (`ON DELETE CASCADE`), `status` (`pending`, `confirmed`, `rejected`), `score` 0–100, `reason`, posição extraída, `detected_at`, `decided_at` | Relação e decisão por vídeo. `UNIQUE(story_id, video_id)` torna a detecção idempotente; `confirmed` integra o grupo e `rejected` impede nova sugestão. |

O vídeo inicial é representado por `tracked_stories.seed_video_id`; os demais vídeos confirmados vêm de `story_matches.status='confirmed'`. `pending` alimenta o contador e `rejected` preserva a decisão. Deixar de acompanhar atualiza apenas `is_followed=false`: não apaga histórias, vídeos, favoritos ou vistos. Reativar a mesma história usa a linha existente.

### Acessos e integridade

- Habilitar RLS nas duas tabelas novas. Nenhuma política das tabelas existentes muda.
- `tracked_stories`: `SELECT` do próprio `owner_id`; `INSERT` somente com `owner_id=auth.uid()` e `seed_video_id` cujo `videos.channel_id` pertence a canal do mesmo usuário; `UPDATE` somente de `is_followed`, com `USING` e `WITH CHECK` do proprietário. Sem `DELETE` para `authenticated` na v1.
- `story_matches`: `SELECT` somente quando a história **e** o vídeo pertencem ao usuário; `UPDATE` somente das colunas `status` e `decided_at`, exigindo estado anterior `pending` e novo estado `confirmed` ou `rejected`. Sem `INSERT`/`DELETE` para `authenticated`; o coletor insere candidatos via a Secret API Key que já usa, após conferir o proprietário de história e vídeo.
- Conceder privilégios mínimos a `authenticated` e `service_role`; `anon` continua sem acesso. Testar leitura e escrita permitidas/negadas com dois usuários e `anon`, inclusive tentativa de ligar vídeo de outro proprietário. Verificar exposição das tabelas novas na Data API, pois ela não é automática para todos os projetos.
- Índices propostos: `tracked_stories(owner_id, is_followed)`, `story_matches(story_id, status, detected_at DESC)`, `story_matches(video_id)` e índice parcial para pendentes, além das `UNIQUE` acima. As FKs e índices não alteram `videos` nem `user_video_state`.

Antes de criar o arquivo SQL, a migration será gerada com `supabase migration new`, conforme a CLI v2 fixada no projeto. Ela terá no máximo 200 linhas e será validada em PostgreSQL local; **aplicar no projeto hospedado exigirá autorização separada**.

## Fluxo após a coleta

Adicionar uma etapa depois de `runCollector`, sem mudar `saveUploads` nem a deduplicação. Ela lê histórias ativas e vídeos já armazenados, executa o detector localmente e insere apenas pares ainda não decididos. Na primeira varredura de cada história, considera o arquivo existente; nas seguintes, usa `last_scanned_at` com pequena sobreposição e `UNIQUE` para evitar lacunas e duplicatas. O cursor só avança após gravação completa. Falha nessa etapa gera erro próprio no job, sem reverter vídeos importados. Nenhuma chamada adicional à YouTube API.

## Interface proposta

| Local | Alteração |
| --- | --- |
| Cartão do vídeo | Botão **Acompanhar esta história**. Abre confirmação do nome sugerido e aliases opcionais; para obra já acompanhada, abre a história existente. Favorito e Visto permanecem independentes. |
| Navegação | **Minhas histórias** com número de candidatos `pending` de histórias ativas. |
| Minhas histórias | Cada história exibe vídeo inicial e vídeos `confirmed` por data/parte; área separada mostra candidatos com confiança, motivo, canal e botões **Confirmar**/**Rejeitar**. |
| Ação da história | **Deixar de acompanhar** solicita confirmação e apenas marca `is_followed=false`. |

Estados vazios: nenhuma história; história sem continuação; nenhuma sugestão pendente. A primeira verificação de uma história nova ocorrerá após a próxima execução do coletor; a página informa isso. O frontend jamais recebe Secret API Key.

## Critérios de validação

Testes unitários: partes sequenciais, faixa de partes, títulos de chamada diferentes com obra explícita, outro canal, duplicata/parte antiga, nome genérico e ausência de correspondência. Depois da aprovação: testes RLS de dois proprietários e `anon`, idempotência após duas varreduras, decisão persistida, contador, confirmação/rejeição e preservação de favoritos/vistos. `npm run check`, limite de 200 linhas e CI da branch antes de qualquer merge ou publicação.
