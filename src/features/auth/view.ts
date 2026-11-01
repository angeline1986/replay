import { element, notice } from '../../shared/dom.ts'

export function authView(onSubmit: (email: string) => void, message = ''): HTMLElement {
  const wrap = element('main', 'auth-wrap')
  wrap.append(element('p', 'eyebrow', 'BEM-VINDA AO REPLAY'))
  wrap.append(element('h1', '', 'Entre na sua coleção'))
  wrap.append(element('p', 'muted', 'Enviaremos um link de acesso ao seu e-mail autorizado.'))
  if (message) wrap.append(notice(message))
  const form = element('form', 'auth-form')
  const label = element('label', '', 'E-mail')
  label.htmlFor = 'email'
  const input = element('input')
  input.id = 'email'
  input.type = 'email'
  input.required = true
  input.autocomplete = 'email'
  const submit = element('button', 'primary', 'Enviar link mágico')
  submit.type = 'submit'
  form.append(label, input, submit)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    onSubmit(input.value.trim())
  })
  wrap.append(form)
  return wrap
}
