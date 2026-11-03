# M2 — Auth privado

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

Falta confirmar visualmente o refresh no Brave após esta correção, além do logout nesse navegador. O isolamento entre duas contas reais requer uma segunda conta autorizada; nenhuma foi criada. As políticas RLS e o bloqueio anônimo foram verificados anteriormente no banco hospedado, e o teste de isolamento com dois usuários simulados passou no banco local. M2 permanece **PENDENTE**.

Fontes: [configuração Auth](https://supabase.com/docs/guides/auth/general-configuration), [Magic Link](https://supabase.com/docs/guides/auth/auth-email-passwordless), [redirects](https://supabase.com/docs/guides/auth/redirect-urls), [convites](https://supabase.com/docs/guides/auth/users), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
