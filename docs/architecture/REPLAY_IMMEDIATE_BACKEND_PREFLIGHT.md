# RePlay — preflight do backend de importacao inicial (50 videos)

## Correcoes
- `ctx.userClaims.id` e a identidade validada pela SDK; `sub` pertence a `jwtClaims`.
- `maybeSingle()` devolve `null` quando ainda nao existe canal. Nao tratar isso como falha.
- `@supabase/server` fixado em versao explicita para reduzir variacao de comportamento.
- Testes funcionais executam `importOne` com banco e YouTube simulados.

## Pendente antes do deploy
- Revisar/aplicar migration de `replay_import_attempts` em ambiente controlado.
- Confirmar que o projeto usa JWT com assinatura assimetrica/JWKS: a SDK atual
  nao aceita tokens antigos HS256 sem `kid`.
- Validar a Edge Function com runtime Deno e perfil owner/nao-owner.
- Validar concorrencia e recuperacao de operacao `running` interrompida.
- Conferir na funcao o tratamento de falhas de banco e a quota de 12 tentativas/dia.
- Revisar `supabase/config.toml` conforme a documentacao atual do auth user.
- Manter `VITE_IMMEDIATE_CHANNEL_IMPORT` desligada ate validar.
- Nada neste patch altera banco de dados, secrets, site, workflow ou coleta diaria.
