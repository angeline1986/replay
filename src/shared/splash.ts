import '../styles/splash.css'

const STORAGE_KEY = 'replay_has_visited'
let overlay: HTMLElement | null = null
let requestLoading = false
let introActive = false
let showTimer = 0
let finishTimer = 0
let originalOverflow = ''

function showOverlay(): void {
  if (overlay) return
  const template = document.getElementById('replay-loader-template') as HTMLTemplateElement | null
  const content = template?.content.firstElementChild
  if (!content) return
  overlay = content.cloneNode(true) as HTMLElement
  overlay.classList.add('is-loading')
  originalOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.body.append(overlay)
}

function finishIfIdle(): void {
  if (requestLoading || introActive || !overlay) return
  overlay.classList.remove('is-loading')
  const bar = overlay.querySelector<HTMLElement>('.progress-fill')
  const counter = overlay.querySelector<HTMLElement>('.progress-counter')
  if (bar) bar.style.width = '100%'
  if (bar) bar.style.transform = 'translateX(0)'
  if (counter) counter.textContent = 'Pronto'
  finishTimer = window.setTimeout(() => {
    if (requestLoading || introActive || !overlay) return
    overlay.classList.add('fade-out')
    finishTimer = window.setTimeout(() => {
      if (requestLoading || introActive || !overlay) return
      overlay.remove()
      overlay = null
      document.body.style.overflow = originalOverflow
    }, 500)
  }, 350)
}

export function syncRequestLoader(loading: boolean): void {
  if (loading === requestLoading) return
  requestLoading = loading
  if (loading) {
    window.clearTimeout(showTimer)
    window.clearTimeout(finishTimer)
    if (overlay) {
      overlay.classList.remove('fade-out')
      overlay.classList.add('is-loading')
      const bar = overlay.querySelector<HTMLElement>('.progress-fill')
      if (bar) { bar.style.width = ''; bar.style.transform = '' }
      const counter = overlay.querySelector<HTMLElement>('.progress-counter')
      if (counter) counter.textContent = 'Carregando…'
    }
    else showTimer = window.setTimeout(showOverlay, 350)
    return
  }
  window.clearTimeout(showTimer)
  if (!introActive) finishIfIdle()
}

function startFirstVisitSplash(): void {
  let visited = false
  try { visited = localStorage.getItem(STORAGE_KEY) !== null }
  catch { /* O navegador pode bloquear o armazenamento local. */ }
  if (visited) return
  try { localStorage.setItem(STORAGE_KEY, 'true') }
  catch { /* A animação ainda pode rodar sem persistência. */ }
  introActive = true
  showOverlay()
  window.setTimeout(() => { introActive = false; finishIfIdle() }, 1850)
}

startFirstVisitSplash()
