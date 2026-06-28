'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center">
      <div className="bg-white dark:bg-[#111111] border border-[#e5e5e5] dark:border-[#222222] rounded-2xl p-8 w-full max-w-sm shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-[#2563eb] flex items-center justify-center text-white font-bold text-sm">
            BI
          </div>
          <div>
            <div className="text-[#111111] dark:text-white font-semibold text-sm leading-tight">BetterInvest</div>
            <div className="text-[#666666] dark:text-[#888888] text-xs">TDS Dashboard</div>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-[#111111] dark:text-white mb-1">Sign in</h1>
        <p className="text-sm text-[#666666] dark:text-[#888888] mb-6">FY 2025-26 TDS Status</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#666666] dark:text-[#888888] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@betterinvest.club"
              className="w-full px-3 py-2 border border-[#e5e5e5] dark:border-[#222222] rounded-lg text-sm text-[#111111] dark:text-white bg-white dark:bg-[#0a0a0a] placeholder:text-[#999] dark:placeholder:text-[#555555] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#666666] dark:text-[#888888] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-[#e5e5e5] dark:border-[#222222] rounded-lg text-sm text-[#111111] dark:text-white bg-white dark:bg-[#0a0a0a] placeholder:text-[#999] dark:placeholder:text-[#555555] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2563eb] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
