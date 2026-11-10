# RePlay: interface de cadastro imediato (opt-in)

- Cadastro de novo canal via @handle, URL ou ID usa `import-channel` somente
  com `VITE_IMMEDIATE_CHANNEL_IMPORT=true` no build do frontend.
- O comportamento atual continua por padrao, com flag ausente/desativada.
- Interface mostra busca em andamento e status de sucesso ou erro; bloqueia
  novas submissões enquanto houver uma operação de cadastro.
- O backend importa no maximo 50 videos; coleta diaria nao foi alterada.
- A Edge Function ainda exige migration proposta de guarda de importacao,
  secrets, configuracao de autenticacao e testes reais de Deno/Supabase.
- NAO habilitar a flag nem publicar o frontend ate validar backend e permissões.
- Este patch nao executa SQL, cria secrets, faz commit, push ou deploy.
