'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { login, logout, refreshToken, getCurrentUser } from '@/lib/auth'
import type { LoginCredentials } from '@/types'

export function useAuth() {
  const { currentUser, setCurrentUser } = useAppStore()
  const router = useRouter()

  const doLogin = useCallback(
    async (credentials: LoginCredentials) => {
      const user = await login(credentials)
      setCurrentUser(user)
      router.push('/dashboard')
      return user
    },
    [setCurrentUser, router]
  )

  const doLogout = useCallback(async () => {
    await logout()
    setCurrentUser(null)
    router.push('/login')
  }, [setCurrentUser, router])

  const doRefresh = useCallback(async () => {
    const user = await refreshToken()
    setCurrentUser(user)
    return user
  }, [setCurrentUser])

  const fetchCurrentUser = useCallback(async () => {
    const user = await getCurrentUser()
    setCurrentUser(user)
    return user
  }, [setCurrentUser])

  return {
    user: currentUser,
    isAuthenticated: !!currentUser,
    login: doLogin,
    logout: doLogout,
    refreshToken: doRefresh,
    fetchCurrentUser,
  }
}
