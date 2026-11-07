import '../styles/splash.css'

const STORAGE_KEY = 'replay_has_visited'

function runSplashSequence(loader: HTMLElement, body: HTMLElement): void {
  const bar = document.getElementById('loader-progress-bar') as HTMLElement | null
  const counter = document.getElementById('loader-counter')
  if (!bar || !counter) { loader.remove(); return }
  const previousOverflow = body.style.overflow
  body.style.overflow = 'hidden'
  let progress = 0
  const interval = window.setInterval(() => {
    progress = Math.min(100, progress + Math.floor(Math.random() * 9) + 4)
    bar.style.width = `${progress}%`
    counter.textContent = `${progress}%`
    if (progress < 100) return
    window.clearInterval(interval)
    window.setTimeout(() => {
      loader.classList.add('fade-out')
      body.style.overflow = previousOverflow
      window.setTimeout(() => loader.remove(), 500)
    }, 350)
  }, 50)
}

function startSplash(): void {
  const loader = document.getElementById('replay-loader')
  if (!loader) return
  let visited = false
  try { visited = localStorage.getItem(STORAGE_KEY) !== null }
  catch { /* O navegador pode bloquear o armazenamento local. */ }
  if (visited) { loader.remove(); return }
  try { localStorage.setItem(STORAGE_KEY, 'true') }
  catch { /* A animação ainda pode rodar sem persistência. */ }
  runSplashSequence(loader, document.body)
}

startSplash()
