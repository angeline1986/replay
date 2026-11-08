import { syncRequestLoader } from '../shared/splash.ts'
import '../features/stories/view.css'
import '../styles/base.css'
import '../styles/content.css'
import '../features/channels/grid.css'
import '../features/videos/youtube-search.css'
import { state } from './state.ts'
import { button, clear, element, notice } from '../shared/dom.ts'
import { configured, currentUser, loadDashboard, loadVideoPage, sendMagicLink, signInWithGitHub, signOut, supabase } from '../shared/api.ts'
import { authView } from '../features/auth/view.ts'
import { channelView } from '../features/channels/view.ts'
import { videoView } from '../features/videos/view.ts'
import { makeActions } from './actions.ts'
import { channelRoute, routeFromHash } from './route.ts'
import { createAuthGate } from './auth-gate.ts'
import { sidebarView } from './shell.ts'
import { loadStoryDashboard } from '../shared/stories-api.ts'
import { makeStoryActions } from './story-actions.ts'
import { storiesView } from '../features/stories/view.ts'
import type { Channel } from '../shared/model.ts'
import { ChannelPages, loadNext } from '../features/videos/channel-pages.ts'
import { backfillMissingAvatars } from '../shared/channel-avatars.ts'
import { lookupYouTube, saveYouTubeToCollection, toggleSavedYouTube } from '../shared/saved-youtube.ts'
const root = document.querySelector<HTMLElement>('#app')!
let userId = ''
let authMessage = ''
const channelPages = new ChannelPages()
const actions = makeActions({ render, act, userId: () => userId })
const storyActions = makeStoryActions({ render, act, userId: () => userId })
async function storySnapshot(id: string, channels: Channel[]) {
  try { return { data: await loadStoryDashboard(supabase!, id, channels), error: '' } }
  catch { return { data: { groups: [], pendingCount: 0 },
    error: 'Minhas histórias indisponível. Confira a migration e as permissões.' } }
}
const auth = createAuthGate({
  load: async () => {
    const user = await currentUser()
    if (!user) return null
    let dashboard = await loadDashboard(user.id)
    if (await backfillMissingAvatars(dashboard.channels)) dashboard = await loadDashboard(user.id)
    return { ...user, dashboard, storySnapshot: await storySnapshot(user.id, dashboard.channels) }
  },
  commit: (value) => {
    userId = value?.id ?? ''
    state.channels = value?.dashboard.channels ?? []
    state.requests = value?.dashboard.requests ?? []
    state.videos = value?.dashboard.videos ?? []
    state.highlights = value?.dashboard.highlights ?? []
    state.favoriteVideos = value?.dashboard.favorites ?? []
    state.deprioritizedVideos = value?.dashboard.deprioritized ?? []
    state.queuedVideos = value?.dashboard.queued ?? []
    state.stories = value?.storySnapshot.data ?? { groups: [], pendingCount: 0 }
    state.storiesError = value?.storySnapshot.error ?? ''
    state.hasMore = value?.dashboard.hasMore ?? false
    channelPages.reset()
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
  state.deprioritizedVideos = data.deprioritized
  state.queuedVideos = data.queued
  const stories = await storySnapshot(userId, data.channels)
  state.stories = stories.data
  state.storiesError = stories.error
  state.hasMore = data.hasMore
  channelPages.reset()
}
async function loadMore(): Promise<void> {
  if (state.busy || state.demo || !(state.filter.channelId ? channelPages.hasMore(state.filter.channelId) : state.hasMore)) return
  state.busy = true
  render()
  try {
    state.hasMore = await loadNext(state.filter.channelId, state.videos, state.hasMore, channelPages,
      (offset, limit, channel) => loadVideoPage(userId, state.channels, offset, limit, channel))
  } catch (error) {
    state.error = message(error)
  } finally {
    state.busy = false
    render()
  }
}
function message(error: unknown): string { return error instanceof Error ? error.message : 'Não foi possível concluir a operação.' }
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
  syncRequestLoader(state.busy || (!state.demo && configured && auth.phase === 'initializing'))
  const shell = element('div', 'app-shell')
  const signedIn = state.demo || auth.phase === 'signed_in'
  shell.append(sidebarView(state.page, signedIn, state.stories.pendingCount, !state.demo && signedIn
    ? () => { void act(async () => { await signOut(); location.reload() }, false) }
    : undefined))
  const workspace = element('div', 'workspace')
  const main = element('main', 'workspace-main')
  workspace.append(main)
  shell.append(workspace)
  if (state.demo) main.append(element('p', 'demo-banner', 'Modo demonstração — dados fictícios, sem conexão com Supabase.'))
  if (state.error) main.append(notice(state.error, 'error'))
  if (state.importMessage && state.page === 'channels') main.append(notice(state.importMessage))
  if (state.busy) main.append(notice(state.page === 'channels'
    ? 'Cadastrando canal e buscando até 50 vídeos recentes…' : 'Carregando…'))
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
    const trackedVideoIds = new Set(state.stories.groups.flatMap((group) => [
      group.story.seed_video_id, ...group.confirmed.map((item) => item.video_id),
      ...group.pending.map((item) => item.video_id)
    ]).filter((id): id is string => !!id))
    main.append(state.page === 'stories' ? (state.storiesError
      ? notice(state.storiesError, 'error') : storiesView({
        data: state.stories,
        onDecide: (item, status) => { void storyActions.decide(item, status) },
        onRename: (story) => { void storyActions.rename(story) },
        onUnfollow: (story) => { void storyActions.unfollow(story) }
      })) : state.page !== 'channels' ? videoView({
      mode: state.page, videos: channelPages.videos(state.videos, state.filter.channelId), highlights: state.highlights,
      favoriteVideos: state.demo ? state.videos.filter((v) => v.state?.is_favorite) : state.favoriteVideos,
      collectionVideos: state.demo && state.page === 'deprioritized'
        ? state.videos.filter((v) => v.state?.is_deprioritized)
        : state.demo && state.page === 'queue' ? state.videos.filter((v) => v.state?.is_queued)
          : state.page === 'deprioritized' ? state.deprioritizedVideos
            : state.page === 'queue' ? state.queuedVideos : undefined,
      channels: state.channels,
      filter: state.filter, sort: state.sort,
      hasMore: state.filter.channelId ? channelPages.hasMore(state.filter.channelId) : state.hasMore, onLoadMore: () => { void loadMore() },
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
      onToggle: (video, key) => { void actions.toggleVideo(video, key) },
      onSaveYouTube: (video, mode) => { void act(() => saveYouTubeToCollection(supabase!, userId, video, mode === 'queue' ? 'is_queued' : 'is_deprioritized')) },
      onLookupYouTube: (input) => lookupYouTube(supabase!, input),
      onToggleSaved: (video, key) => { void act(() => toggleSavedYouTube(supabase!, video, key)) },
      onFollow: (video) => { void storyActions.follow(video) }, trackedVideoIds
    }) : channelView({
      channels: state.channels, requests: state.requests, videos: state.videos,
      busy: state.busy,
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
