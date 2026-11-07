import '../styles/splash.css'

const STORAGE_KEY = 'replay_has_visited'
let overlay: HTMLElement | null = null
let requestLoading = false
let introActive = false
let progress = 0
let showTimer = 0
let finishTimer = 0
let progressTimer = 0
let originalOverflow = ''

function showOverlay(): void {
  if (overlay) return
  const template = document.getElementById('replay-loader-template') as HTMLTemplateElement | null
  const content = template?.content.firstElementChild
  if (!content) return
  overlay = content.cloneNode(true) as HTMLElement
  const bar = overlay.querySelector<HTMLElement>('.progress-fill')
  const counter = overlay.querySelector<HTMLElement>('.progress-counter')
  originalOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.body.append(overlay)
  progressTimer = window.setInterval(() => {
    progress = Math.min(90, progress + 3)
    if (bar) bar.style.width = `${progress}%`
    if (counter) counter.textContent = `${progress}%`
  }, 70)
}

function finishIfIdle(): void {
  if (requestLoading || introActive || !overlay) return
  window.clearInterval(progressTimer)
  const bar = overlay.querySelector<HTMLElement>('.progress-fill')
  const counter = overlay.querySelector<HTMLElement>('.progress-counter')
  if (bar) bar.style.width = '100%'
  if (counter) counter.textContent = '100%'
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
    if (overlay) overlay.classList.remove('fade-out')
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
