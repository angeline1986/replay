# RePlay — cadastro imediato: ate 50 videos

- Novo canal: busca a playlist de uploads em UMA consulta `playlistItems.list`
  com `maxResults=50`; descarta videos privados/invalidos.
- Identificacao do canal: consulta `channels.list`, total habitual de 2 chamadas
  para cadastrar por handle ou ID (custos de cota sujeitos a regras da API).
- Coletor diario: codigo ORIGINAL restaurado, sem reserva compartilhada.
- Removidas as propostas de orcamento e testes especulativos das fases 2C/2D.
- Preservados os mecanismos de autenticacao, autorizacao owner, prevencao de
  concorrencia, limitacao de tentativas e retorno de erro da fase 2B.
- O SQL de `replay-import-guard.proposal.sql` continua APENAS proposta.
- Ainda NAO foi implementada a integracao da interface web.
- Antes de implantar: validar SQL em banco isolado, executar Edge em Deno,
  testar com perfil owner e nao owner, concorrencia, retry e erros reais.
- Nada aqui executa migration, configura secret, faz commit, push ou deploy.
