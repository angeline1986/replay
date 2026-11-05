export interface StoryPosition {
  kind: 'part' | 'episode' | 'chapter'
  first: number
  last: number
  season: number | null
}

export interface TrackedPattern {
  title: string
  aliases: string[]
  channelIds: string[]
  lastPosition: StoryPosition | null
  latestPublishedAt: string
}

export interface CandidateVideo {
  title: string
  channelId: string
  publishedAt: string
}

export interface StoryMatch {
  score: number
  confidence: 'alta' | 'média'
  reason: string
  position: StoryPosition | null
}

const generic = new Set([
  'manhwa', 'manhua', 'manga', 'recap', 'resumo', 'explain', 'explained',
  'shorts', 'short', 'video', 'videos', 'bl', 'boyslove', 'hindi', 'eng', 'sub',
  'parte', 'part', 'pt', 'episode', 'episodio', 'ep', 'chapter', 'chap', 'capitulo',
  'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'um', 'uma', 'e', 'and',
  'the', 'of', 'in', 'para', 'por', 'que', 'com', 'como', 'se', 'ele', 'ela'
])

export function normalizeStoryText(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
    .replace(/&/g, ' e ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
}

function significant(value: string): string[] {
  return normalizeStoryText(value).split(' ').filter((token) =>
    token.length >= 3 && !generic.has(token) && !/^\d+$/.test(token))
}

export function distinctEnough(value: string): boolean {
  const tokens = significant(value)
  return tokens.length >= 2 || (tokens.length === 1 && tokens[0].length >= 8)
}

export function parseStoryPosition(title: string): StoryPosition | null {
  const value = title.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
  const seasonEpisode = value.match(/\bs\s*(\d{1,2})\s*ep\s*0*(\d{1,4})\b/)
  if (seasonEpisode) {
    const number = Number(seasonEpisode[2])
    return number > 0 ? { kind: 'episode', first: number, last: number,
      season: Number(seasonEpisode[1]) } : null
  }
  const match = value.match(/\b(parte|part|pt|episodio|episode|ep|capitulo|chapter|chap)\s*0*(\d{1,4})(?:\s*[-–]\s*0*(\d{1,4}))?\b/)
  if (!match) return null
  const first = Number(match[2])
  const last = match[3] ? Number(match[3]) : first
  if (first < 1 || last < first) return null
  const kind = /^(parte|part|pt)$/.test(match[1]) ? 'part'
    : /^(episodio|episode|ep)$/.test(match[1]) ? 'episode' : 'chapter'
  return { kind, first, last, season: null }
}

export function suggestStoryName(title: string): string {
  const segments = title.split('|').map((part) => part.trim())
  const afterMarker = segments.find((part, index) => index > 0 && distinctEnough(part) &&
    !/#(?:shorts|bl)\b/i.test(part))
  const source = afterMarker ?? segments[0]
  return source.replace(/\b(?:parte|part|pt|epis[oó]dio|episode|ep|cap[íi]tulo|chapter|chap)\s*0*\d+(?:\s*[-–]\s*0*\d+)?\b/gi, '')
    .replace(/\s*[-–]\s*(?:manhwa|manhua|manga)\s*recap\s*$/i, '')
    .replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, '').trim()
}

function exactAlias(aliases: string[], title: string): string | null {
  const normalized = ` ${normalizeStoryText(title)} `
  return aliases.find((alias) => distinctEnough(alias) &&
    normalized.includes(` ${normalizeStoryText(alias)} `)) ?? null
}

function fuzzyAlias(aliases: string[], title: string): string | null {
  const candidate = new Set(significant(title))
  return aliases.find((alias) => {
    const tokens = new Set(significant(alias))
    if (tokens.size < 3) return false
    const common = [...tokens].filter((token) => candidate.has(token)).length
    return common / tokens.size >= 0.8 && common / candidate.size >= 0.7
  }) ?? null
}

export function proposeStoryMatch(story: TrackedPattern, video: CandidateVideo): StoryMatch | null {
  const aliases = [story.title, ...story.aliases]
  const exact = exactAlias(aliases, video.title)
  const sameChannel = story.channelIds.includes(video.channelId)
  const approximate = !exact && sameChannel ? fuzzyAlias(aliases, video.title) : null
  if (!exact && !approximate) return null
  const position = parseStoryPosition(video.title)
  const previous = story.lastPosition
  const comparable = Boolean(position && previous && position.kind === previous.kind &&
    position.season === previous.season)
  if (comparable && position!.last <= previous!.last) return null
  const forward = comparable && position!.first <= previous!.last + 2
  if (!forward && Date.parse(video.publishedAt) <= Date.parse(story.latestPublishedAt)) return null
  if (approximate && !forward) return null
  const score = exact ? (sameChannel ? (forward ? 95 : 80) : (forward ? 78 : 65)) : 62
  const confidence = score >= 85 ? 'alta' : 'média'
  const reason = `${exact ? 'Nome da obra' : 'Título semelhante'}; ` +
    `${sameChannel ? 'mesmo canal' : 'outro canal'}; ` +
    `${forward ? 'numeração seguinte' : position ? 'numeração não consecutiva' : 'sem numeração'}.`
  return { score, confidence, reason, position }
}
