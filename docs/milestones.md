# Marcos e gates

## M0 — inventário

Estado: arquitetura definida; Git local com push autorizado; conector GitHub sem permissão de escrita pela API. A proprietária escolheu o projeto Supabase existente mostrado em outra conversa para o RePlay. As ferramentas Supabase ainda não estão acessíveis nesta conversa; plano, esquema e segurança do projeto precisam de inspeção. Ações destrutivas continuam sujeitas a aprovação explícita.

## M1 — base web e CI

Entregar layout responsivo, navegação, modo demonstração isolado, build Pages, verificador de 200 linhas e validações de CI. Gate: testes locais, build e navegação verificados.

## M2 — Supabase

Entregar migrations, RLS, Auth, cliente e CRUD. O plano de aplicação está em [supabase-plan.md](supabase-plan.md). Gate: projeto de desenvolvimento conectado, migrations aplicadas e isolamento testado com dono, outro usuário e anônimo.

## M3 — coleta

Entregar parser RSS, importação idempotente, tratamento de erros, resolução de URL/handle e workflow. Gate: coleta manual e agendada comprovadas com canal real no Supabase.

## M4 — entrega

Entregar favoritos, vistos, filtros, Pages e documentação operacional. Gate: app publicado, dados reais persistentes, CI verde e demais gates aprovados.

Nenhum gate é marcado como concluído apenas por código preparado. Ao final de cada marco, registrar arquivos, comandos, resultados e pendências no relatório de execução.
