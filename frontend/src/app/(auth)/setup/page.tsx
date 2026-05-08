'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { setupAdmin, checkSetupRequired } from '@/lib/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/lib/store'
import type { SetupCredentials } from '@/types'

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export default function SetupPage() {
  const router = useRouter()
  const { setCurrentUser } = useAppStore()
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Redirect if setup is not required
  useEffect(() => {
    checkSetupRequired().then((required) => {
      if (!required) router.replace('/login')
    })
  }, [router])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupCredentials>({
    resolver: zodResolver(schema),
  })

  const onSubmit = handleSubmit(async (data) => {
    setError(null)
    try {
      const user = await setupAdmin(data)
      setCurrentUser(user)
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    }
  })

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-glow">
              <Image src="/logo.svg" alt="Dom'Atic" width={40} height={40} priority />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Welcome to Dom&apos;Atic</h1>
            <p className="text-sm text-foreground-muted">Create your admin account to get started</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-7 shadow-xl">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="h-10 w-10 text-emerald-400" />
              <p className="text-base font-semibold text-foreground">Account created!</p>
              <p className="text-sm text-foreground-muted">Redirecting to dashboard…</p>
            </div>
          ) : (
            <>
              <h2 className="mb-5 text-base font-semibold text-foreground">Create admin account</h2>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <Input
                  label="Full Name"
                  placeholder="Home Admin"
                  autoComplete="name"
                  leftAddon={<User className="h-4 w-4" />}
                  error={errors.name?.message}
                  {...register('name')}
                />
                <Input
                  label="Email address"
                  type="email"
                  placeholder="admin@home.local"
                  autoComplete="email"
                  leftAddon={<Mail className="h-4 w-4" />}
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Input
                  label="Password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  leftAddon={<Lock className="h-4 w-4" />}
                  rightAddon={
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="text-foreground-dim hover:text-foreground"
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  error={errors.password?.message}
                  hint="Minimum 8 characters"
                  {...register('password')}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  leftAddon={<Lock className="h-4 w-4" />}
                  error={errors.confirm_password?.message}
                  {...register('confirm_password')}
                />
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  loading={isSubmitting}
                >
                  Create Account &amp; Enter
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
