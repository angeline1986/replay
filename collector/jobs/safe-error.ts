export function safeError(error: unknown): string {
  let message = error instanceof Error ? error.message : 'Erro desconhecido'
  for (const name of ['YOUTUBE_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GITHUB_TOKEN']) {
    const value = process.env[name]
    if (value) message = message.split(value).join('[SECRET]')
  }
  return message.replace(/https?:\/\/\S+/g, '[URL]').replace(/[\r\n]+/g, ' ').slice(0, 240)
}
