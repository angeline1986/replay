import { element, notice } from '../../shared/dom.ts'

export function authView(onGitHub: () => void, onSubmit: (email: string) => void, message = ''): HTMLElement {
  const wrap = element('section', 'auth-wrap')
  wrap.append(element('p', 'eyebrow', 'BEM-VINDA AO REPLAY'))
  wrap.append(element('h1', '', 'Entre na sua coleção'))
  wrap.append(element('p', 'muted', 'Entre com sua conta GitHub autorizada.'))
  if (message) wrap.append(notice(message))
  const github = element('button', 'primary auth-github', 'Entrar com GitHub')
  github.type = 'button'
  github.addEventListener('click', onGitHub)
  wrap.append(github)
  wrap.append(element('p', 'muted', 'Recuperação de acesso por e-mail'))
  const form = element('form', 'auth-form')
  const label = element('label', '', 'E-mail')
  label.htmlFor = 'email'
  const input = element('input')
  input.id = 'email'
  input.type = 'email'
  input.required = true
  input.autocomplete = 'email'
  const submit = element('button', 'ghost', 'Enviar link mágico')
  submit.type = 'submit'
  form.append(label, input, submit)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    onSubmit(input.value.trim())
  })
  wrap.append(form)
  return wrap
}
