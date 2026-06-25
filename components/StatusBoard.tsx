'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { PhWithQuarter, PhWithAllQuarters, TdsCritical, Quarter, TabMode } from '@/lib/types'
import { QUARTERS, STATUS_COLORS } from '@/lib/types'

const PHDetailPanel = dynamic(() => import('./PHDetailPanel'), { ssr: false })

const POCS = ['All', 'Aravind', 'Meenakshi', 'Induma', 'DK']
const STATUSES_FILTER = ['All', 'Filed', 'In Process', 'Not filed', 'No TDS Till now', 'Refunded to Investors']
const CHECKPOINTS = ['All', 'Challan Pending', 'Form 26Q Pending', 'Form 16A Pending']

// Solid pill colours for quarter group headers
const Q_PILL = {
  Q1: 'bg-blue-500 text-white',
  Q2: 'bg-emerald-500 text-white',
  Q3: 'bg-orange-500 text-white',
  Q4: 'bg-violet-500 text-white',
} as const

// Right-border separator colour per quarter (last sub-col of each group)
const Q_SEP = {
  Q1: 'border-blue-100',
  Q2: 'border-emerald-100',
  Q3: 'border-orange-100',
  Q4: 'border-violet-100',
} as const

type CheckboxField = 'challan_done' | 'form_26q_done' | 'form_16a_done'


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

// ── Visual check indicator (replaces checkbox) ─────────────────────────────
function CheckCircle({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center mx-auto transition-transform hover:scale-110 active:scale-95"
      style={{ width: 28, height: 28 }}
    >
      {checked ? (
        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 bg-white hover:border-gray-300 transition-colors" />
      )}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function StatusBoard({ currentUser }: { currentUser: string }) {
  const [selectedTab, setSelectedTab] = useState<TabMode>('Summary')
  const [phs, setPhs] = useState<PhWithQuarter[]>([])
  const [summaryPhs, setSummaryPhs] = useState<PhWithAllQuarters[]>([])
  const [criticalIds, setCriticalIds] = useState<Set<string>>(new Set())
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
    const critRes = await fetch('/api/tds/critical')
    const crits: TdsCritical[] = critRes.ok ? await critRes.json() : []
    const ids = new Set<string>(crits.map(c => c.ph_id))
    setCriticalIds(ids)

    if (selectedTab === 'Summary') {
      const [r1, r2, r3, r4] = await Promise.all(
        QUARTERS.map(q => fetch(`/api/tds/ph?quarter=${q.key}`))
      )
      const [d1, d2, d3, d4]: PhWithQuarter[][] = await Promise.all(
        [r1, r2, r3, r4].map(r => r.json())
      )
      const byId: Record<string, PhWithAllQuarters> = {}
      const datasets: [Quarter, PhWithQuarter[]][] = [
        ['Q1', d1], ['Q2', d2], ['Q3', d3], ['Q4', d4],
      ]
      for (const [q, data] of datasets) {
        for (const ph of data) {
          if (!byId[ph.id]) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { quarterData: _qd, ...base } = ph
            byId[ph.id] = { ...base, quarters: {} }
          }
          byId[ph.id].quarters[q] = ph.quarterData ?? null
        }
      }
      const merged = Object.values(byId)
      setSummaryPhs(merged)
      setStats({
        total: merged.length,
        filed: merged.filter(p => p.overall_status === 'Filed').length,
        inProcess: merged.filter(p => p.overall_status.includes('In Process')).length,
        notFiled: merged.filter(p => p.overall_status === 'Not filed').length,
        refunded: merged.filter(p => p.overall_status === 'Refunded to Investors').length,
        critical: crits.length,
      })
    } else {
      const phRes = await fetch(`/api/tds/ph?quarter=${selectedTab}`)
      if (phRes.ok) {
        const data: PhWithQuarter[] = await phRes.json()
        setPhs(data)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Quarter-view toggle ──────────────────────────────────────────────────
  async function toggleCheckbox(ph: PhWithQuarter, field: CheckboxField) {
    if (selectedTab === 'Summary') return
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
        body: JSON.stringify({ ph_id: ph.id, quarter: selectedTab, [field]: newVal }),
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

  // ── Summary-view toggle ──────────────────────────────────────────────────
  async function toggleSummaryCheckbox(ph: PhWithAllQuarters, quarter: Quarter, field: CheckboxField) {
    const q = ph.quarters[quarter]
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
        body: JSON.stringify({ ph_id: ph.id, quarter, [field]: newVal }),
      })
      if (res.ok) { await fetchData(); return }
    }
    setSummaryPhs(prev => prev.map(p => {
      if (p.id !== ph.id) return p
      const updatedQ = { ...(p.quarters[quarter] ?? {}), [field]: newVal }
      return { ...p, quarters: { ...p.quarters, [quarter]: updatedQ as typeof p.quarters[typeof quarter] } }
    }))
  }

  // ── Comment save (creates quarter record if needed) ──────────────────────
  async function updateComment(ph: PhWithQuarter, comment: string) {
    const q = ph.quarterData
    if (q?.id) {
      await fetch(`/api/tds/quarters/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      })
      setPhs(prev => prev.map(p =>
        p.id === ph.id ? { ...p, quarterData: { ...p.quarterData!, comment } } : p
      ))
    } else if (selectedTab !== 'Summary' && comment.trim()) {
      const res = await fetch('/api/tds/quarters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ph_id: ph.id, quarter: selectedTab, comment }),
      })
      if (res.ok) await fetchData()
    }
  }

  async function markCritical(phId: string) {
    if (criticalIds.has(phId)) return
    await fetch('/api/tds/critical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ph_id: phId }),
    })
    await fetchData()
  }

  // ── Filtering ────────────────────────────────────────────────────────────
  function matchesFilters(ph: { ph_name: string; poc: string; overall_status: string }) {
    if (search && !ph.ph_name.toLowerCase().includes(search.toLowerCase())) return false
    if (pocFilter !== 'All' && ph.poc !== pocFilter) return false
    if (statusFilter !== 'All') {
      if (statusFilter === 'Filed' && ph.overall_status !== 'Filed') return false
      if (statusFilter === 'In Process' && !ph.overall_status.includes('In Process')) return false
      if (statusFilter !== 'Filed' && statusFilter !== 'In Process' && ph.overall_status !== statusFilter) return false
    }
    return true
  }

  const filteredPhs = phs.filter(ph => {
    if (!matchesFilters(ph)) return false
    if (checkpointFilter !== 'All') {
      const q = ph.quarterData
      if (checkpointFilter === 'Challan Pending' && q?.challan_done) return false
      if (checkpointFilter === 'Form 26Q Pending' && q?.form_26q_done) return false
      if (checkpointFilter === 'Form 16A Pending' && q?.form_16a_done) return false
    }
    return true
  })

  const filteredSummary = summaryPhs.filter(ph => matchesFilters(ph))
  const displayCount = selectedTab === 'Summary' ? filteredSummary.length : filteredPhs.length
  const totalCount = selectedTab === 'Summary' ? summaryPhs.length : phs.length

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
          { label: 'Total PHs',    value: stats.total,     color: 'text-[#111111]' },
          { label: 'Fully Filed',  value: stats.filed,     color: 'text-green-700' },
          { label: 'In Process',   value: stats.inProcess, color: 'text-amber-700' },
          { label: 'Not Filed',    value: stats.notFiled,  color: 'text-red-700'   },
          { label: 'Refunded',     value: stats.refunded,  color: 'text-blue-700'  },
          { label: 'Critical PHs', value: stats.critical,  color: 'text-red-700'   },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#e5e5e5] rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
            <div className="text-xs text-[#666666] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-white border border-[#e5e5e5] rounded-xl p-1 w-fit">
        <button
          onClick={() => setSelectedTab('Summary')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedTab === 'Summary'
              ? 'bg-[#6c47ff] text-white'
              : 'text-[#666666] hover:text-[#111111] hover:bg-[#fafafa]'
          }`}
        >
          Summary
        </button>
        {QUARTERS.map(q => (
          <button
            key={q.key}
            onClick={() => setSelectedTab(q.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedTab === q.key
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
        {selectedTab !== 'Summary' && (
          <select value={checkpointFilter} onChange={e => setCheckpointFilter(e.target.value)} className="border border-[#e5e5e5] rounded-lg px-3 py-2 text-sm text-[#666666] focus:outline-none focus:ring-1 focus:ring-[#6c47ff] bg-white">
            {CHECKPOINTS.map(c => <option key={c} value={c}>{c === 'All' ? 'All Checkpoints' : c}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {selectedTab === 'Summary' ? (
            <SummaryTable
              phs={filteredSummary}
              criticalIds={criticalIds}
              loading={loading}
              onOpenDetail={ph => setSelectedPh({ ...ph, quarterData: ph.quarters['Q4'] ?? undefined })}
              onToggle={toggleSummaryCheckbox}
              onMarkCritical={id => markCritical(id)}
            />
          ) : (
            <QuarterTable
              phs={filteredPhs}
              criticalIds={criticalIds}
              loading={loading}
              onOpenDetail={ph => setSelectedPh(ph)}
              onToggle={toggleCheckbox}
              onCommentSave={updateComment}
              onMarkCritical={id => markCritical(id)}
            />
          )}
        </div>
        <div className="px-5 py-3 border-t border-[#e5e5e5] text-sm text-[#666666]">
          Showing {displayCount} of {totalCount} production houses
        </div>
      </div>

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

// ── Summary Table ──────────────────────────────────────────────────────────

const Q_LABELS: Record<Quarter, string> = {
  Q1: 'Q1 · Apr–Jun',
  Q2: 'Q2 · Jul–Sep',
  Q3: 'Q3 · Oct–Dec',
  Q4: 'Q4 · Jan–Mar',
}

function SummaryTable({ phs, criticalIds, loading, onOpenDetail, onToggle, onMarkCritical }: {
  phs: PhWithAllQuarters[]
  criticalIds: Set<string>
  loading: boolean
  onOpenDetail: (ph: PhWithAllQuarters) => void
  onToggle: (ph: PhWithAllQuarters, quarter: Quarter, field: CheckboxField) => void
  onMarkCritical: (id: string) => void
}) {
  return (
    <table className="w-full" style={{ minWidth: 1140, fontSize: 14 }}>
      <thead>
        {/* Row 1: quarter group pills */}
        <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
          <th rowSpan={2} className="text-left px-5 py-4 font-semibold text-[#666666] border-r border-[#e5e5e5] w-[220px] align-bottom whitespace-nowrap">
            PH Name
          </th>
          <th rowSpan={2} className="text-left px-4 py-4 font-semibold text-[#666666] border-r border-[#e5e5e5] w-24 align-bottom">
            POC
          </th>
          <th rowSpan={2} className="text-left px-4 py-4 font-semibold text-[#666666] border-r border-[#e5e5e5] w-36 align-bottom whitespace-nowrap">
            Overall Status
          </th>
          {(Object.keys(Q_LABELS) as Quarter[]).map(q => (
            <th key={q} colSpan={3} className="text-center px-3 pt-3 pb-2 border-r border-[#e5e5e5]">
              <span className={`inline-block px-3 py-1 rounded-full text-[13px] font-semibold ${Q_PILL[q]}`}>
                {Q_LABELS[q]}
              </span>
            </th>
          ))}
          <th rowSpan={2} className="text-center px-4 py-4 font-semibold text-[#666666] w-20 align-bottom">
            Actions
          </th>
        </tr>
        {/* Row 2: sub-column labels */}
        <tr className="border-b-2 border-[#e5e5e5] bg-[#fafafa]">
          {(Object.keys(Q_LABELS) as Quarter[]).map(q =>
            (['C', '26Q', '16A'] as const).map((sub, i) => (
              <th key={`${q}-${sub}`}
                className={`text-center px-3 pb-3 pt-1 text-xs font-medium text-[#999] w-16 ${i === 2 ? `border-r ${Q_SEP[q]}` : ''}`}
              >
                {sub}
              </th>
            ))
          )}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={16} className="text-center py-16 text-[#666666]">Loading...</td></tr>
        ) : phs.length === 0 ? (
          <tr><td colSpan={16} className="text-center py-16 text-[#666666]">No production houses found</td></tr>
        ) : (
          phs.map((ph, idx) => (
            <SummaryRow
              key={ph.id}
              ph={ph}
              idx={idx}
              isCritical={criticalIds.has(ph.id)}
              onOpenDetail={() => onOpenDetail(ph)}
              onToggle={(quarter, field) => onToggle(ph, quarter, field)}
              onMarkCritical={() => onMarkCritical(ph.id)}
            />
          ))
        )}
      </tbody>
    </table>
  )
}

function SummaryRow({ ph, idx, isCritical, onOpenDetail, onToggle, onMarkCritical }: {
  ph: PhWithAllQuarters
  idx: number
  isCritical: boolean
  onOpenDetail: () => void
  onToggle: (quarter: Quarter, field: CheckboxField) => void
  onMarkCritical: () => void
}) {
  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'
  const fields: CheckboxField[] = ['challan_done', 'form_26q_done', 'form_16a_done']
  const isRefunded = ph.overall_status === 'Refunded to Investors'
  const isNoTDS = ph.overall_status === 'No TDS Till now'
  const skipCircles = isRefunded || isNoTDS

  return (
    <tr className={`${rowBg} border-b border-[#f0f0f0] hover:bg-blue-50/20 transition-colors`}>
      {/* PH Name */}
      <td className="px-5 py-4 border-r border-[#e5e5e5]">
        <button
          onClick={onOpenDetail}
          className="font-semibold text-[#111111] hover:underline text-left leading-snug decoration-[#6c47ff]"
        >
          {ph.ph_name}
        </button>
        {isCritical && (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium align-middle">
            Critical
          </span>
        )}
      </td>

      {/* POC */}
      <td className="px-4 py-4 text-[#666666] border-r border-[#e5e5e5] whitespace-nowrap">
        {ph.poc}
      </td>

      {/* Overall Status */}
      <td className="px-4 py-4 border-r border-[#e5e5e5]">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[ph.overall_status] || 'bg-gray-100 text-gray-600'}`}>
          {ph.overall_status}
        </span>
      </td>

      {/* Quarter columns OR spanning badge */}
      {skipCircles ? (
        <td colSpan={12} className="px-4 py-4 text-center border-r border-[#e5e5e5]">
          {isRefunded ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Refunded to Investors
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gray-100 text-gray-500 rounded-full text-sm font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              No TDS Till Now
            </span>
          )}
        </td>
      ) : (
        (Object.keys(Q_LABELS) as Quarter[]).map(q =>
          fields.map((field, fi) => (
            <td
              key={`${q}-${field}`}
              className={`px-2 py-4 text-center ${fi === 2 ? `border-r ${Q_SEP[q]}` : ''}`}
            >
              <CheckCircle
                checked={ph.quarters[q]?.[field] ?? false}
                onClick={() => onToggle(q, field)}
              />
            </td>
          ))
        )
      )}

      {/* Actions */}
      <td className="px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          <button onClick={onOpenDetail} title="Open conversation" className="text-[#aaa] hover:text-[#6c47ff] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button
            onClick={onMarkCritical}
            title={isCritical ? 'Already critical' : 'Mark as critical'}
            className={`transition-colors ${isCritical ? 'text-red-500' : 'text-[#aaa] hover:text-red-500'}`}
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

// ── Quarter Table ──────────────────────────────────────────────────────────

function QuarterTable({ phs, criticalIds, loading, onOpenDetail, onToggle, onCommentSave, onMarkCritical }: {
  phs: PhWithQuarter[]
  criticalIds: Set<string>
  loading: boolean
  onOpenDetail: (ph: PhWithQuarter) => void
  onToggle: (ph: PhWithQuarter, field: CheckboxField) => void
  onCommentSave: (ph: PhWithQuarter, comment: string) => void
  onMarkCritical: (id: string) => void
}) {
  return (
    <table className="w-full" style={{ fontSize: 14 }}>
      <thead>
        <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
          <th className="text-left px-5 py-4 font-semibold text-[#666666] w-[240px]">PH Name</th>
          <th className="text-left px-4 py-4 font-semibold text-[#666666] w-24">POC</th>
          <th className="text-left px-4 py-4 font-semibold text-[#666666] w-36">Overall Status</th>
          <th className="text-center px-4 py-4 font-semibold text-[#666666] w-24">Challan</th>
          <th className="text-center px-4 py-4 font-semibold text-[#666666] w-24">Form 26Q</th>
          <th className="text-center px-4 py-4 font-semibold text-[#666666] w-24">Form 16A</th>
          <th className="text-left px-4 py-4 font-semibold text-[#666666]">Comment</th>
          <th className="text-center px-4 py-4 font-semibold text-[#666666] w-20">Actions</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr><td colSpan={8} className="text-center py-16 text-[#666666]">Loading...</td></tr>
        ) : phs.length === 0 ? (
          <tr><td colSpan={8} className="text-center py-16 text-[#666666]">No production houses found</td></tr>
        ) : (
          phs.map((ph, idx) => (
            <TableRow
              key={ph.id}
              ph={ph}
              idx={idx}
              isCritical={criticalIds.has(ph.id)}
              onOpenDetail={() => onOpenDetail(ph)}
              onToggle={field => onToggle(ph, field)}
              onCommentSave={c => onCommentSave(ph, c)}
              onMarkCritical={() => onMarkCritical(ph.id)}
            />
          ))
        )}
      </tbody>
    </table>
  )
}

function TableRow({ ph, idx, isCritical, onOpenDetail, onToggle, onCommentSave, onMarkCritical }: {
  ph: PhWithQuarter
  idx: number
  isCritical: boolean
  onOpenDetail: () => void
  onToggle: (field: CheckboxField) => void
  onCommentSave: (comment: string) => void
  onMarkCritical: () => void
}) {
  const [editingComment, setEditingComment] = useState(false)
  const [comment, setComment] = useState(ph.quarterData?.comment ?? '')
  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'

  useEffect(() => { setComment(ph.quarterData?.comment ?? '') }, [ph.quarterData?.comment])

  function handleBlur() {
    setEditingComment(false)
    onCommentSave(comment)
  }

  return (
    <tr className={`${rowBg} border-b border-[#f0f0f0] hover:bg-blue-50/20 transition-colors`}>
      <td className="px-5 py-4">
        <button onClick={onOpenDetail} className="font-semibold text-[#111111] hover:underline text-left leading-snug decoration-[#6c47ff]">
          {ph.ph_name}
        </button>
        {isCritical && (
          <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium align-middle">Critical</span>
        )}
      </td>
      <td className="px-4 py-4 text-[#666666]">{ph.poc}</td>
      <td className="px-4 py-4">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[ph.overall_status] || 'bg-gray-100 text-gray-600'}`}>
          {ph.overall_status}
        </span>
      </td>
      <td className="px-4 py-4 text-center">
        <CheckCircle checked={ph.quarterData?.challan_done ?? false} onClick={() => onToggle('challan_done')} />
      </td>
      <td className="px-4 py-4 text-center">
        <CheckCircle checked={ph.quarterData?.form_26q_done ?? false} onClick={() => onToggle('form_26q_done')} />
      </td>
      <td className="px-4 py-4 text-center">
        <CheckCircle checked={ph.quarterData?.form_16a_done ?? false} onClick={() => onToggle('form_16a_done')} />
      </td>
      <td className="px-4 py-4 max-w-[220px]">
        {editingComment ? (
          <textarea
            autoFocus
            value={comment}
            onChange={e => setComment(e.target.value)}
            onBlur={handleBlur}
            rows={2}
            className="w-full border border-[#6c47ff] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none text-[#111111]"
            placeholder="Add comment..."
          />
        ) : (
          <div
            onClick={() => setEditingComment(true)}
            className="min-h-[36px] px-3 py-2 rounded-lg cursor-text hover:bg-[#f5f5f5] transition-colors text-[#666666] text-sm border border-transparent hover:border-[#e5e5e5]"
          >
            {comment || <span className="italic text-[#bbb]">Click to add note...</span>}
          </div>
        )}
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          <button onClick={onOpenDetail} title="Open conversation" className="text-[#aaa] hover:text-[#6c47ff] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button
            onClick={onMarkCritical}
            title={isCritical ? 'Already critical' : 'Mark as critical'}
            className={`transition-colors ${isCritical ? 'text-red-500' : 'text-[#aaa] hover:text-red-500'}`}
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
