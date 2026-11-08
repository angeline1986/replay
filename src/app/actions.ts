import { state } from './state.ts'
import { addChannel, removeChannel, requestChannel, saveVideoState, setChannelActive, setChannelTop, supabase } from '../shared/api.ts'
import { validChannelId, type Channel, type Video } from '../shared/model.ts'
import { normalizeChannelInput } from '../features/channels/normalize.ts'
import { importChannelNow } from '../shared/import-channel.ts'
import { addYouTubeWithChannel, type YouTubeResult } from '../shared/saved-youtube.ts'

interface Hooks {
  render: () => void
  act: (operation: () => Promise<void>, reload?: boolean) => Promise<void>
  userId: () => string
}

export function makeActions(hooks: Hooks) {
  async function toggleVideo(video: Video, key: 'is_favorite' | 'is_watched' | 'is_deprioritized' | 'is_queued'): Promise<void> {
    video.state ??= { video_id: video.id, is_favorite: false, is_watched: false }
    video.state[key] = !video.state[key]
    if (state.demo) { hooks.render(); return }
    await hooks.act(() => saveVideoState(hooks.userId(), video))
  }

  async function addYouTubeVideo(video: YouTubeResult, mode: 'queue' | 'deprioritized'): Promise<void> {
    const db = supabase
    if (state.busy || !db) return
    const flag = mode === 'queue' ? 'is_queued' : 'is_deprioritized'
    await hooks.act(() => addYouTubeWithChannel(db, hooks.userId(), video, flag, importChannelNow))
  }

  async function createChannel(input: string): Promise<void> {
    if (state.busy) return
    state.importMessage = ''
    try {
      const parsed = normalizeChannelInput(input)
      if (!parsed.id && !parsed.handle) throw new Error('Canal inválido.')
      if (state.demo) {
        if (parsed.handle) {
          state.requests.push({ id: crypto.randomUUID(), handle: parsed.handle, status: 'pending', error_message: null })
          hooks.render()
          return
        }
        state.channels.push({
          id: crypto.randomUUID(), owner_id: 'demo', youtube_channel_id: parsed.id!,
          handle: null, name: parsed.id!, avatar_url: null, is_active: true, is_top: false,
          last_checked_at: null, last_success_at: null
        })
        hooks.render()
        return
      }
      if (import.meta.env.VITE_IMMEDIATE_CHANNEL_IMPORT === 'true') {
        await hooks.act(async () => {
          const result = await importChannelNow(parsed)
          state.importMessage = result.status === 'already_monitored'
            ? 'Este canal já está monitorado.'
            : `Canal cadastrado: ${result.importedVideos} vídeo(s) recente(s) importado(s).`
        })
      } else if (parsed.handle) await hooks.act(() => requestChannel(hooks.userId(), parsed.handle!))
      else if (parsed.id && validChannelId(parsed.id)) {
        await hooks.act(() => addChannel(hooks.userId(), parsed.id!))
      }
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Canal inválido.'
      hooks.render()
    }
  }

  async function toggleChannel(channel: Channel): Promise<void> {
    if (state.demo) { channel.is_active = !channel.is_active; hooks.render(); return }
    await hooks.act(() => setChannelActive(channel, !channel.is_active))
  }

  async function toggleTop(channel: Channel): Promise<void> {
    if (state.demo) { channel.is_top = !channel.is_top; hooks.render(); return }
    await hooks.act(() => setChannelTop(channel, !channel.is_top))
  }

  async function deleteChannel(channel: Channel): Promise<void> {
    if (!confirm(`Remover ${channel.name} e todos os vídeos e estados associados?`)) return
    if (state.demo) {
      state.channels = state.channels.filter((item) => item.id !== channel.id)
      state.videos = state.videos.filter((item) => item.channel_id !== channel.id)
      hooks.render()
      return
    }
    await hooks.act(() => removeChannel(channel))
  }

  return { toggleVideo, addYouTubeVideo, createChannel, toggleChannel, toggleTop, deleteChannel }
}
