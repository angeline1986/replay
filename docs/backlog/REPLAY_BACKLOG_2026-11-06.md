# RePlay — Backlog de melhorias

Data de registro: 2026-11-06
Status: **Pendente** — nenhuma implementação iniciada.

## 1. Cadastro de canal com coleta inicial imediata

**Comportamento desejado:** ao adicionar um novo canal usando `@handle` ou URL na tela **Canais monitorados**, identificar o canal e importar seus primeiros vídeos imediatamente, sem esperar pela coleta diária ou solicitar uma coleta geral pelo Terminal.

**Requisitos:**
- Processar apenas o canal recém-adicionado, sem executar a coleta de todos os canais monitorados.
- Resolver o handle e obter o ID canônico do canal.
- Persistir canal e vídeos no Supabase de maneira idempotente.
- Mostrar no dashboard estados de processamento, sucesso e erro.
- Preservar chave da API somente no servidor, autenticação e autorização.
- Respeitar cota da API YouTube, limites de execução, máximo de canais, concorrência e proteção contra duplicatas.
- Manter a coleta diária para atualização de todos os canais.
- Cobrir sucesso, falha, cota e solicitações repetidas em testes.

**Critério de aceite:** cadastrar `@MestredoKimchi` (ou outro canal ainda não monitorado) resulta, em uma mesma solicitação, no cadastro do canal e na disponibilidade de seus vídeos, se a API responder e houver cota.

## 2. Botão "Carregar mais vídeos" em lotes de quatro

**Comportamento desejado:** na tela **Últimos lançamentos**, cada clique em **Carregar mais vídeos** acrescenta **até quatro vídeos** à lista atualmente exibida.

**Requisitos:**
- Incrementar quatro cartões por clique; último lote pode conter menos de quatro.
- Preservar busca, seleção de canal, status e ordenação.
- Evitar duplicações e saltos.
- Ocultar o botão quando não houver vídeos restantes.
- Não alterar a listagem completa da tela **Vídeos favoritos**.
- Não afetar a visualização de um destaque por canal em **Todos os lançamentos / Todos os canais**.
- Adicionar testes para incrementos de 4 em 4, fim da lista e filtros.

**Critério de aceite:** com 11 vídeos adicionais disponíveis, cliques consecutivos exibem +4, +4 e +3; após o terceiro clique, o botão desaparece.
