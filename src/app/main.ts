import '../styles/base.css'
import '../styles/content.css'
import { state } from './state.ts'
import { button, clear, element, notice } from '../shared/dom.ts'
import { configured, currentUser, loadDashboard, loadVideoPage, sendMagicLink, signInWithGitHub, signOut } from '../shared/api.ts'
import { authView } from '../features/auth/view.ts'
import { channelView } from '../features/channels/view.ts'
import { videoView } from '../features/videos/view.ts'
import { supabase } from '../shared/api.ts'
import { makeActions } from './actions.ts'
import { channelRoute, routeFromHash } from './route.ts'
import { createAuthGate } from './auth-gate.ts'
import { accountBar, sidebarView } from './shell.ts'

const root = document.querySelector<HTMLElement>('#app')!
let userId = ''
let authMessage = ''
const actions = makeActions({ render, act, userId: () => userId })

const auth = createAuthGate({
  load: async () => {
    const user = await currentUser()
    if (!user) return null
    return { ...user, dashboard: await loadDashboard(user.id) }
  },
  commit: (value) => {
    userId = value?.id ?? ''
    state.userEmail = value?.email ?? ''
    state.channels = value?.dashboard.channels ?? []
    state.requests = value?.dashboard.requests ?? []
    state.videos = value?.dashboard.videos ?? []
    state.highlights = value?.dashboard.highlights ?? []
    state.favoriteVideos = value?.dashboard.favorites ?? []
    state.hasMore = value?.dashboard.hasMore ?? false
    state.error = ''
    authMessage = ''
  },
  onError: (error) => { state.error = message(error) },
  onChange: render
})

async function refresh(): Promise<void> {
  if (state.demo || !userId) return
  const data = await loadDashboard(userId)
  state.channels = data.channels
  state.requests = data.requests
  state.videos = data.videos
  state.highlights = data.highlights
  state.favoriteVideos = data.favorites
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
  const signedIn = state.demo || auth.phase === 'signed_in'
  shell.append(sidebarView(state.page, signedIn))
  const workspace = element('div', 'workspace')
  workspace.append(accountBar(state.userEmail, () => {
    void act(async () => { await signOut(); location.reload() }, false)
  }))
  const main = element('main', 'workspace-main')
  workspace.append(main)
  shell.append(workspace)
  if (state.demo) main.append(element('p', 'demo-banner', 'Modo demonstração — dados fictícios, sem conexão com Supabase.'))
  if (state.error) main.append(notice(state.error, 'error'))
  if (state.busy) main.append(notice('Carregando…'))
  if (!state.demo && !configured) {
    main.append(notice('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.'))
  } else if (!state.demo && auth.phase === 'initializing') {
    main.append(notice('Restaurando sessão…'))
  } else if (!state.demo && auth.phase === 'error') {
    main.append(button('Tentar novamente', () => { state.error = ''; void auth.retry() }, 'ghost'))
  } else if (!state.demo && auth.phase === 'signed_out') {
    main.append(authView(() => { void act(signInWithGitHub, false) }, (email) => {
      void act(async () => {
        await sendMagicLink(email)
        authMessage = 'Se o e-mail estiver autorizado, o link chegará em instantes.'
      })
    }, authMessage))
  } else {
    main.append(state.page !== 'channels' ? videoView({
      mode: state.page, videos: state.videos, highlights: state.highlights,
      favoriteVideos: state.demo ? state.videos.filter((v) => v.state?.is_favorite) : state.favoriteVideos,
      channels: state.channels,
      filter: state.filter, sort: state.sort,
      hasMore: state.hasMore, onLoadMore: () => { void loadMore() },
      onSort: (sort) => { state.sort = sort; render() },
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
        location.hash = channelRoute(channel.id)
      }
    }))
  }
  root.append(shell)
}

window.addEventListener('hashchange', () => {
  const route = routeFromHash(location.hash)
  state.page = route.page
  state.filter = { query: '', status: 'all', channelId: route.channelId }
  state.sort = 'recent'
  render()
})

supabase?.auth.onAuthStateChange((event, session) => auth.handle(event, session?.user.id))
if (!state.demo && configured) void auth.start()
else render()
