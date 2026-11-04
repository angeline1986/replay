# M2 — Auth privado

## Migração planejada para GitHub OAuth — 03/11/2026

A conta existente tem `user_id = b53f859e-178e-4abb-b4f4-9e17f0bd08f8`, e `public.profiles.role = owner`. A consulta somente leitura a `auth.users`, `auth.identities` e `public.profiles` encontrou apenas a identidade `email` para essa conta; ainda não há vínculo GitHub. O conector GitHub identificou `angeline1986` com ID `44986789`. O e-mail da conta GitHub não foi usado como prova de vínculo.

O frontend local oferece GitHub como ação principal com retorno exato a `/replay/`. O Magic Link fica disponível como recuperação até concluir o login real e a conferência de identidade. A proprietária autorizou a sequência de criação e configuração; a criação do OAuth App e a inserção direta do segredo nos painéis GitHub/Supabase aguardam sua intervenção. O teste no Brave está pendente; nenhuma configuração remota foi alterada nesta etapa.

Para a primeira autenticação, conferir imediatamente que `auth.identities.provider = github` e `provider_id = 44986789` pertencem ao `user_id` acima, que há somente o perfil `owner` esperado e que a sessão autenticada usa o mesmo ID. Se qualquer valor divergir ou a vinculação automática falhar, interromper os testes e manter o Magic Link para entrar na conta original. O procedimento seguro é autenticar nessa conta, habilitar vinculação manual apenas após revisão da configuração e usar `linkIdentity({ provider: 'github' })`; conferir novamente as duas identidades e o ID antes de usar GitHub como acesso normal. Não criar perfil alternativo ou mover dados.

Após a proprietária confirmar a configuração nos painéis, uma leitura de `/auth/v1/settings` com chave publicável retornou `external.github: true`, `external.email: true` e `disable_signup: true`. Nova consulta somente leitura ao banco confirmou o mesmo `user_id`, `owner` e zero identidades GitHub antes do primeiro login. O Client Secret não foi lido nem registrado. O vínculo e a sessão no Brave seguem pendentes.

No primeiro login GitHub, a proprietária confirmou que o dashboard abriu em `/replay/` no Brave. A consulta imediata a `auth.identities` mostrou `email` e `github` (`provider_id = 44986789`) vinculados ao `user_id = b53f859e-178e-4abb-b4f4-9e17f0bd08f8` e perfil `owner`. Havia um usuário Auth, um perfil e 14 políticas `public`, quantidade já registrada antes da migração. O bootstrap do frontend exige `getUser()` e perfil correspondente antes de abrir o dashboard; com um único perfil, esse resultado comprova que a sessão GitHub usa a conta original. Refresh, reabertura e logout no Brave ainda serão conferidos.

A proprietária confirmou no Brave que fechar e reabrir a aba restaurou o dashboard autenticado, e que clicar em Sair apresentou a tela de login. A atualização da página e a nova entrada por GitHub após o logout ainda estão em teste.

A segunda entrada com GitHub após o logout abriu o dashboard. Nova consulta remota somente leitura encontrou um usuário Auth, um perfil `owner` e uma identidade GitHub `44986789` na conta original. A atualização da página no Brave ainda aguarda confirmação.

A proprietária confirmou que atualizar a página com a sessão GitHub ativa voltou ao dashboard sem pedir login. Assim, primeiro login, novo login após logout, atualização da página, reabertura da aba e logout passaram no Brave. A rotação automática do token por expiração não foi forçada nesse teste. A migração de acesso normal para GitHub OAuth está validada. O Magic Link continua na interface e o provedor de e-mail permanece habilitado para recuperação; sua retirada da interface será proposta separadamente. Nenhuma migration ou política RLS foi alterada; M3 não foi iniciado.

Projeto: `fxbivwcfwqdvotohzrwg`. Estado em 03/11/2026: configuração remota aplicada; convite enviado; login no navegador confirmado; recuperação da sessão exibia o login temporariamente no Brave.

## Configuração remota

`npx supabase config push --project-ref fxbivwcfwqdvotohzrwg --yes` aplicou o cadastro global desabilitado, a Site URL do GitHub Pages e a allowlist exata do Pages e de `http://localhost:5173/replay/`. O provedor de e-mail permanece habilitado para Magic Link. Convites administrativos podem criar contas autorizadas. A resposta de `/auth/v1/settings` confirmou `email_provider: true`, `disable_signup: true`, `anonymous_sign_ins: false` e `autoconfirm: false`.

Na primeira aplicação, `auth.email.enable_signup = false` desligou o provedor de e-mail. O valor foi corrigido para `true` e reaplicado isoladamente; a leitura da API Auth confirmou o provedor ativo. A restrição de cadastro público é `auth.enable_signup = false`. Nenhuma migration foi reaplicada.

## Primeira conta

A CLI identificou `angeline.fm@gmail.com` como conta da equipe do projeto. Isso satisfaz a restrição de destinatário do SMTP padrão; a entrega à caixa postal não foi confirmada antes do envio. O serviço aceitou `auth.admin.inviteUserByEmail` para esse e-mail, com retorno à URL local do RePlay. O usuário retornado foi registrado em `public.profiles` com `role = 'owner'`, e o `INSERT ... RETURNING` confirmou o registro. A chave administrativa ficou apenas em memória do processo e não entrou no repositório.

O servidor local respondeu HTTP 200 em `http://127.0.0.1:5173/replay/`. A proprietária confirmou que o convite chegou e o painel abriu. O GitHub Pages ainda não foi publicado; sua URL está permitida para quando o deploy ocorrer.

## Validação e pendências

Uma tentativa real de `signUp` público retornou HTTP 422, código `signup_disabled`, sem usuário criado. O código cliente usa `signInWithOtp` com `shouldCreateUser: false`, valida a identidade com `getUser()`, exige `profiles`, persiste a sessão no navegador e oferece logout local.

Após o primeiro login, o painel mostrava um erro anterior `email rate limit exceeded`; o estado do erro era preservado indevidamente. O bootstrap foi corrigido para limpar esse aviso quando a sessão e os dados carregam com sucesso. A correção ainda precisa de confirmação visual após atualização da página.

A proprietária confirmou no Brave que a chave da sessão, o access token e o refresh token permaneciam no `localStorage`, com access token ainda válido. Após o refresh, o formulário aparecia temporariamente e o dashboard voltava sem novo login. Portanto, a falha observada era de inicialização/renderização, sem evidência de perda persistente da sessão. A atualização anterior de `@supabase/supabase-js` para 2.118.0 não foi estabelecida como causa ou solução.

Um teste administrativo gerou um Magic Link para a conta existente **sem enviar e-mail**. A verificação do token criou uma sessão com o mesmo ID do convite; outra instância do cliente restaurou a sessão de um armazenamento de teste. A Data API autenticada respondeu sem erro nas seis tabelas: `profiles` retornou uma linha, e as outras cinco retornaram zero. O logout local removeu a sessão desse armazenamento. Isso comprova o fluxo do serviço e do cliente em processo de teste, mas não comprova persistência ou logout no Brave.

O frontend agora usa um estado explícito `initializing`, `signed_in`, `signed_out` ou `error`. Exibe “Restaurando sessão…” até concluir a recuperação, só mostra login após resultado nulo e preserva o dashboard em `TOKEN_REFRESHED`. Eventos `SIGNED_IN` durante a recuperação são serializados; `INITIAL_SESSION` e login repetido do mesmo usuário não reiniciam a carga. Um resultado atrasado não reabre o dashboard após `SIGNED_OUT`.

As duas capturas fornecidas pela proprietária após a correção mostram primeiro “Restaurando sessão…” e depois o dashboard autenticado, sem formulário de login intermediário. O refresh visual no Brave passou. Ainda faltam logout nesse navegador e isolamento entre duas contas reais; nenhuma segunda conta foi criada. As políticas RLS e o bloqueio anônimo foram verificados anteriormente no banco hospedado, e o teste de isolamento com dois usuários simulados passou no banco local. M2 permanece **PENDENTE**.

Fontes: [configuração Auth](https://supabase.com/docs/guides/auth/general-configuration), [Magic Link](https://supabase.com/docs/guides/auth/auth-email-passwordless), [redirects](https://supabase.com/docs/guides/auth/redirect-urls), [convites](https://supabase.com/docs/guides/auth/users), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
