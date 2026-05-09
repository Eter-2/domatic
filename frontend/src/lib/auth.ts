import { authApi, setAccessToken, setRefreshToken, getRefreshToken } from '@/lib/api'
import type { User, LoginCredentials, SetupCredentials } from '@/types'

export async function login(credentials: LoginCredentials): Promise<User> {
  const data = await authApi.login(credentials)
  setAccessToken(data.access_token)
  setRefreshToken(data.refresh_token)
  return await authApi.me()
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout()
  } finally {
    setAccessToken(null)
    setRefreshToken(null)
  }
}

export async function refreshToken(): Promise<User | null> {
  const token = getRefreshToken()
  if (!token) return null
  try {
    const data = await authApi.refresh(token)
    setAccessToken(data.access_token)
    setRefreshToken(data.refresh_token)
    return await authApi.me()
  } catch {
    setAccessToken(null)
    setRefreshToken(null)
    return null
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    // Try to restore session from stored refresh token on cold load
    const storedRefreshToken = getRefreshToken()
    if (storedRefreshToken && !import.meta?.env) {
      try {
        const data = await authApi.refresh(storedRefreshToken)
        setAccessToken(data.access_token)
        setRefreshToken(data.refresh_token)
      } catch {
        setRefreshToken(null)
      }
    }
    return await authApi.me()
  } catch {
    return null
  }
}

export async function setupAdmin(data: SetupCredentials): Promise<User> {
  const { confirm_password: _, ...setupData } = data
  const response = await authApi.setup(setupData)
  setAccessToken(response.access_token)
  setRefreshToken(response.refresh_token)
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
