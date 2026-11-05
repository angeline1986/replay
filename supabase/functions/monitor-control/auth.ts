import { HttpError } from './handler.ts'

export async function verifyOwner(
  getUser: () => Promise<{ id: string } | null>,
  getRole: (userId: string) => Promise<string | null>
): Promise<string> {
  const user = await getUser()
  if (!user?.id) throw new HttpError(401, 'Sessão inválida.')
  const role = await getRole(user.id)
  if (role !== 'owner') throw new HttpError(403, 'Acesso restrito ao perfil owner.')
  return user.id
}
