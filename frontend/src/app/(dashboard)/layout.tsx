'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/hooks/useAuth'

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const { fetchCurrentUser, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    fetchCurrentUser().then((user) => {
      if (!user) {
        router.replace('/login')
      }
    })
  }, [fetchCurrentUser, router])

  return <DashboardLayout>{children}</DashboardLayout>
}
