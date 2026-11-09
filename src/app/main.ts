import { syncRequestLoader } from '../shared/splash.ts'
import '../features/stories/view.css'
import '../styles/base.css'
import '../styles/content.css'
import '../features/channels/grid.css'
import '../features/videos/youtube-search.css'
import { state } from './state.ts'
import { button, clear, element, notice } from '../shared/dom.ts'
import { configured, currentUser, loadDashboard, sendMagicLink, signInWithGitHub, signOut, supabase } from '../shared/api.ts'
import { authView } from '../features/auth/view.ts'
import { channelView } from '../features/channels/view.ts'
import { videoView } from '../features/videos/view.ts'
import { makeActions } from './actions.ts'
import { channelRoute, isMarkedRoute, markedRoute, routeFromHash, storySequenceId, storySequenceRoute } from './route.ts'
import { createAuthGate } from './auth-gate.ts'
import { sidebarView } from './shell.ts'
import { scanExistingStories, storySnapshot } from './story-snapshot.ts'
import { makeStoryActions } from './story-actions.ts'
import { storiesView } from '../features/stories/view.ts'
import { ChannelPages, channelBase } from '../features/videos/channel-pages.ts'
import { backfillMissingAvatars } from '../shared/channel-avatars.ts'
import { lookupYouTube, toggleSavedYouTube } from '../shared/saved-youtube.ts'
import { loadMarkedPage } from './marked-page.ts'
import { makeVideoLoader } from './video-loading.ts'
import { sequencePage } from './sequence-page.ts'
import { loadUsage, usageView } from '../features/usage/index.ts'
import { makeFindHandlers } from './find-handlers.ts'
const root = document.querySelector<HTMLElement>('#app')!
let userId = '', authMessage = ''
const channelPages = new ChannelPages(), loadMore = makeVideoLoader(channelPages, () => userId, render)
const actions = makeActions({ render, act, userId: () => userId }), storyActions = makeStoryActions({ render, act, userId: () => userId }),
  findHandlers = makeFindHandlers({ actions, storyActions, userId: () => userId, render })
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
    state.stories = value?.storySnapshot.data ?? { groups: [], completed: [], pendingCount: 0 }
    state.storiesError = value?.storySnapshot.error ?? ''
    state.hasMore = value?.dashboard.hasMore ?? false
    channelPages.reset()
    if (value?.id && state.page === 'videos' && state.filter.channelId) queueMicrotask(() => {
      if (state.filter.status === 'marked') void act(() => loadMarkedPage(state, supabase!, userId), false)
      else void loadMore(true) })
    if (value?.id && state.page === 'stories') queueMicrotask(discoverStories)
    state.error = ''; authMessage = ''
  },
  onError: (error) => { state.error = message(error) }, onChange: render
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
  if (state.page === 'videos' && state.filter.status === 'marked') await loadMarkedPage(state, supabase!, userId)
  if (state.page !== 'videos' || !state.filter.channelId) channelPages.reset()
}
function discoverStories(): void { if (!state.demo && userId) void act(
  () => scanExistingStories(state.stories, refresh, (text) => { state.error = text }), false) }
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
  shell.append(sidebarView(state.page, signedIn, !state.demo && signedIn
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
    main.append(state.page === 'usage' ? usageView(state.demo ? undefined : () => loadUsage(supabase!, userId))
      : state.page === 'stories' || state.page === 'completed' ? (state.storiesError
      ? notice(state.storiesError, 'error') : storiesView({
        data: state.stories, mode: state.page === 'completed' ? 'completed' : 'active',
        selectedChannelId: state.page === 'completed' ? state.completedChannelId : state.storyChannelId,
        onChannelSelect: (id) => { if (state.page === 'completed') state.completedChannelId = id; else state.storyChannelId = id; render() },
        query: state.completedQuery, onQuery: (value) => { state.completedQuery = value; render() },
        sort: state.page === 'completed' ? state.completedSort : state.storySort, onSort: (value) => { if (state.page === 'completed') state.completedSort = value; else state.storySort = value; render() },
        onLookupYouTube: (input) => lookupYouTube(supabase!, userId, input, 'completed'), onSaveYouTube: (video) => { void storyActions.addYouTubeCompleted(video) },
        onOpenSequence: (story) => { location.hash = storySequenceRoute(story.id) },
        onComplete: (story, completed) => { void storyActions.complete(story, completed) }, onToggleVideo: (video, key) => { void actions.toggleVideo(video, key) }, channels: state.channels, finder: findHandlers.stories
      })) : state.page !== 'channels' ? (storySequenceId(location.hash)
      ? sequencePage(state.stories, storySequenceId(location.hash), actions, storyActions) : videoView({
      mode: state.page, videos: state.filter.status === 'marked' ? state.markedVideos
        : channelPages.videos(channelBase(state.videos, state.filter.channelId), state.filter.channelId), highlights: state.highlights,
      favoriteVideos: state.demo ? state.videos.filter((v) => v.state?.is_favorite) : state.favoriteVideos,
      collectionVideos: state.demo && state.page === 'deprioritized'
        ? state.videos.filter((v) => v.state?.is_deprioritized)
        : state.demo && state.page === 'queue' ? state.videos.filter((v) => v.state?.is_queued)
          : state.page === 'deprioritized' ? state.deprioritizedVideos
            : state.page === 'queue' ? state.queuedVideos : undefined,
      channels: state.channels,
      filter: state.filter, sort: state.sort,
      hasMore: state.filter.status === 'marked' ? false : state.filter.channelId
        ? channelPages.hasMore(state.filter.channelId) : state.hasMore, onLoadMore: () => { void loadMore() },
      onSort: (sort) => { state.sort = sort; render() },
      onFilter: (filter) => {
        const active = document.activeElement as HTMLInputElement
        const caret = active?.type === 'search' ? active.selectionStart : null
        if (state.page === 'videos' && (filter.channelId !== state.filter.channelId ||
          (filter.status === 'marked') !== (state.filter.status === 'marked'))) {
          location.hash = filter.channelId ? filter.status === 'marked'
            ? markedRoute(filter.channelId) : channelRoute(filter.channelId) : '#videos'; return
        }
        state.filter = filter
        render()
        if (caret !== null) {
          const next = root.querySelector<HTMLInputElement>('input[type="search"]')
          next?.focus(); next?.setSelectionRange(caret, caret)
        }
      },
      onToggle: (video, key) => { void actions.toggleVideo(video, key) },
      onSaveYouTube: (video, mode) => { void actions.addYouTubeVideo(video, mode) },
      onLookupYouTube: (input) => lookupYouTube(supabase!, userId, input, state.page as 'queue' | 'deprioritized'),
      onToggleSaved: (video, key) => { void act(() => toggleSavedYouTube(supabase!, video, key)) }, onRevealVideo: (id, mode) => actions.revealCollectionVideo(id, mode),
      onFollow: (video) => { void storyActions.follow(video) }, trackedVideoIds, finder: state.page === 'favorites' ? findHandlers.favorites : undefined
    })) : channelView({
      channels: state.channels, requests: state.requests, videos: state.videos, topFilter: state.channelTopFilter, onTopFilter: (value) => { state.channelTopFilter = value; render() },
      busy: state.busy,
      onAdd: (input) => { void actions.createChannel(input) },
      onToggle: (channel) => { void actions.toggleChannel(channel) }, onTop: (channel) => { void actions.toggleTop(channel) },
      onRemove: (channel) => { void actions.deleteChannel(channel) }, onOpen: (channel) => { location.hash = channelRoute(channel.id) },
      onMarked: (channel) => { location.hash = markedRoute(channel.id) }
    }))
  }
  root.append(shell)
}
window.addEventListener('hashchange', () => {
  const route = routeFromHash(location.hash)
  state.page = route.page
  state.filter = { query: '', status: isMarkedRoute(location.hash) ? 'marked' : 'all', channelId: route.channelId }
  state.sort = 'recent'; channelPages.reset()
  render()
  if (route.page === 'videos' && route.channelId) {
    if (state.filter.status === 'marked') void act(() => loadMarkedPage(state, supabase!, userId), false)
    else void loadMore(true) }
  if (route.page === 'stories') discoverStories()
})
supabase?.auth.onAuthStateChange((event, session) => auth.handle(event, session?.user.id))
if (!state.demo && configured) void auth.start(); else render()
