import { authApi, setAccessToken } from '@/lib/api'
import type { User, LoginCredentials, SetupCredentials } from '@/types'

export async function login(credentials: LoginCredentials): Promise<User> {
  const data = await authApi.login(credentials)
  setAccessToken(data.access_token)
  return data.user
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout()
  } finally {
    setAccessToken(null)
  }
}

export async function refreshToken(): Promise<User | null> {
  try {
    const data = await authApi.refresh()
    setAccessToken(data.access_token)
    return data.user
  } catch {
    setAccessToken(null)
    return null
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await authApi.me()
  } catch {
    return null
  }
}

export async function setupAdmin(data: SetupCredentials): Promise<User> {
  const response = await authApi.setup(data)
  setAccessToken(response.access_token)
  return response.user
}

export async function checkSetupRequired(): Promise<boolean> {
  try {
    const { setup_required } = await authApi.checkSetup()
    return setup_required
  } catch {
    return false
  }
}
