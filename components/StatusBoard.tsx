'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { PhWithQuarter, TdsCritical, Quarter } from '@/lib/types'
import { QUARTERS, STATUS_COLORS } from '@/lib/types'

const PHDetailPanel = dynamic(() => import('./PHDetailPanel'), { ssr: false })

const POCS = ['All', 'Aravind', 'Meenakshi', 'Induma', 'DK']
const STATUSES_FILTER = ['All', 'Filed', 'In Process', 'Not filed', 'No TDS Till now', 'Refunded to Investors']
const CHECKPOINTS = ['All', 'Challan Pending', 'Form 26Q Pending', 'Form 16A Pending']

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

export default function StatusBoard({ currentUser }: { currentUser: string }) {
  const [phs, setPhs] = useState<PhWithQuarter[]>([])
  const [criticalIds, setCriticalIds] = useState<Set<string>>(new Set())
  const [selectedQ, setSelectedQ] = useState<Quarter>('Q4')
  const [search, setSearch] = useState('')
  const [pocFilter, setPocFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [checkpointFilter, setCheckpointFilter] = useState('All')
  const [selectedPh, setSelectedPh] = useState<PhWithQuarter | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, filed: 0, inProcess: 0, notFiled: 0, refunded: 0, critical: 0 })

  const displayName = getDisplayName(currentUser)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [phRes, critRes] = await Promise.all([
      fetch(`/api/tds/ph?quarter=${selectedQ}`),
      fetch('/api/tds/critical'),
    ])
    if (phRes.ok) {
      const data: PhWithQuarter[] = await phRes.json()
      setPhs(data)
      const ids = new Set<string>()
      if (critRes.ok) {
        const crits: TdsCritical[] = await critRes.json()
        crits.forEach(c => ids.add(c.ph_id))
        setCriticalIds(ids)
        setStats({
          total: data.length,
          filed: data.filter(p => p.overall_status === 'Filed').length,
          inProcess: data.filter(p => p.overall_status.includes('In Process')).length,
          notFiled: data.filter(p => p.overall_status === 'Not filed').length,
          refunded: data.filter(p => p.overall_status === 'Refunded to Investors').length,
          critical: crits.length,
        })
      }
    }
    setLoading(false)
  }, [selectedQ])

  useEffect(() => { fetchData() }, [fetchData])

  async function toggleCheckbox(ph: PhWithQuarter, field: 'challan_done' | 'form_26q_done' | 'form_16a_done') {
    const q = ph.quarterData
    const newVal = !(q?.[field] ?? false)
    if (q?.id) {
      await fetch(`/api/tds/quarters/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newVal }),
      })
    } else {
      const res = await fetch('/api/tds/quarters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ph_id: ph.id, quarter: selectedQ, [field]: newVal }),
      })
      if (res.ok) { await fetchData(); return }
    }
    setPhs(prev => prev.map(p => {
      if (p.id !== ph.id) return p
      const updated = { ...p.quarterData, [field]: newVal }
      const allDone = updated.challan_done && updated.form_26q_done && updated.form_16a_done
      return { ...p, quarterData: updated as typeof p.quarterData, overall_status: allDone ? 'Filed' : p.overall_status }
    }))
  }

  async function updateComment(ph: PhWithQuarter, comment: string) {
    const q = ph.quarterData
    if (q?.id) {
      await fetch(`/api/tds/quarters/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      })
      setPhs(prev => prev.map(p => p.id === ph.id ? { ...p, quarterData: { ...p.quarterData!, comment } } : p))
    }
  }

  async function markCritical(ph: PhWithQuarter) {
    const isCrit = criticalIds.has(ph.id)
    if (isCrit) return
    await fetch('/api/tds/critical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ph_id: ph.id }),
    })
    await fetchData()
  }

  const filtered = phs.filter(ph => {
    if (search && !ph.ph_name.toLowerCase().includes(search.toLowerCase())) return false
    if (pocFilter !== 'All' && ph.poc !== pocFilter) return false
    if (statusFilter !== 'All') {
      if (statusFilter === 'Filed' && ph.overall_status !== 'Filed') return false
      if (statusFilter === 'In Process' && !ph.overall_status.includes('In Process')) return false
      if (statusFilter !== 'Filed' && statusFilter !== 'In Process' && ph.overall_status !== statusFilter) return false
    }
    if (checkpointFilter !== 'All') {
      const q = ph.quarterData
      if (checkpointFilter === 'Challan Pending' && q?.challan_done) return false
      if (checkpointFilter === 'Form 26Q Pending' && q?.form_26q_done) return false
      if (checkpointFilter === 'Form 16A Pending' && q?.form_16a_done) return false
    }
    return true
  })

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-[#111111]">TDS Status</h1>
        <span className="text-xs px-2.5 py-1 bg-[#ede9ff] text-[#6c47ff] rounded-full font-medium">FY 2025-26</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total PHs', value: stats.total, color: 'text-[#111111]' },
          { label: 'Fully Filed', value: stats.filed, color: 'text-green-700' },
          { label: 'In Process', value: stats.inProcess, color: 'text-amber-700' },
          { label: 'Not Filed', value: stats.notFiled, color: 'text-red-700' },
          { label: 'Refunded', value: stats.refunded, color: 'text-blue-700' },
          { label: 'Critical PHs', value: stats.critical, color: 'text-red-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#e5e5e5] rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
            <div className="text-xs text-[#666666] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quarter tabs */}
      <div className="flex gap-1 mb-5 bg-white border border-[#e5e5e5] rounded-xl p-1 w-fit">
        {QUARTERS.map(q => (
          <button
            key={q.key}
            onClick={() => setSelectedQ(q.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedQ === q.key
                ? 'bg-[#6c47ff] text-white'
                : 'text-[#666666] hover:text-[#111111] hover:bg-[#fafafa]'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search production house..."
            className="w-full pl-9 pr-3 py-2 border border-[#e5e5e5] rounded-lg text-sm text-[#111111] placeholder:text-[#999] focus:outline-none focus:ring-1 focus:ring-[#6c47ff] bg-white"
          />
        </div>
        <select value={pocFilter} onChange={e => setPocFilter(e.target.value)} className="border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#666666] focus:outline-none focus:ring-1 focus:ring-[#6c47ff] bg-white">
          {POCS.map(p => <option key={p} value={p}>{p === 'All' ? 'All POCs' : p}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#666666] focus:outline-none focus:ring-1 focus:ring-[#6c47ff] bg-white">
          {STATUSES_FILTER.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>
        <select value={checkpointFilter} onChange={e => setCheckpointFilter(e.target.value)} className="border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#666666] focus:outline-none focus:ring-1 focus:ring-[#6c47ff] bg-white">
          {CHECKPOINTS.map(c => <option key={c} value={c}>{c === 'All' ? 'All Checkpoints' : c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] w-[220px]">PH Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] w-24">POC</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666] w-36">Overall Status</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#666666] w-20">Challan</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#666666] w-20">26Q</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#666666] w-20">16A</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666666]">Comment</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#666666] w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-[#666666]">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-[#666666]">No production houses found</td></tr>
              ) : (
                filtered.map(ph => (
                  <TableRow
                    key={ph.id}
                    ph={ph}
                    isCritical={criticalIds.has(ph.id)}
                    onOpenDetail={() => setSelectedPh(ph)}
                    onToggle={(field) => toggleCheckbox(ph, field)}
                    onCommentSave={(c) => updateComment(ph, c)}
                    onMarkCritical={() => markCritical(ph)}
                    onOpenChat={() => setSelectedPh(ph)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-[#e5e5e5] text-xs text-[#666666]">
          Showing {filtered.length} of {phs.length} production houses
        </div>
      </div>

      {/* PH Detail Panel */}
      {selectedPh && (
        <PHDetailPanel
          ph={selectedPh}
          currentUser={displayName}
          onClose={() => setSelectedPh(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  )
}

function TableRow({
  ph, isCritical, onOpenDetail, onToggle, onCommentSave, onMarkCritical, onOpenChat,
}: {
  ph: PhWithQuarter
  isCritical: boolean
  onOpenDetail: () => void
  onToggle: (field: 'challan_done' | 'form_26q_done' | 'form_16a_done') => void
  onCommentSave: (comment: string) => void
  onMarkCritical: () => void
  onOpenChat: () => void
}) {
  const [editingComment, setEditingComment] = useState(false)
  const [comment, setComment] = useState(ph.quarterData?.comment ?? '')

  useEffect(() => { setComment(ph.quarterData?.comment ?? '') }, [ph.quarterData?.comment])

  return (
    <tr className="hover:bg-[#fafafa] transition-colors">
      <td className="px-4 py-3">
        <button onClick={onOpenDetail} className="text-[#6c47ff] font-medium hover:underline text-left text-sm leading-tight">
          {ph.ph_name}
        </button>
        {isCritical && (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">Critical</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-[#666666]">{ph.poc}</td>
      <td className="px-4 py-3">
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[ph.overall_status] || 'bg-gray-100 text-gray-600'}`}>
          {ph.overall_status}
        </span>
      </td>
      <td className="px-3 py-3 text-center">
        <input
          type="checkbox"
          checked={ph.quarterData?.challan_done ?? false}
          onChange={() => onToggle('challan_done')}
        />
      </td>
      <td className="px-3 py-3 text-center">
        <input
          type="checkbox"
          checked={ph.quarterData?.form_26q_done ?? false}
          onChange={() => onToggle('form_26q_done')}
        />
      </td>
      <td className="px-3 py-3 text-center">
        <input
          type="checkbox"
          checked={ph.quarterData?.form_16a_done ?? false}
          onChange={() => onToggle('form_16a_done')}
        />
      </td>
      <td className="px-4 py-3 max-w-[200px]">
        {editingComment ? (
          <textarea
            autoFocus
            value={comment}
            onChange={e => setComment(e.target.value)}
            onBlur={() => { setEditingComment(false); onCommentSave(comment) }}
            rows={2}
            className="w-full border border-[#6c47ff] rounded-lg px-2 py-1 text-xs resize-none focus:outline-none text-[#111111]"
          />
        ) : (
          <span
            onClick={() => setEditingComment(true)}
            className="text-xs text-[#666666] cursor-text hover:text-[#111111] line-clamp-2 block"
          >
            {comment || <span className="italic opacity-40">Add note...</span>}
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-center gap-2">
          <button onClick={onOpenChat} title="Open conversation" className="text-[#666666] hover:text-[#6c47ff] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button
            onClick={onMarkCritical}
            title={isCritical ? 'Already critical' : 'Mark as critical'}
            className={`transition-colors ${isCritical ? 'text-red-500' : 'text-[#666666] hover:text-red-500'}`}
          >
            <svg className="w-4 h-4" fill={isCritical ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
