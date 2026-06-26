'use client'

import { useState, useEffect, useRef } from 'react'

export const STATUS_OPTIONS = [
  'Filed',
  'In Process',
  'Not filed',
  'No TDS Till now',
  'Refunded to Investors',
] as const

// Canonical order determines join order stored in DB
function formatStatus(selected: string[]): string {
  return STATUS_OPTIONS.filter(o => selected.includes(o)).join(', ')
}

export function parseStatus(status: string): string[] {
  if (!status) return []
  return status.split(',').map(s => s.trim()).filter(s => (STATUS_OPTIONS as readonly string[]).includes(s))
}

export function getBadgeStyle(status: string): string {
  if (!status) return 'bg-gray-100 text-gray-600'
  if (status === 'Filed') return 'bg-green-100 text-green-700'
  if (status === 'Refunded to Investors') return 'bg-blue-100 text-blue-700'
  if (status === 'No TDS Till now') return 'bg-gray-100 text-gray-600'
  if (status.includes('Not filed')) return 'bg-red-100 text-red-700'
  if (status.includes('In Process') || status.includes('Filed')) return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}

interface Props {
  phId: string
  status: string
  onStatusChange: (newStatus: string) => void
  size?: 'xs' | 'sm'
}

export default function StatusDropdown({ phId, status, onStatusChange, size = 'sm' }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(() => parseStatus(status))
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setSelected(parseStatus(status)) }, [status])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function toggleOption(option: string) {
    const next = selected.includes(option)
      ? selected.filter(s => s !== option)
      : [...selected, option]

    if (next.length === 0) return // keep at least one selected

    const newStatus = formatStatus(next)
    setSelected(next)
    setSaving(true)

    await fetch(`/api/tds/ph/${phId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overall_status: newStatus }),
    })

    setSaving(false)
    onStatusChange(newStatus)
  }

  const badgePad = size === 'xs' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2 py-0.5'

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={`${badgePad} rounded-full font-medium whitespace-nowrap cursor-pointer hover:opacity-75 transition-opacity ${getBadgeStyle(status)}`}
        title="Click to change status"
      >
        {status || '—'}{saving ? ' …' : ''}
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 mt-1 bg-white border border-[#e5e5e5] rounded-xl shadow-xl py-1.5 min-w-[200px]"
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-semibold text-[#999] uppercase tracking-wider border-b border-[#f0f0f0] mb-1">
            Overall Status
          </div>
          {STATUS_OPTIONS.map(opt => (
            <label key={opt} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#fafafa] cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggleOption(opt)}
                className="w-3.5 h-3.5 cursor-pointer accent-[#111111] flex-shrink-0"
              />
              <span className="text-sm text-[#111111]">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
