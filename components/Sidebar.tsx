'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TdsNotification } from '@/lib/types'

const NAV = [
  {
    href: '/',
    label: 'Status Board',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: '/critical',
    label: 'Critical PHs',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    href: '/tds-reconciliation',
    label: 'TDS Reconciliation',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l9-3 9 3M3 6v14l9 3 9-3V6M3 6l9 3 9-3M12 9v14" />
      </svg>
    ),
  },
]

function getDisplayName(email: string): string {
  const map: Record<string, string> = {
    'aravind@betterinvest.club': 'Aravind',
    'meenakshi@betterinvest.club': 'Meenakshi',
    'induma@betterinvest.club': 'Induma',
    'dk@betterinvest.club': 'DK',
    'aravindkumarr19@gmail.com': 'Aravind',
  }
  return map[email] || email.split('@')[0]
}

export default function Sidebar({ currentUser }: { currentUser: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [unread, setUnread] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<TdsNotification[]>([])
  const [dark, setDark] = useState(false)

  const displayName = getDisplayName(currentUser)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName])

  async function fetchNotifications() {
    const res = await fetch(`/api/tds/notifications?recipient=${encodeURIComponent(displayName)}`)
    if (res.ok) {
      const data = await res.json()
      setNotifications(data)
      setUnread(data.filter((n: TdsNotification) => !n.is_read).length)
    }
  }

  async function markRead(id: string) {
    await fetch(`/api/tds/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
    setDark(isDark)
  }

  return (
    <aside className="w-56 bg-white dark:bg-[#0a0a0a] border-r border-[#e5e5e5] dark:border-[#222222] flex flex-col h-screen fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="p-4 border-b border-[#e5e5e5] dark:border-[#222222]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#2563eb] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            BI
          </div>
          <div>
            <div className="text-[#111111] dark:text-white font-semibold text-sm leading-tight">BetterInvest</div>
            <div className="text-[#2563eb] dark:text-[#60a5fa] text-xs font-medium">TDS</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[#dbeafe] text-[#2563eb] dark:bg-[#1e3a5f] dark:text-[#60a5fa] font-medium'
                  : 'text-[#666666] dark:text-[#888888] hover:bg-[#fafafa] dark:hover:bg-[#111111] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-[#e5e5e5] dark:border-[#222222] space-y-2">
        {/* Notification */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[#666666] dark:text-[#888888] hover:bg-[#fafafa] dark:hover:bg-[#111111] hover:text-[#111111] dark:hover:text-white transition-colors text-sm"
          >
            <div className="relative">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-medium">
                  {unread}
                </span>
              )}
            </div>
            <span>Notifications</span>
          </button>

          {showNotifications && (
            <div className="absolute bottom-full left-0 w-72 bg-white dark:bg-[#111111] border border-[#e5e5e5] dark:border-[#222222] rounded-xl shadow-lg mb-1 overflow-hidden z-50">
              <div className="px-3 py-2 border-b border-[#e5e5e5] dark:border-[#222222] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#111111] dark:text-white">Notifications</span>
                <button onClick={() => setShowNotifications(false)} className="text-[#666666] dark:text-[#888888] hover:text-[#111111] dark:hover:text-white">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-[#666666] dark:text-[#888888] px-3 py-4 text-center">No notifications</p>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`px-3 py-2.5 border-b border-[#e5e5e5] dark:border-[#222222] cursor-pointer hover:bg-[#fafafa] dark:hover:bg-[#161616] transition-colors ${!n.is_read ? 'bg-[#dbeafe]/30 dark:bg-[#1e3a5f]/20' : ''}`}
                    >
                      <p className="text-xs text-[#111111] dark:text-white leading-snug">{n.message}</p>
                      <p className="text-[10px] text-[#666666] dark:text-[#888888] mt-0.5">
                        {new Date(n.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle + User */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
          <div className="w-6 h-6 rounded-full bg-[#2563eb] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {displayName[0]}
          </div>
          <span className="text-xs text-[#111111] dark:text-white font-medium flex-1 truncate">{displayName}</span>
          <button
            onClick={toggleTheme}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="text-[#666666] dark:text-[#888888] hover:text-[#111111] dark:hover:text-white transition-colors"
          >
            {dark ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M18.364 18.364l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-[#666666] dark:text-[#888888] hover:text-red-500 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
