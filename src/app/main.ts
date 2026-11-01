import '../styles/base.css'
import '../styles/content.css'
import { state } from './state.ts'
import { button, clear, element, notice } from '../shared/dom.ts'
import { configured, currentUser, loadDashboard, loadVideoPage, sendMagicLink } from '../shared/api.ts'
import { authView } from '../features/auth/view.ts'
import { channelView } from '../features/channels/view.ts'
import { videoView } from '../features/videos/view.ts'
import { supabase } from '../shared/api.ts'
import { makeActions } from './actions.ts'

const root = document.querySelector<HTMLElement>('#app')!
let userId = ''
let authMessage = ''
let listening = false
const actions = makeActions({ render, act, userId: () => userId })

async function bootstrap(): Promise<void> {
  if (!state.demo && configured) {
    state.busy = true
    render()
    try {
      const user = await currentUser()
      if (user) {
        userId = user.id
        state.userEmail = user.email
        await refresh()
      } else {
        userId = ''
        state.userEmail = ''
        state.channels = []
        state.videos = []
        state.hasMore = false
        state.requests = []
      }
    } catch (error) {
      state.error = message(error)
    } finally {
      state.busy = false
    }
    if (!listening) {
      listening = true
      supabase?.auth.onAuthStateChange(() => { void bootstrap() })
    }
  }
  render()
}

async function refresh(): Promise<void> {
  if (state.demo || !userId) return
  const data = await loadDashboard(userId)
  state.channels = data.channels
  state.requests = data.requests
  state.videos = data.videos
  state.hasMore = data.hasMore
}

async function loadMore(): Promise<void> {
  if (state.busy || state.demo || !state.hasMore) return
  state.busy = true
  render()
  try {
    const next = await loadVideoPage(userId, state.channels, state.videos.length)
    state.videos.push(...next)
    state.hasMore = next.length === 50
  } catch (error) {
    state.error = message(error)
  } finally {
    state.busy = false
    render()
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
}

async function act(operation: () => Promise<void>, reload = true): Promise<void> {
  state.error = ''
  state.busy = true
  render()
  try {
    await operation()
    if (reload) await refresh()
  } catch (error) {
    state.error = message(error)
  } finally {
    state.busy = false
    render()
  }
}

function render(): void {
  clear(root)
  const shell = element('div', 'app-shell')
  const header = element('header', 'topbar')
  const brand = element('a', 'brand')
  brand.href = '#videos'
  brand.append(element('span', 'brand-icon', '▶'), element('span', '', 'RePlay'))
  header.append(brand)
  if (state.userEmail) {
    const actions = element('div', 'top-actions')
    actions.append(element('span', 'user-email', state.userEmail))
    actions.append(button('Sair', () => { void supabase?.auth.signOut().then(() => location.reload()) }, 'ghost'))
    header.append(actions)
  }
  shell.append(header)
  if (state.demo) shell.append(element('p', 'demo-banner', 'Modo demonstração — dados fictícios, sem conexão com Supabase.'))
  if (state.error) shell.append(notice(state.error, 'error'))
  if (state.busy) shell.append(notice('Carregando…'))
  if (!state.demo && !configured) {
    shell.append(notice('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.'))
  } else if (!state.demo && !userId) {
    shell.append(authView((email) => {
      void act(async () => {
        await sendMagicLink(email)
        authMessage = 'Se o e-mail estiver autorizado, o link chegará em instantes.'
      })
    }, authMessage))
  } else {
    const nav = element('nav', 'nav')
    nav.setAttribute('aria-label', 'Navegação principal')
    for (const [page, label] of [['videos', 'Vídeos'], ['channels', 'Canais']] as const) {
      const link = element('a', '', label)
      link.href = `#${page}`
      if (state.page === page) link.setAttribute('aria-current', 'page')
      nav.append(link)
    }
    shell.append(nav)
    shell.append(state.page === 'videos' ? videoView({
      videos: state.videos, channels: state.channels, filter: state.filter,
      hasMore: state.hasMore, onLoadMore: () => { void loadMore() },
      onFilter: (filter) => {
        const active = document.activeElement as HTMLInputElement
        const searching = active?.type === 'search'
        const caret = searching ? active.selectionStart : null
        state.filter = filter
        render()
        if (searching) {
          const next = root.querySelector<HTMLInputElement>('input[type="search"]')
          next?.focus()
          if (caret !== null) next?.setSelectionRange(caret, caret)
        }
      },
      onToggle: (video, key) => { void actions.toggleVideo(video, key) }
    }) : channelView({
      channels: state.channels, requests: state.requests, videos: state.videos,
      onAdd: (input) => { void actions.createChannel(input) },
      onToggle: (channel) => { void actions.toggleChannel(channel) },
      onRemove: (channel) => { void actions.deleteChannel(channel) },
      onOpen: (channel) => {
        state.filter.channelId = channel.id
        location.hash = `#videos/${channel.id}`
      }
    }))
  }
  shell.append(element('footer', 'footer', 'RePlay · seus canais, no seu ritmo.'))
  root.append(shell)
}

window.addEventListener('hashchange', () => {
  state.page = location.hash.startsWith('#channels') ? 'channels' : 'videos'
  state.filter.channelId = location.hash.match(/^#videos\/([a-f0-9-]{36})$/)?.[1] ?? ''
  render()
})

void bootstrap()
