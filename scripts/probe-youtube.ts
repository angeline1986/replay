import { ApiBudget } from '../collector/youtube/client.ts'
import { fetchUploads, uploadPlaylists } from '../collector/youtube/uploads.ts'

const nerdoleiId = 'UCDkaX7QmS7V3A2NNWvFHbXQ'
const key = process.env.YOUTUBE_API_KEY
if (!key) throw new Error('YOUTUBE_API_KEY ausente no ambiente do processo.')

const budget = new ApiBudget(3)
const playlists = await uploadPlaylists([nerdoleiId], key, budget)
const playlist = playlists.get(nerdoleiId)
if (!playlist) throw new Error('Playlist de uploads não encontrada.')
const result = await fetchUploads(playlist, nerdoleiId, key, budget)
console.log(`Sonda sem Supabase: 1 canal; ${result.videos.length} vídeos públicos; ` +
  `${budget.used} chamadas YouTube (máximo 3).`)
